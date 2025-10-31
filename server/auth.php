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

// For normal login actions we require username+password. Skip this check for
// 'check' (session validation) and 'set_password' (setting a new password).
if ($action !== 'check' && $action !== 'set_password') {
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
        $stmt = $pdo->prepare('SELECT username, status, session_id FROM users WHERE username = ? AND session_id = ? LIMIT 1');
        $stmt->execute([$username, $session_id]);
        $row = $stmt->fetch();
        if ($row) {
            echo json_encode(['success' => true, 'message' => 'Session gültig', 'status' => $row['status']]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Ungültige Session']);
        }
        exit;
    }

    // Allow clients to set a new password for the user (after initial login when password_status = 'unchanged')
    if ($action === 'set_password') {
        $session_id = $input['session_id'] ?? $_POST['session_id'] ?? '';
        $new_password = $input['new_password'] ?? $_POST['new_password'] ?? '';
        if (!$username || !$session_id || !$new_password) {
            echo json_encode(['success' => false, 'message' => 'Benutzername, session_id und new_password erforderlich']);
            exit;
        }

        // validate session
        $stmt = $pdo->prepare('SELECT username, session_id FROM users WHERE username = ? AND session_id = ? LIMIT 1');
        $stmt->execute([$username, $session_id]);
        $row = $stmt->fetch();
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Ungültige Session']);
            exit;
        }

        // Hash the new password and update the DB
        $hashed = password_hash($new_password, PASSWORD_DEFAULT);
        $upd = $pdo->prepare('UPDATE users SET password = ?, password_status = ? WHERE username = ?');
        $upd->execute([$hashed, 'changed', $username]);

        echo json_encode(['success' => true, 'message' => 'Passwort gesetzt']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT username, password, status, session_id, password_status FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
        exit;
    }

    $password_status = $row['password_status'] ?? 'changed';

    // If password_status is 'changed' the stored password is hashed and we must verify
    if ($password_status === 'changed') {
        if (!password_verify($pass, $row['password'])) {
            echo json_encode(['success' => false, 'message' => 'Ungültiges Passwort']);
            exit;
        }
        // successful login with hashed password
        echo json_encode(['success' => true, 'message' => 'Erfolgreich angemeldet', 'status' => $row['status'], 'session_id' => $row['session_id'], 'must_change_password' => false]);
        exit;
    }

    // If password_status is not 'changed' (e.g., 'unchanged'), stored password is plaintext
    // Accept plaintext match and instruct client to force a password change
    if ($password_status === 'unchanged') {
        if (!hash_equals($row['password'], $pass)) {
            echo json_encode(['success' => false, 'message' => 'Ungültiges Passwort']);
            exit;
        }
        // Login OK but require password reset
        echo json_encode(['success' => true, 'message' => 'Passwort muss geändert werden', 'status' => $row['status'], 'session_id' => $row['session_id'], 'must_change_password' => true]);
        exit;
    }

    // Fallback: deny
    echo json_encode(['success' => false, 'message' => 'Ungültiger Passwortzustand']);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
