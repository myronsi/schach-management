<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/files.php';

sendCorsHeaders(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const DOCUMENT_COLUMNS = 'id, name, filename, filepath, category, description, file_size, upload_date, updated_at, updated_by, is_active';
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'odt', 'ods', 'odp', 'zip', 'rar', 'jpg', 'jpeg', 'png', 'gif'];

$uploadBaseDir = dirname(__DIR__) . '/docs';

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string)($_GET['action'] ?? '');
$user = null;
if ($method !== 'GET' || $action === 'scan') {
    $user = requireEditor();
}

/** Document file paths must be an http(s) URL or a root-relative path (usually /docs/...). */
function validDocumentPath(string $filepath): bool {
    if (preg_match('#^https?://#i', $filepath)) return sanitizeUrl($filepath) !== '';
    if (!str_starts_with($filepath, '/') || str_starts_with($filepath, '//')) return false;
    if (preg_match('/[\x00-\x1f\\\\]/', $filepath)) return false;
    return !in_array('..', explode('/', $filepath), true);
}

/** Collects the updatable fields present in $data. */
function documentUpdateFields(array $data): array {
    $fields = [];
    foreach (['name', 'filename', 'category', 'description'] as $key) {
        if (isset($data[$key])) $fields[$key] = trim((string)$data[$key]);
    }
    if (isset($data['filepath'])) {
        $filepath = trim((string)$data['filepath']);
        if (!validDocumentPath($filepath)) jsonError('Ungültiger Dateipfad', 400);
        $fields['filepath'] = $filepath;
    }
    if (isset($data['file_size'])) $fields['file_size'] = (int)$data['file_size'];
    if (isset($data['is_active'])) $fields['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    return $fields;
}

function updateDocument(PDO $pdo, array $user, int $id, array $data): void {
    $before = auditFetchRow($pdo, 'documents', $id);
    if (!$before) jsonError('Document not found', 404);

    $fields = documentUpdateFields($data);
    if (!$fields) jsonError('No fields to update', 400);

    guardWrite($pdo, 'documents', $id, $user, $data['expected_updated_at'] ?? null);
    $assignments = array_map(fn($column) => "`$column` = ?", array_keys($fields));
    $assignments[] = 'updated_by = ?';
    $stmt = $pdo->prepare('UPDATE documents SET ' . implode(', ', $assignments) . ' WHERE id = ?');
    $stmt->execute(array_merge(array_values($fields), [$user['username'], $id]));
    auditLog($pdo, $user, 'documents', $id, 'update', $before, auditFetchRow($pdo, 'documents', $id));
    jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
}

if ($method === 'GET') {
    if ($action === 'scan') {
        $scanPath = trim((string)($_GET['path'] ?? ''), '/');
        if ($scanPath === '') jsonError('Path is required for scanning', 400);
        $targetDir = resolveUploadDir($uploadBaseDir, $scanPath);
        if (!is_dir($targetDir)) {
            jsonResponse(['success' => true, 'files' => [], 'scanned_path' => '/docs/' . $scanPath, 'message' => 'Directory does not exist']);
        }
        $files = array_map(fn($file) => [
            'filepath' => '/docs/' . $file['path'],
            'filename' => $file['name'],
            'size' => $file['size'],
        ], listFilesRecursive($targetDir, $scanPath));
        jsonResponse(['success' => true, 'files' => $files, 'scanned_path' => '/docs/' . $scanPath, 'file_count' => count($files)]);
    }

    $docId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($docId) {
        $stmt = $pdo->prepare('SELECT ' . DOCUMENT_COLUMNS . ' FROM documents WHERE id = ? LIMIT 1');
        $stmt->execute([$docId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Document not found', 404);
        jsonResponse($row);
    }

    $sql = 'SELECT ' . DOCUMENT_COLUMNS . ' FROM documents WHERE 1=1';
    $params = [];
    if (isset($_GET['active_only']) && filter_var($_GET['active_only'], FILTER_VALIDATE_BOOLEAN)) {
        $sql .= ' AND is_active = 1';
    }
    $category = trim((string)($_GET['category'] ?? ''));
    if ($category !== '') {
        $sql .= ' AND category = ?';
        $params[] = $category;
    }
    $search = trim((string)($_GET['search'] ?? ''));
    if ($search !== '') {
        $sql .= ' AND (name LIKE ? OR filename LIKE ? OR description LIKE ?)';
        $like = '%' . addcslashes($search, '%_\\') . '%';
        array_push($params, $like, $like, $like);
    }
    $stmt = $pdo->prepare($sql . ' ORDER BY name ASC LIMIT 200');
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST' && !empty($_FILES) && ($_POST['action'] ?? '') === 'upload') {
    $category = trim((string)($_POST['category'] ?? 'sonstiges'), '/');
    $targetDir = resolveUploadDir($uploadBaseDir, $category);
    [$stored, $errors] = storeUploadedFiles($targetDir, DOCUMENT_EXTENSIONS, function (string $base, string $extension) {
        $safeBase = substr(preg_replace('/[^a-zA-Z0-9_\-]/', '_', $base), 0, 100) ?: 'datei';
        return $safeBase . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $extension;
    });
    $files = array_map(fn($file) => [
        'filepath' => '/docs/' . $category . '/' . $file['name'],
        'filename' => $file['original'],
        'size' => $file['size'],
        'category' => $category,
    ], $stored);
    jsonResponse([
        'success' => true,
        'files' => $files,
        'errors' => $errors,
        'uploaded_count' => count($files),
        'target_path' => '/docs/' . $category,
    ]);
}

if ($method === 'POST') {
    $data = requestBody();
    $id = isset($data['id']) && $data['id'] !== '' && $data['id'] !== null ? (int)$data['id'] : null;
    if ($id !== null) {
        updateDocument($pdo, $user, $id, $data);
    }

    $name = trim((string)($data['name'] ?? ''));
    $filepath = trim((string)($data['filepath'] ?? ''));
    $filename = trim((string)($data['filename'] ?? '')) ?: basename($filepath);
    $category = isset($data['category']) ? trim((string)$data['category']) : null;
    $description = isset($data['description']) ? trim((string)$data['description']) : null;
    $fileSize = isset($data['file_size']) ? (int)$data['file_size'] : null;
    $isActive = isset($data['is_active']) ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) : true;

    if ($name === '' || $filepath === '') {
        jsonError('Missing required fields: name and filepath', 400);
    }
    if (!validDocumentPath($filepath)) {
        jsonError('Ungültiger Dateipfad', 400);
    }

    $newId = insertWithNextId($pdo, 'documents', function (int $newId) use ($pdo, $name, $filename, $filepath, $category, $description, $fileSize, $isActive, $user) {
        $stmt = $pdo->prepare('INSERT INTO documents (id, name, filename, filepath, category, description, file_size, is_active, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $name, $filename, $filepath, $category, $description, $fileSize, $isActive ? 1 : 0, $user['username']]);
    });
    auditLog($pdo, $user, 'documents', $newId, 'create', null, auditFetchRow($pdo, 'documents', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'PATCH' || $method === 'PUT') {
    $data = requestBody();
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if (!$id) jsonError('Missing id for update', 400);
    updateDocument($pdo, $user, $id, $data);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    $hardDelete = isset($data['hard']) && filter_var($data['hard'], FILTER_VALIDATE_BOOLEAN);
    if (!$id) jsonError('Missing id for deletion', 400);

    $before = auditFetchRow($pdo, 'documents', $id);
    if (!$before) jsonError('Document not found', 404);
    guardWrite($pdo, 'documents', $id, $user, $data['expected_updated_at'] ?? null);

    if ($hardDelete) {
        $stmt = $pdo->prepare('DELETE FROM documents WHERE id = ?');
        $stmt->execute([$id]);
        $fileRemoved = false;
        if ($stmt->rowCount()) {
            // Only delete the file when no other document still references it.
            $refs = $pdo->prepare('SELECT COUNT(*) FROM documents WHERE filepath = ?');
            $refs->execute([$before['filepath'] ?? '']);
            if ((int)$refs->fetchColumn() === 0) {
                $fileRemoved = removeFileBelow($before['filepath'] ?? null, 'docs', $uploadBaseDir, true);
            }
            auditLog($pdo, $user, 'documents', $id, 'delete', [
                'document' => $before,
                'file_path' => $before['filepath'] ?? null,
                'file_removed' => $fileRemoved,
            ], null);
        }
        jsonResponse(['success' => true, 'message' => 'Permanently deleted', 'id' => $id, 'file_removed' => $fileRemoved]);
    }

    $stmt = $pdo->prepare('UPDATE documents SET is_active = 0, updated_by = ? WHERE id = ?');
    $stmt->execute([$user['username'], $id]);
    if ($stmt->rowCount()) {
        auditLog($pdo, $user, 'documents', $id, 'deactivate', [
            'document' => $before,
            'file_path' => $before['filepath'] ?? null,
        ], auditFetchRow($pdo, 'documents', $id));
    }
    jsonResponse(['success' => true, 'message' => 'Document deactivated', 'id' => $id]);
}

jsonError('Method not allowed', 405);
