<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const TEAM_COLUMNS = 'id, name, league, image, url, captain, contact, nextMatch, venue, record, squad, notes, founded, updated_at, updated_by';
const TEAM_DESCRIPTION_ID = 0; // row 0 holds the rich-text description of the teams page

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$user = null;
if ($method !== 'GET') {
    $user = requireEditor();
}

/** Accepts a JSON string or array and returns normalised JSON, or null when invalid. */
function normalizeJson($value, string $default): ?string {
    if ($value === null || $value === '') return $default;
    if (is_array($value)) return json_encode($value, JSON_UNESCAPED_UNICODE);
    if (!is_string($value)) return null;
    $decoded = json_decode($value, true);
    return json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? json_encode($decoded, JSON_UNESCAPED_UNICODE) : null;
}

if ($method === 'GET') {
    $teamId = isset($_GET['id']) && $_GET['id'] !== '' ? (int)$_GET['id'] : null;
    if ($teamId === TEAM_DESCRIPTION_ID) {
        $stmt = $pdo->prepare('SELECT id, name, text, updated_at, updated_by FROM teams WHERE id = 0 LIMIT 1');
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    if ($teamId) {
        $stmt = $pdo->prepare('SELECT ' . TEAM_COLUMNS . ' FROM teams WHERE id = ? LIMIT 1');
        $stmt->execute([$teamId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $rows = $pdo->query('SELECT ' . TEAM_COLUMNS . ' FROM teams WHERE id != 0 ORDER BY name ASC LIMIT 100')->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $data = requestBody();
    $id = isset($data['id']) && $data['id'] !== '' && $data['id'] !== null ? (int)$data['id'] : null;

    if ($id === TEAM_DESCRIPTION_ID) {
        $name = trim((string)($data['name'] ?? ''));
        $text = sanitizeHtml($data['text'] ?? '');
        if ($name === '') jsonError('Missing required field: name', 400);

        $before = auditFetchRow($pdo, 'teams', 0);
        if ($before) {
            guardWrite($pdo, 'teams', 0, $user, $data['expected_updated_at'] ?? null);
            $stmt = $pdo->prepare('UPDATE teams SET name = ?, text = ?, updated_by = ? WHERE id = 0');
            $stmt->execute([$name, $text, $user['username']]);
            auditLog($pdo, $user, 'teams', 0, 'update', $before, auditFetchRow($pdo, 'teams', 0));
        } else {
            $stmt = $pdo->prepare('INSERT INTO teams (id, name, text, updated_by) VALUES (0, ?, ?, ?)');
            $stmt->execute([$name, $text, $user['username']]);
            auditLog($pdo, $user, 'teams', 0, 'create', null, auditFetchRow($pdo, 'teams', 0));
        }
        jsonResponse(['success' => true, 'message' => 'Description updated', 'id' => 0]);
    }

    $fields = [
        trim((string)($data['name'] ?? '')),
        trim((string)($data['league'] ?? '')),
        sanitizeUrl($data['image'] ?? ''),
        sanitizeUrl($data['url'] ?? ''),
        trim((string)($data['captain'] ?? '')),
        trim((string)($data['contact'] ?? '')),
        trim((string)($data['nextMatch'] ?? '')),
        trim((string)($data['venue'] ?? '')),
        normalizeJson($data['record'] ?? null, '{}'),
        normalizeJson($data['squad'] ?? null, '[]'),
        trim((string)($data['notes'] ?? '')),
        isset($data['founded']) && $data['founded'] !== '' ? (int)$data['founded'] : 0,
    ];
    [$name, $league, , , , , , , $record, $squad] = $fields;
    if ($name === '' || $league === '') {
        jsonError('Missing required fields: name and league', 400);
    }
    if ($record === null || $squad === null) {
        jsonError('Invalid JSON in record or squad', 400);
    }

    if ($id !== null) {
        $before = auditFetchRow($pdo, 'teams', $id);
        if (!$before) jsonError('Team not found', 404);
        guardWrite($pdo, 'teams', $id, $user, $data['expected_updated_at'] ?? null);
        $stmt = $pdo->prepare('UPDATE teams SET name = ?, league = ?, image = ?, url = ?, captain = ?, contact = ?, nextMatch = ?, venue = ?, record = ?, squad = ?, notes = ?, founded = ?, updated_by = ? WHERE id = ?');
        $stmt->execute(array_merge($fields, [$user['username'], $id]));
        auditLog($pdo, $user, 'teams', $id, 'update', $before, auditFetchRow($pdo, 'teams', $id));
        jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
    }

    $newId = insertWithNextId($pdo, 'teams', function (int $newId) use ($pdo, $fields, $user) {
        $stmt = $pdo->prepare('INSERT INTO teams (id, name, league, image, url, captain, contact, nextMatch, venue, record, squad, notes, founded, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute(array_merge([$newId], $fields, [$user['username']]));
    });
    auditLog($pdo, $user, 'teams', $newId, 'create', null, auditFetchRow($pdo, 'teams', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if (!$id) jsonError('Missing id for deletion', 400);

    $before = auditFetchRow($pdo, 'teams', $id);
    if (!$before) jsonError('Team not found', 404);
    guardWrite($pdo, 'teams', $id, $user, $data['expected_updated_at'] ?? null);
    $stmt = $pdo->prepare('DELETE FROM teams WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount()) auditLog($pdo, $user, 'teams', $id, 'delete', $before, null);
    jsonResponse(['success' => true, 'message' => 'Deleted', 'id' => $id]);
}

jsonError('Method not allowed', 405);
