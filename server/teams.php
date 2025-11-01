<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT, PATCH');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: false');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $env = parse_ini_file($envFile);

$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;

$input = $_GET;
$teamId = isset($input['id']) ? (int)$input['id'] : null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if ($teamId) {
            $stmt = $pdo->prepare('SELECT id, name, league, image, url, captain, contact, nextMatch, venue, record, squad, notes, founded FROM teams WHERE id = ? LIMIT 1');
            $stmt->execute([$teamId]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        $stmt = $pdo->query('SELECT id, name, league, image, url, captain, contact, nextMatch, venue, record, squad, notes, founded FROM teams ORDER BY name ASC LIMIT 100');
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) && $data['id'] !== '' ? (int)$data['id'] : null;
        $name = trim($data['name'] ?? '');
        $league = trim($data['league'] ?? '');
        $image = isset($data['image']) ? trim((string)$data['image']) : '';
        $url = isset($data['url']) ? trim((string)$data['url']) : '';
        $captain = isset($data['captain']) ? trim((string)$data['captain']) : '';
        $contact = isset($data['contact']) ? trim((string)$data['contact']) : '';
        $nextMatch = isset($data['nextMatch']) ? trim((string)$data['nextMatch']) : '';
        $venue = isset($data['venue']) ? trim((string)$data['venue']) : '';
        $record = isset($data['record']) ? $data['record'] : '{}';
        $squad = isset($data['squad']) ? $data['squad'] : '[]';
        $notes = isset($data['notes']) ? trim((string)$data['notes']) : '';
        $founded = isset($data['founded']) && $data['founded'] !== '' ? (int)$data['founded'] : 0;

        if (is_array($record)) $record = json_encode($record);
        if (is_array($squad)) $squad = json_encode($squad);

        if ($name === '' || $league === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: name and league']);
            exit;
        }

        if ($id) {
            $check = $pdo->prepare('SELECT id FROM teams WHERE id = ? LIMIT 1');
            $check->execute([$id]);
            $exists = (bool)$check->fetch();

            if ($exists) {
                $stmt = $pdo->prepare('UPDATE teams SET name = ?, league = ?, image = ?, url = ?, captain = ?, contact = ?, nextMatch = ?, venue = ?, record = ?, squad = ?, notes = ?, founded = ? WHERE id = ?');
                $stmt->execute([$name, $league, $image, $url, $captain, $contact, $nextMatch, $venue, $record, $squad, $notes, $founded, $id]);
                echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
                exit;
            } else {
                $stmt = $pdo->prepare('INSERT INTO teams (id, name, league, image, url, captain, contact, nextMatch, venue, record, squad, notes, founded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $name, $league, $image, $url, $captain, $contact, $nextMatch, $venue, $record, $squad, $notes, $founded]);
                echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
                exit;
            }
        } else {
            $stmt = $pdo->prepare('INSERT INTO teams (name, league, image, url, captain, contact, nextMatch, venue, record, squad, notes, founded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$name, $league, $image, $url, $captain, $contact, $nextMatch, $venue, $record, $squad, $notes, $founded]);
            $newId = (int)$pdo->lastInsertId();
            echo json_encode(['success' => true, 'message' => 'Created', 'id' => $newId]);
            exit;
        }
    }

    if ($method === 'DELETE') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_GET;

        $id = isset($data['id']) ? (int)$data['id'] : null;

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id for deletion']);
            exit;
        }

        $stmt = $pdo->prepare('DELETE FROM teams WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Deleted', 'id' => $id]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
