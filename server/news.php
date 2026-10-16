<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const NEWS_LIST_COLUMNS = 'id, slug, title, description, date, image, updated_at, updated_by';

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$user = null;
if ($method !== 'GET') {
    $user = requireEditor();
}

if ($method === 'GET') {
    $slug = $_GET['slug'] ?? null;
    if (is_string($slug) && $slug !== '') {
        $stmt = $pdo->prepare('SELECT id, slug, title, description, content, date, image, link, updated_at, updated_by FROM news WHERE slug = ? LIMIT 1');
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $q = $_GET['q'] ?? '';
    if (is_string($q) && trim($q) !== '') {
        $like = '%' . addcslashes(trim($q), '%_\\') . '%';
        $stmt = $pdo->prepare('SELECT ' . NEWS_LIST_COLUMNS . ' FROM news WHERE title LIKE ? OR description LIKE ? ORDER BY date DESC LIMIT 50');
        $stmt->execute([$like, $like]);
    } else {
        $stmt = $pdo->query('SELECT ' . NEWS_LIST_COLUMNS . ' FROM news ORDER BY date DESC LIMIT 50');
    }
    echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
    exit;
}

function slugTaken(PDO $pdo, string $slug, ?int $exceptId): bool {
    $stmt = $pdo->prepare('SELECT id FROM news WHERE slug = ? AND id <> ? LIMIT 1');
    $stmt->execute([$slug, $exceptId ?? 0]);
    return (bool)$stmt->fetch();
}

if ($method === 'POST') {
    $data = requestBody();

    $id = isset($data['id']) && $data['id'] !== '' && $data['id'] !== null ? (int)$data['id'] : null;
    $slug = trim((string)($data['slug'] ?? ''));
    $title = trim((string)($data['title'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    $content = sanitizeHtml(isset($data['content']) ? (string)$data['content'] : '');
    $date = trim((string)($data['date'] ?? '')) ?: date('Y-m-d H:i:s');
    $image = sanitizeUrl($data['image'] ?? '');
    $link = sanitizeUrl($data['link'] ?? '');

    if ($slug === '' || $title === '') {
        jsonError('Missing required fields: slug and title', 400);
    }
    if (!preg_match('~^[^\s/?#%<>"\'\\\\]+$~u', $slug) || mb_strlen($slug) > 200) {
        jsonError('Der Slug darf keine Leerzeichen oder Sonderzeichen wie / ? # % enthalten', 400);
    }
    if (strtotime($date) === false) {
        jsonError('Ungültiges Datum', 400);
    }
    if (slugTaken($pdo, $slug, $id)) {
        jsonError('Slug existiert bereits', 409, ['code' => 'slug_exists']);
    }

    if ($id !== null) {
        $before = auditFetchRow($pdo, 'news', $id);
        if (!$before) jsonError('News not found', 404);
        guardWrite($pdo, 'news', $id, $user, $data['expected_updated_at'] ?? null);
        $stmt = $pdo->prepare('UPDATE news SET slug = ?, title = ?, description = ?, content = ?, date = ?, image = ?, link = ?, updated_by = ? WHERE id = ?');
        $stmt->execute([$slug, $title, $description, $content, $date, $image, $link, $user['username'], $id]);
        auditLog($pdo, $user, 'news', $id, 'update', $before, auditFetchRow($pdo, 'news', $id));
        jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
    }

    $newId = insertWithNextId($pdo, 'news', function (int $newId) use ($pdo, $slug, $title, $description, $content, $date, $image, $link, $user) {
        $stmt = $pdo->prepare('INSERT INTO news (id, slug, title, description, content, date, image, link, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $slug, $title, $description, $content, $date, $image, $link, $user['username']]);
    });
    auditLog($pdo, $user, 'news', $newId, 'create', null, auditFetchRow($pdo, 'news', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    $slug = isset($data['slug']) ? trim((string)$data['slug']) : '';

    if (!$id && $slug !== '') {
        $stmt = $pdo->prepare('SELECT id FROM news WHERE slug = ? LIMIT 1');
        $stmt->execute([$slug]);
        $id = (int)($stmt->fetchColumn() ?: 0);
        if (!$id) jsonError('News not found', 404);
    }
    if (!$id) {
        jsonError('Missing id or slug for deletion', 400);
    }

    $before = auditFetchRow($pdo, 'news', $id);
    if (!$before) jsonError('News not found', 404);
    guardWrite($pdo, 'news', $id, $user, $data['expected_updated_at'] ?? null);
    $stmt = $pdo->prepare('DELETE FROM news WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount()) auditLog($pdo, $user, 'news', $id, 'delete', $before, null);
    jsonResponse(['success' => true, 'message' => 'Deleted', 'id' => $id]);
}

jsonError('Method not allowed', 405);
