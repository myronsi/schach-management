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
$infoId = isset($input['id']) ? (int)$input['id'] : null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST' || $method === 'DELETE' || $method === 'PUT' || $method === 'PATCH') {
        $user = requireAuthentication(['admin']);
        error_log("Authenticated user '{$user['username']}' performing $method operation on fastinfo");
    }

    if ($method === 'GET') {
        if ($infoId) {
            $stmt = $pdo->prepare('SELECT id, icon, label, targetValue, delay FROM fastinfo WHERE id = ? LIMIT 1');
            $stmt->execute([$infoId]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        $stmt = $pdo->query('SELECT id, icon, label, targetValue, delay FROM fastinfo ORDER BY delay ASC LIMIT 100');
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) && $data['id'] !== '' ? (int)$data['id'] : null;
        $icon = trim($data['icon'] ?? '');
        $label = trim($data['label'] ?? '');
        $targetValue = isset($data['targetValue']) ? (int)$data['targetValue'] : 0;
        $delay = isset($data['delay']) ? (int)$data['delay'] : 0;

        if ($icon === '' || $label === '' || $targetValue <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: icon, label, and targetValue (must be > 0)']);
            exit;
        }

        if ($id) {
            $check = $pdo->prepare('SELECT id FROM fastinfo WHERE id = ? LIMIT 1');
            $check->execute([$id]);
            $exists = (bool)$check->fetch();

            if ($exists) {
                $stmt = $pdo->prepare('UPDATE fastinfo SET icon = ?, label = ?, targetValue = ?, delay = ? WHERE id = ?');
                $stmt->execute([$icon, $label, $targetValue, $delay, $id]);
                echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
                exit;
            } else {
                $stmt = $pdo->prepare('INSERT INTO fastinfo (id, icon, label, targetValue, delay) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([$id, $icon, $label, $targetValue, $delay]);
                echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
                exit;
            }
        } else {
            $stmt = $pdo->prepare('INSERT INTO fastinfo (icon, label, targetValue, delay) VALUES (?, ?, ?, ?)');
            $stmt->execute([$icon, $label, $targetValue, $delay]);
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

        $stmt = $pdo->prepare('DELETE FROM fastinfo WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Deleted', 'id' => $id]);
        exit;
    }

    // If method not handled
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
