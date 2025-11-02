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

$host = $env['host'] ?? '';
$user = $env['user'] ?? '';
$password = $env['password'] ?? '';
$database = $env['database'] ?? '';
$port = isset($env['port']) ? (int)$env['port'] : 3306;

$input = $_GET;
$username = $input['username'] ?? null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if ($username) {
            $stmt = $pdo->prepare('SELECT username, status, session_id, session_ip, password_status FROM users WHERE username = ? LIMIT 1');
            $stmt->execute([$username]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        $stmt = $pdo->query('SELECT username, status, session_id, session_ip, password_status FROM users ORDER BY username ASC');
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $usernameValue = trim($data['username'] ?? '');
        $passwordValue = trim($data['password'] ?? '');
        $statusValue = trim($data['status'] ?? 'user');
        $passwordStatusValue = trim($data['password_status'] ?? 'unchanged');
        $sessionId = $data['session_id'] ?? null;
        $sessionIp = $data['session_ip'] ?? null;
        
        $isUpdate = isset($data['is_update']) && $data['is_update'] === true;

        if ($usernameValue === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required field: username']);
            exit;
        }

        $check = $pdo->prepare('SELECT username, password FROM users WHERE username = ? LIMIT 1');
        $check->execute([$usernameValue]);
        $exists = $check->fetch();

        if ($isUpdate || $exists) {
            if (!$exists) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found']);
                exit;
            }

            if ($passwordValue !== '') {
                $hashedPassword = password_hash($passwordValue, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare('UPDATE users SET password = ?, status = ?, password_status = ?, session_id = ?, session_ip = ? WHERE username = ?');
                $stmt->execute([$hashedPassword, $statusValue, $passwordStatusValue, $sessionId, $sessionIp, $usernameValue]);
            } else {
                $existingPassword = $exists['password'];
                
                $isHashed = preg_match('/^\$2[ayb]\$.{56}$/', $existingPassword);
                
                if (!$isHashed && $existingPassword !== '') {
                    $hashedPassword = password_hash($existingPassword, PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare('UPDATE users SET password = ?, status = ?, password_status = ?, session_id = ?, session_ip = ? WHERE username = ?');
                    $stmt->execute([$hashedPassword, $statusValue, $passwordStatusValue, $sessionId, $sessionIp, $usernameValue]);
                } else {
                    $stmt = $pdo->prepare('UPDATE users SET status = ?, password_status = ?, session_id = ?, session_ip = ? WHERE username = ?');
                    $stmt->execute([$statusValue, $passwordStatusValue, $sessionId, $sessionIp, $usernameValue]);
                }
            }
            
            echo json_encode(['success' => true, 'message' => 'Updated', 'username' => $usernameValue]);
            exit;
        } else {
            if ($passwordValue === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Password is required for new user']);
                exit;
            }

            $checkUsername = $pdo->prepare('SELECT username FROM users WHERE username = ? LIMIT 1');
            $checkUsername->execute([$usernameValue]);
            if ($checkUsername->fetch()) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Username already exists']);
                exit;
            }

            $hashedPassword = password_hash($passwordValue, PASSWORD_DEFAULT);
            
            if (!$sessionId) {
                $sessionId = sprintf(
                    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0x0fff) | 0x4000,
                    mt_rand(0, 0x3fff) | 0x8000,
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
                );
            }

            if ($sessionIp === null) {
                $sessionIp = '';
            }

            $stmt = $pdo->prepare('INSERT INTO users (username, password, status, session_id, session_ip, password_status) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$usernameValue, $hashedPassword, $statusValue, $sessionId, $sessionIp, $passwordStatusValue]);
            
            echo json_encode(['success' => true, 'message' => 'Created', 'username' => $usernameValue]);
            exit;
        }
    }

    if ($method === 'DELETE') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_GET;

        $usernameValue = isset($data['username']) ? trim($data['username']) : null;

        if (!$usernameValue) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing username for deletion']);
            exit;
        }

        $stmt = $pdo->prepare('DELETE FROM users WHERE username = ?');
        $stmt->execute([$usernameValue]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found']);
            exit;
        }
        
        echo json_encode(['success' => true, 'message' => 'Deleted', 'username' => $usernameValue]);
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
