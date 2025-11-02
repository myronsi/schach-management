<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: false');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$envFile = __DIR__ . '/.env';
if (!file_exists($envFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '.env file not found']);
    exit;
}

$env = parse_ini_file($envFile);
$host = $env['host'] ?? '';
$user = $env['user'] ?? '';
$password = $env['password'] ?? '';
$database = $env['database'] ?? '';
$port = isset($env['port']) ? (int)$env['port'] : 3306;

$input = json_decode(file_get_contents('php://input'), true);
$username = $input['username'] ?? $_POST['username'] ?? '';
$pass = $input['password'] ?? $_POST['password'] ?? '';
$action = $input['action'] ?? $_POST['action'] ?? '';

$client_ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (strpos($client_ip, ',') !== false) {
    $client_ip = trim(explode(',', $client_ip)[0]);
}

if ($action !== 'check' && $action !== 'set_password' && $action !== 'logout') {
    if (!$username || !$pass) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Bitte Benutzername und Passwort angeben.']);
        exit;
    }
}

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    if ($action === 'check') {
        $session_id = $input['session_id'] ?? $_POST['session_id'] ?? '';
        if (!$username || !$session_id) {
            echo json_encode(['success' => false, 'message' => 'Benutzername und session_id erforderlich']);
            exit;
        }
        
        $stmt = $pdo->prepare('SELECT username, status, session_id, session_ip FROM users WHERE username = ? AND session_id = ? LIMIT 1');
        $stmt->execute([$username, $session_id]);
        $row = $stmt->fetch();
        
        if ($row) {
            $allowedIps = $row['session_ip'] ? explode(',', $row['session_ip']) : [];
            $allowedIps = array_map('trim', $allowedIps);
            
            if (in_array($client_ip, $allowedIps)) {
                echo json_encode(['success' => true, 'message' => 'Session gültig', 'status' => $row['status']]);
            } else {
                $allowedIps[] = $client_ip;
                $allowedIps = array_slice($allowedIps, -5);
                $newIpList = implode(',', $allowedIps);
                
                $updateIp = $pdo->prepare('UPDATE users SET session_ip = ? WHERE username = ? AND session_id = ?');
                $updateIp->execute([$newIpList, $username, $session_id]);
                
                echo json_encode(['success' => true, 'message' => 'Session gültig', 'status' => $row['status']]);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Ungültige Session']);
        }
        exit;
    }

    if ($action === 'logout') {
        $session_id = $input['session_id'] ?? $_POST['session_id'] ?? '';
        if (!$username || !$session_id) {
            echo json_encode(['success' => false, 'message' => 'Benutzername und session_id erforderlich']);
            exit;
        }
        
        $stmt = $pdo->prepare('SELECT session_ip FROM users WHERE username = ? AND session_id = ? LIMIT 1');
        $stmt->execute([$username, $session_id]);
        $row = $stmt->fetch();
        
        if ($row) {
            $allowedIps = $row['session_ip'] ? explode(',', $row['session_ip']) : [];
            $allowedIps = array_map('trim', $allowedIps);
            
            $allowedIps = array_filter($allowedIps, function($ip) use ($client_ip) {
                return $ip !== $client_ip;
            });
            
            $newIpList = implode(',', $allowedIps);
            
            if (empty($allowedIps)) {
                $updateStmt = $pdo->prepare('UPDATE users SET session_id = NULL, session_ip = NULL WHERE username = ? AND session_id = ?');
                $updateStmt->execute([$username, $session_id]);
            } else {
                $updateStmt = $pdo->prepare('UPDATE users SET session_ip = ? WHERE username = ? AND session_id = ?');
                $updateStmt->execute([$newIpList, $username, $session_id]);
            }
        }
        
        echo json_encode(['success' => true, 'message' => 'Erfolgreich abgemeldet']);
        exit;
    }

    if ($action === 'set_password') {
        $session_id = $input['session_id'] ?? $_POST['session_id'] ?? '';
        $new_password = $input['new_password'] ?? $_POST['new_password'] ?? '';
        if (!$username || !$session_id || !$new_password) {
            echo json_encode(['success' => false, 'message' => 'Benutzername, session_id und new_password erforderlich']);
            exit;
        }

        $stmt = $pdo->prepare('SELECT username, session_ip FROM users WHERE username = ? AND session_id = ? LIMIT 1');
        $stmt->execute([$username, $session_id]);
        $row = $stmt->fetch();
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Ungültige Session']);
            exit;
        }
        
        $allowedIps = $row['session_ip'] ? explode(',', $row['session_ip']) : [];
        $allowedIps = array_map('trim', $allowedIps);
        if (!in_array($client_ip, $allowedIps)) {
            echo json_encode(['success' => false, 'message' => 'Ungültige IP-Adresse']);
            exit;
        }

        $hashed = password_hash($new_password, PASSWORD_DEFAULT);
        $upd = $pdo->prepare('UPDATE users SET password = ?, password_status = ? WHERE username = ?');
        $upd->execute([$hashed, 'changed', $username]);

        echo json_encode(['success' => true, 'message' => 'Passwort gesetzt']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT username, password, status, password_status, session_id, session_ip FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
        exit;
    }

    $password_status = $row['password_status'] ?? 'changed';

    if (!password_verify($pass, $row['password'])) {
        echo json_encode(['success' => false, 'message' => 'Ungültiges Passwort']);
        exit;
    }

    $existing_session_id = $row['session_id'];
    $existing_ips = $row['session_ip'] ? explode(',', $row['session_ip']) : [];
    $existing_ips = array_map('trim', $existing_ips);
    
    if (!$existing_session_id || empty($row['session_ip'])) {
        $new_session_id = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        
        $updateSession = $pdo->prepare('UPDATE users SET session_id = ?, session_ip = ? WHERE username = ?');
        $updateSession->execute([$new_session_id, $client_ip, $username]);
    } else {
        $new_session_id = $existing_session_id;
        
        if (!in_array($client_ip, $existing_ips)) {
            $existing_ips[] = $client_ip;
            $existing_ips = array_slice($existing_ips, -5);
            $new_ip_list = implode(',', $existing_ips);
            
            $updateIp = $pdo->prepare('UPDATE users SET session_ip = ? WHERE username = ?');
            $updateIp->execute([$new_ip_list, $username]);
        }
    }

    if ($password_status === 'unchanged') {
        echo json_encode(['success' => true, 'message' => 'Passwort muss geändert werden', 'status' => $row['status'], 'session_id' => $new_session_id, 'must_change_password' => true]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Erfolgreich angemeldet', 'status' => $row['status'], 'session_id' => $new_session_id, 'must_change_password' => false]);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
