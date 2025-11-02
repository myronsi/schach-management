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
$tournamentId = isset($input['id']) ? (int)$input['id'] : null;
$typeFilter = isset($input['type']) ? trim($input['type']) : null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if ($tournamentId) {
            $stmt = $pdo->prepare('SELECT id, type, year, first, second, third FROM tournaments WHERE id = ? LIMIT 1');
            $stmt->execute([$tournamentId]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        if ($typeFilter) {
            $validTypes = ['vereinsmeister', 'pokalsieger', 'nikolausblitz', 'blitzsieger'];
            if (!in_array($typeFilter, $validTypes)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid tournament type']);
                exit;
            }
            $stmt = $pdo->prepare('SELECT id, type, year, first, second, third FROM tournaments WHERE type = ? ORDER BY year DESC LIMIT 100');
            $stmt->execute([$typeFilter]);
        } else {
            $stmt = $pdo->query('SELECT id, type, year, first, second, third FROM tournaments ORDER BY year DESC, type ASC LIMIT 100');
        }
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) && $data['id'] !== '' ? (int)$data['id'] : null;
        $type = trim($data['type'] ?? '');
        $year = trim($data['year'] ?? '');
        $first = trim($data['first'] ?? '');
        $second = isset($data['second']) ? trim((string)$data['second']) : '';
        $third = isset($data['third']) ? trim((string)$data['third']) : '';

        $validTypes = ['vereinsmeister', 'pokalsieger', 'nikolausblitz', 'blitzsieger'];
        if (!in_array($type, $validTypes)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid tournament type']);
            exit;
        }

        if ($type === '' || $year === '' || $first === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: type, year, and first']);
            exit;
        }

        if ($id) {
            $check = $pdo->prepare('SELECT id FROM tournaments WHERE id = ? LIMIT 1');
            $check->execute([$id]);
            $exists = (bool)$check->fetch();

            if ($exists) {
                $stmt = $pdo->prepare('UPDATE tournaments SET type = ?, year = ?, first = ?, second = ?, third = ? WHERE id = ?');
                $stmt->execute([$type, $year, $first, $second, $third, $id]);
                echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
                exit;
            } else {
                $stmt = $pdo->prepare('INSERT INTO tournaments (id, type, year, first, second, third) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $type, $year, $first, $second, $third]);
                echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
                exit;
            }
        } else {
            $stmt = $pdo->prepare('INSERT INTO tournaments (type, year, first, second, third) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$type, $year, $first, $second, $third]);
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

        $stmt = $pdo->prepare('DELETE FROM tournaments WHERE id = ?');
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
