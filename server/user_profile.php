<?php

require_once __DIR__ . '/common.php';

sendCorsHeaders(['GET', 'PUT']);

$method = $_SERVER['REQUEST_METHOD'];
$claims = requireAuthentication(['user', 'admin', 'chairman']);
$username = $claims['username'];
$pdo = authDb();

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT username, email, first_name, last_name, notify_events FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    if (!$row) jsonError('Benutzer nicht gefunden', 404);
    jsonResponse(array_merge(['success' => true], $row));
}

if ($method === 'PUT') {
    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) {
        jsonError('Ungültiger Anfragekörper', 400);
    }

    $fields = [];
    $params = [];

    if (array_key_exists('email', $data) && $data['email'] !== null) {
        $email = trim((string)$data['email']);
        if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 254)) {
            jsonError('Ungültige E-Mail-Adresse', 400);
        }
        $fields[] = '`email` = ?';
        $params[] = $email;
    }
    if (array_key_exists('notify_events', $data) && $data['notify_events'] !== null) {
        $fields[] = '`notify_events` = ?';
        $params[] = (int)$data['notify_events'] ? 1 : 0;
    }

    if (!$fields) {
        jsonError('Keine zu aktualisierenden Felder', 200);
    }

    $params[] = $username;
    $upd = $pdo->prepare('UPDATE `users` SET ' . implode(', ', $fields) . ' WHERE `username` = ?');
    $upd->execute($params);
    jsonResponse(['success' => true, 'message' => 'Profil aktualisiert']);
}

jsonError('Methode nicht erlaubt', 405);
