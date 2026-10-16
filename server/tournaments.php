<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const TOURNAMENT_COLUMNS = 'id, type, year, first, second, third, updated_at, updated_by';
const TOURNAMENT_TYPES = ['vereinsmeister', 'pokalsieger', 'nikolausblitz', 'blitzsieger'];

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];
$user = null;
if ($method !== 'GET') {
    $user = requireEditor();
}

if ($method === 'GET') {
    $tournamentId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $typeFilter = $_GET['type'] ?? null;
    if ($tournamentId) {
        $stmt = $pdo->prepare('SELECT ' . TOURNAMENT_COLUMNS . ' FROM tournaments WHERE id = ? LIMIT 1');
        $stmt->execute([$tournamentId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    if ($typeFilter) {
        if (!in_array($typeFilter, TOURNAMENT_TYPES, true)) jsonError('Invalid tournament type', 400);
        $stmt = $pdo->prepare('SELECT ' . TOURNAMENT_COLUMNS . ' FROM tournaments WHERE type = ? ORDER BY year DESC LIMIT 100');
        $stmt->execute([$typeFilter]);
    } else {
        $stmt = $pdo->query('SELECT ' . TOURNAMENT_COLUMNS . ' FROM tournaments ORDER BY year DESC, type ASC LIMIT 100');
    }
    echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $data = requestBody();
    $id = isset($data['id']) && $data['id'] !== '' && $data['id'] !== null ? (int)$data['id'] : null;
    $type = trim((string)($data['type'] ?? ''));
    $year = trim((string)($data['year'] ?? ''));
    $first = trim((string)($data['first'] ?? ''));
    $second = trim((string)($data['second'] ?? ''));
    $third = trim((string)($data['third'] ?? ''));

    if (!in_array($type, TOURNAMENT_TYPES, true)) {
        jsonError('Invalid tournament type', 400);
    }
    if ($year === '' || $first === '') {
        jsonError('Missing required fields: type, year, and first', 400);
    }

    if ($id !== null) {
        $before = auditFetchRow($pdo, 'tournaments', $id);
        if (!$before) jsonError('Turnier nicht gefunden', 404);
        guardWrite($pdo, 'tournaments', $id, $user, $data['expected_updated_at'] ?? null);
        $stmt = $pdo->prepare('UPDATE tournaments SET type = ?, year = ?, first = ?, second = ?, third = ?, updated_by = ? WHERE id = ?');
        $stmt->execute([$type, $year, $first, $second, $third, $user['username'], $id]);
        auditLog($pdo, $user, 'tournaments', $id, 'update', $before, auditFetchRow($pdo, 'tournaments', $id));
        jsonResponse(['success' => true, 'message' => 'Updated', 'id' => $id]);
    }

    $newId = insertWithNextId($pdo, 'tournaments', function (int $newId) use ($pdo, $type, $year, $first, $second, $third, $user) {
        $stmt = $pdo->prepare('INSERT INTO tournaments (id, type, year, first, second, third, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$newId, $type, $year, $first, $second, $third, $user['username']]);
    });
    auditLog($pdo, $user, 'tournaments', $newId, 'create', null, auditFetchRow($pdo, 'tournaments', $newId));
    jsonResponse(['success' => true, 'message' => 'Created', 'id' => $newId]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if (!$id) jsonError('Missing id for deletion', 400);

    $before = auditFetchRow($pdo, 'tournaments', $id);
    if (!$before) jsonError('Turnier nicht gefunden', 404);
    guardWrite($pdo, 'tournaments', $id, $user, $data['expected_updated_at'] ?? null);
    $stmt = $pdo->prepare('DELETE FROM tournaments WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount()) auditLog($pdo, $user, 'tournaments', $id, 'delete', $before, null);
    jsonResponse(['success' => true, 'message' => 'Deleted', 'id' => $id]);
}

jsonError('Method not allowed', 405);
