<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const FASTINFO_COLUMNS = 'id, icon, label, targetValue, delay, updated_at, updated_by';

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$user = null;
if ($method !== 'GET') {
    $user = requireEditor();
}

if ($method === 'GET') {
    $infoId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($infoId) {
        $stmt = $pdo->prepare('SELECT ' . FASTINFO_COLUMNS . ' FROM fastinfo WHERE id = ? LIMIT 1');
        $stmt->execute([$infoId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $rows = $pdo->query('SELECT ' . FASTINFO_COLUMNS . ' FROM fastinfo ORDER BY delay ASC LIMIT 100')->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $data = requestBody();
    $id = isset($data['id']) && $data['id'] !== '' && $data['id'] !== null ? (int)$data['id'] : null;
    $icon = trim((string)($data['icon'] ?? ''));
    $label = trim((string)($data['label'] ?? ''));
    $targetValue = isset($data['targetValue']) ? (int)$data['targetValue'] : 0;
    $delay = isset($data['delay']) ? (int)$data['delay'] : 0;

    if ($icon === '' || $label === '' || $targetValue <= 0) {
        jsonError('Missing required fields: icon, label, and targetValue (must be > 0)', 400);
    }

    if ($id !== null) {
        $before = auditFetchRow($pdo, 'fastinfo', $id);
        if (!$before) jsonError('Eintrag nicht gefunden', 404);
        guardWrite($pdo, 'fastinfo', $id, $user, $data['expected_updated_at'] ?? null);
        $stmt = $pdo->prepare('UPDATE fastinfo SET icon = ?, label = ?, targetValue = ?, delay = ?, updated_by = ? WHERE id = ?');
        $stmt->execute([$icon, $label, $targetValue, $delay, $user['username'], $id]);
        auditLog($pdo, $user, 'fastinfo', $id, 'update', $before, auditFetchRow($pdo, 'fastinfo', $id));
        jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
    }

    $newId = insertWithNextId($pdo, 'fastinfo', function (int $newId) use ($pdo, $icon, $label, $targetValue, $delay, $user) {
        $stmt = $pdo->prepare('INSERT INTO fastinfo (id, icon, label, targetValue, delay, updated_by) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $icon, $label, $targetValue, $delay, $user['username']]);
    });
    auditLog($pdo, $user, 'fastinfo', $newId, 'create', null, auditFetchRow($pdo, 'fastinfo', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if (!$id) jsonError('Missing id for deletion', 400);

    $before = auditFetchRow($pdo, 'fastinfo', $id);
    if (!$before) jsonError('Eintrag nicht gefunden', 404);
    guardWrite($pdo, 'fastinfo', $id, $user, $data['expected_updated_at'] ?? null);
    $stmt = $pdo->prepare('DELETE FROM fastinfo WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount()) auditLog($pdo, $user, 'fastinfo', $id, 'delete', $before, null);
    jsonResponse(['success' => true, 'message' => 'Deleted', 'id' => $id]);
}

jsonError('Method not allowed', 405);
