<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/files.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const MEDIA_COLUMNS = 'id, src, title, description, children, updated_at, updated_by';
const MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'pdf'];

$uploadBaseDir = dirname(__DIR__) . '/photos';

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string)($_GET['action'] ?? '');
$user = null;
if ($method !== 'GET' || $action === 'scan') {
    $user = requireEditor();
}

function mediaReferencedPaths(array $row): array {
    $paths = [];
    if (!empty($row['src'])) $paths[] = $row['src'];
    $children = $row['children'] ?? [];
    if (is_string($children)) {
        $decoded = json_decode($children, true);
        $children = is_array($decoded) ? $decoded : [];
    }
    foreach ((array)$children as $child) {
        if (is_array($child) && !empty($child['src'])) $paths[] = $child['src'];
        elseif (is_string($child) && $child !== '') $paths[] = $child;
    }
    return array_values(array_unique($paths));
}

function mediaPathReferencedElsewhere(PDO $pdo, string $path, int $exceptId): bool {
    $stmt = $pdo->prepare('SELECT id FROM media WHERE id <> ? AND (src = ? OR children LIKE ?) LIMIT 1');
    $stmt->execute([$exceptId, $path, '%' . addcslashes(json_encode($path, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), '%_\\') . '%']);
    return (bool)$stmt->fetch();
}

function normalizeChildren($children): string {
    if ($children === null || $children === '') return '[]';
    if (is_string($children)) {
        $children = json_decode($children, true);
        if (json_last_error() !== JSON_ERROR_NONE) jsonError('Invalid JSON in children field', 400);
    }
    if (!is_array($children)) jsonError('Invalid JSON in children field', 400);
    foreach ($children as $child) {
        $src = is_array($child) ? ($child['src'] ?? '') : $child;
        if (!is_string($src) || ($src !== '' && sanitizeUrl($src) === '')) {
            jsonError('Ungültiger Pfad in children', 400);
        }
    }
    return json_encode($children, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

if ($method === 'GET') {
    if ($action === 'scan') {
        $title = trim((string)($_GET['title'] ?? ''), '/');
        if ($title === '') jsonError('Title is required for scanning', 400);
        $targetDir = resolveUploadDir($uploadBaseDir, $title);
        if (!is_dir($targetDir)) {
            jsonResponse(['success' => true, 'files' => [], 'scanned_path' => '/photos/' . $title, 'message' => 'Directory does not exist yet']);
        }
        $files = array_map(fn($file) => $file['path'], listFilesRecursive($targetDir, $title));
        jsonResponse(['success' => true, 'files' => $files, 'scanned_path' => '/photos/' . $title, 'file_count' => count($files)]);
    }

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id) {
        $stmt = $pdo->prepare('SELECT ' . MEDIA_COLUMNS . ' FROM media WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $rows = $pdo->query('SELECT ' . MEDIA_COLUMNS . ' FROM media ORDER BY id DESC')->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST' && !empty($_FILES) && ($_POST['action'] ?? '') === 'upload') {
    $title = trim((string)($_POST['title'] ?? ''), '/');
    if ($title === '') jsonError('Title is required for upload', 400);
    $targetDir = resolveUploadDir($uploadBaseDir, $title);
    [$stored, $errors] = storeUploadedFiles($targetDir, MEDIA_EXTENSIONS, function (string $base, string $extension) {
        return bin2hex(random_bytes(16)) . '.' . $extension;
    });
    $files = array_map(fn($file) => $title . '/' . $file['name'], $stored);
    jsonResponse([
        'success' => true,
        'files' => $files,
        'errors' => $errors,
        'uploaded_count' => count($files),
        'target_path' => '/photos/' . $title,
    ]);
}

if ($method === 'POST') {
    $data = requestBody();
    $id = isset($data['id']) && $data['id'] !== '' && $data['id'] !== null ? (int)$data['id'] : null;
    $src = sanitizeUrl($data['src'] ?? '');
    $title = trim((string)($data['title'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    $children = normalizeChildren($data['children'] ?? '[]');

    if ($src === '' || $title === '') {
        jsonError('Missing required fields: src and title', 400);
    }

    if ($id !== null) {
        $before = auditFetchRow($pdo, 'media', $id);
        if (!$before) jsonError('Media not found', 404);
        guardWrite($pdo, 'media', $id, $user, $data['expected_updated_at'] ?? null);
        $stmt = $pdo->prepare('UPDATE media SET src = ?, title = ?, description = ?, children = ?, updated_by = ? WHERE id = ?');
        $stmt->execute([$src, $title, $description, $children, $user['username'], $id]);
        auditLog($pdo, $user, 'media', $id, 'update', $before, auditFetchRow($pdo, 'media', $id));
        jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
    }

    $newId = insertWithNextId($pdo, 'media', function (int $newId) use ($pdo, $src, $title, $description, $children, $user) {
        $stmt = $pdo->prepare('INSERT INTO media (id, src, title, description, children, updated_by) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $src, $title, $description, $children, $user['username']]);
    });
    auditLog($pdo, $user, 'media', $newId, 'create', null, auditFetchRow($pdo, 'media', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if (!$id) jsonError('Missing id for deletion', 400);

    $before = auditFetchRow($pdo, 'media', $id);
    if (!$before) jsonError('Media not found', 404);
    guardWrite($pdo, 'media', $id, $user, $data['expected_updated_at'] ?? null);

    $stmt = $pdo->prepare('DELETE FROM media WHERE id = ?');
    $stmt->execute([$id]);
    $filePaths = mediaReferencedPaths($before);
    $removedFiles = [];
    if ($stmt->rowCount()) {
        foreach ($filePaths as $filePath) {
            $removedFiles[$filePath] = !mediaPathReferencedElsewhere($pdo, $filePath, $id)
                && removeFileBelow($filePath, 'photos', $uploadBaseDir);
        }
        auditLog($pdo, $user, 'media', $id, 'delete', [
            'media' => $before,
            'file_paths' => $filePaths,
            'files_removed' => $removedFiles,
        ], null);
    }
    jsonResponse(['success' => true, 'message' => 'Deleted', 'id' => $id, 'file_paths' => $filePaths, 'files_removed' => $removedFiles]);
}

jsonError('Method not allowed', 405);
