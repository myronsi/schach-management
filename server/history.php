<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const HISTORY_COLUMNS = 'id, date, text, updated_at, updated_by';

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$user = null;
if ($method !== 'GET') {
    $user = requireEditor();
}

/** History ids are string timestamps in milliseconds (legacy format, kept for compatibility). */
function newHistoryId(PDO $pdo): string {
    $check = $pdo->prepare('SELECT 1 FROM history WHERE id = ? LIMIT 1');
    $base = (int)floor(microtime(true) * 1000);
    for ($i = 0; $i < 5; $i++) {
        $candidate = (string)($base + $i);
        $check->execute([$candidate]);
        if (!$check->fetch()) return $candidate;
    }
    return $base . random_int(100, 999);
}

if ($method === 'GET') {
    $historyId = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
    if ($historyId !== '') {
        $stmt = $pdo->prepare('SELECT ' . HISTORY_COLUMNS . ' FROM history WHERE id = ? LIMIT 1');
        $stmt->execute([$historyId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $rows = $pdo->query('SELECT ' . HISTORY_COLUMNS . ' FROM history ORDER BY date DESC LIMIT 100')->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $data = requestBody();
    $id = isset($data['id']) && $data['id'] !== null ? trim((string)$data['id']) : '';
    $date = trim((string)($data['date'] ?? ''));
    $text = trim((string)($data['text'] ?? ''));

    if ($date === '' || $text === '') {
        jsonError('Missing required fields: date and text', 400);
    }

    if ($id !== '') {
        $before = auditFetchRow($pdo, 'history', $id);
        if (!$before) jsonError('Eintrag nicht gefunden', 404);
        guardWrite($pdo, 'history', $id, $user, $data['expected_updated_at'] ?? null);
        $stmt = $pdo->prepare('UPDATE history SET date = ?, text = ?, updated_by = ? WHERE id = ?');
        $stmt->execute([$date, $text, $user['username'], $id]);
        auditLog($pdo, $user, 'history', $id, 'update', $before, auditFetchRow($pdo, 'history', $id));
        jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
    }

    $newId = newHistoryId($pdo);
    $stmt = $pdo->prepare('INSERT INTO history (id, date, text, updated_by) VALUES (?, ?, ?, ?)');
    $stmt->execute([$newId, $date, $text, $user['username']]);
    auditLog($pdo, $user, 'history', $newId, 'create', null, auditFetchRow($pdo, 'history', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? trim((string)$data['id']) : '';
    if ($id === '') jsonError('Missing id for deletion', 400);

    $before = auditFetchRow($pdo, 'history', $id);
    if (!$before) jsonError('Eintrag nicht gefunden', 404);
    guardWrite($pdo, 'history', $id, $user, $data['expected_updated_at'] ?? null);
    $stmt = $pdo->prepare('DELETE FROM history WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount()) auditLog($pdo, $user, 'history', $id, 'delete', $before, null);
    jsonResponse(['success' => true, 'message' => 'Deleted', 'id' => $id]);
}

jsonError('Method not allowed', 405);
