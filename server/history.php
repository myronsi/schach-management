<?php

require_once __DIR__ . '/auth-middleware.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
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
$historyId = $input['id'] ?? null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];


    if ($method === 'POST' || $method === 'DELETE' || $method === 'PUT' || $method === 'PATCH') {
        $user = requireAuthentication(['admin']);
        error_log("Authenticated user '{$user['username']}' performing $method operation on history");
    }

    if ($method === 'GET') {
        if ($historyId) {
            $stmt = $pdo->prepare('SELECT id, date, text FROM history WHERE id = ? LIMIT 1');
            $stmt->execute([$historyId]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        $stmt = $pdo->query('SELECT id, date, text FROM history ORDER BY date DESC LIMIT 100');
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) ? trim((string)$data['id']) : '';
        $date = isset($data['date']) ? trim((string)$data['date']) : '';
        $text = isset($data['text']) ? trim((string)$data['text']) : '';

        if ($id === '' || $date === '' || $text === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: id, date, and text']);
            exit;
        }

        $check = $pdo->prepare('SELECT id FROM history WHERE id = ? LIMIT 1');
        $check->execute([$id]);
        $exists = (bool)$check->fetch();

        if ($exists) {
            $stmt = $pdo->prepare('UPDATE history SET date = ?, text = ? WHERE id = ?');
            $stmt->execute([$date, $text, $id]);
            echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
            exit;
        } else {
            $stmt = $pdo->prepare('INSERT INTO history (id, date, text) VALUES (?, ?, ?)');
            $stmt->execute([$id, $date, $text]);
            echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
            exit;
        }
    }

    if ($method === 'DELETE') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_GET;

        $id = isset($data['id']) ? trim((string)$data['id']) : '';

        if ($id === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id for deletion']);
            exit;
        }

        $stmt = $pdo->prepare('DELETE FROM history WHERE id = ?');
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
