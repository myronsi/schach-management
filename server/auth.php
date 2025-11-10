<?php

require_once __DIR__ . '/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: false');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (isset($_GET['debug']) && $_GET['debug'] === 'headers') {
    $debug_info = [
        'all_headers' => function_exists('getallheaders') ? getallheaders() : 'getallheaders not available',
        'server_auth' => $_SERVER['HTTP_AUTHORIZATION'] ?? 'not set',
        'server_redirect_auth' => $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? 'not set',
        'input_raw' => file_get_contents('php://input'),
        'post_data' => $_POST,
        'get_data' => $_GET
    ];
    echo json_encode($debug_info, JSON_PRETTY_PRINT);
    exit;
}

$envFile = __DIR__ . '/.env.auth';
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
$jwt_secret = $env['jwt_secret'] ?? 'default_secret_change_this';

function generateJWT($username, $status, $jwt_secret) {
    $issuedAt = time();
    $expirationTime = $issuedAt + (8 * 24 * 60 * 60);
    $payload = array(
        'iss' => 'schach-club',
        'aud' => 'schach-club-client',
        'iat' => $issuedAt,
        'exp' => $expirationTime,
        'username' => $username,
        'status' => $status
    );
    
    return JWT::encode($payload, $jwt_secret, 'HS256');
}

function validateJWT($token, $jwt_secret) {
    try {
        $decoded = JWT::decode($token, new Key($jwt_secret, 'HS256'));
        return (array) $decoded;
    } catch (Exception $e) {
        return false;
    }
}

function getTokenFromHeader() {
    $authHeader = '';
    
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    
    if (empty($authHeader)) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    }
    
    if (empty($authHeader)) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    }
    
    error_log("Auth header found: " . ($authHeader ? "YES" : "NO"));
    if ($authHeader) {
        error_log("Auth header value: " . substr($authHeader, 0, 20) . "...");
    }
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        error_log("Token extracted successfully");
        return $matches[1];
    }
    
    error_log("No Bearer token found in header");
    return null;
}

$input = json_decode(file_get_contents('php://input'), true);
$username = $input['username'] ?? $_POST['username'] ?? '';
$pass = $input['password'] ?? $_POST['password'] ?? '';
$action = $input['action'] ?? $_POST['action'] ?? '';

$token = null;
$token = $input['token'] ?? $_POST['token'] ?? null;
if (!$token) {
    $token = getTokenFromHeader();
}

error_log("Token search - Input: " . ($input['token'] ?? 'none') . 
          ", POST: " . ($_POST['token'] ?? 'none') . 
          ", Header: " . (getTokenFromHeader() ?? 'none') . 
          ", Final: " . ($token ?? 'none'));

if ($action !== 'check' && $action !== 'set_password' && $action !== 'logout' && $action !== 'validate' && $action !== 'renew') {
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

    if ($action === 'check' || $action === 'validate') {
        error_log("Validation request - Action: $action");
        error_log("Token from input: " . ($input['token'] ?? 'none'));
        error_log("Token from POST: " . ($_POST['token'] ?? 'none'));
        error_log("Token from header: " . (getTokenFromHeader() ?? 'none'));
        error_log("Final token: " . ($token ?? 'none'));
        
        if (!$token) {
            error_log("No token provided for validation");
            echo json_encode(['success' => false, 'message' => 'Token erforderlich']);
            exit;
        }
        
        $decoded = validateJWT($token, $jwt_secret);
        if ($decoded === false) {
            echo json_encode(['success' => false, 'message' => 'Ungültiger oder abgelaufener Token']);
            exit;
        }
        
        $stmt = $pdo->prepare('SELECT username, status FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$decoded['username']]);
        $row = $stmt->fetch();
        
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
            exit;
        }
        
        if ($row['status'] !== $decoded['status']) {
            echo json_encode(['success' => false, 'message' => 'Benutzerstatus geändert, bitte erneut anmelden']);
            exit;
        }
        
        echo json_encode([
            'success' => true, 
            'message' => 'Token gültig', 
            'status' => $decoded['status'],
            'username' => $decoded['username'],
            'expires_at' => $decoded['exp']
        ]);
        exit;
    }

    if ($action === 'renew') {
        if (!$token) {
            echo json_encode(['success' => false, 'message' => 'Token erforderlich']);
            exit;
        }
        
        $decoded = validateJWT($token, $jwt_secret);
        if ($decoded === false) {
            echo json_encode(['success' => false, 'message' => 'Ungültiger oder abgelaufener Token']);
            exit;
        }
        
        $stmt = $pdo->prepare('SELECT username, status FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$decoded['username']]);
        $row = $stmt->fetch();
        
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
            exit;
        }
        
        if ($row['status'] !== $decoded['status']) {
            echo json_encode(['success' => false, 'message' => 'Benutzerstatus geändert, bitte erneut anmelden']);
            exit;
        }
        
        $now = time();
        $tokenExp = $decoded['exp'] ?? 0;
        
        $renewThreshold = 24 * 60 * 60;
        if (($tokenExp - $now) > $renewThreshold) {
            echo json_encode([
                'success' => true, 
                'message' => 'Token still valid, no renewal needed',
                'token' => $token,
                'expires_at' => $tokenExp
            ]);
            exit;
        }
        
        if ($tokenExp <= $now) {
            echo json_encode(['success' => false, 'message' => 'Token abgelaufen, erneute Anmeldung erforderlich']);
            exit;
        }
        
        $newToken = generateJWT($decoded['username'], $row['status'], $jwt_secret);
        
        echo json_encode([
            'success' => true, 
            'message' => 'Token erfolgreich erneuert',
            'token' => $newToken,
            'username' => $decoded['username'],
            'status' => $row['status']
        ]);
        exit;
    }

    if ($action === 'logout') {
        if (!$token) {
            echo json_encode(['success' => false, 'message' => 'Token erforderlich']);
            exit;
        }
        
        $decoded = validateJWT($token, $jwt_secret);
        if ($decoded === false) {
            echo json_encode(['success' => false, 'message' => 'Ungültiger Token']);
            exit;
        }
        
        echo json_encode(['success' => true, 'message' => 'Erfolgreich abgemeldet']);
        exit;
    }

    if ($action === 'set_password') {
        $new_password = $input['new_password'] ?? $_POST['new_password'] ?? '';
        if (!$token || !$new_password) {
            echo json_encode(['success' => false, 'message' => 'Token und new_password erforderlich']);
            exit;
        }

        $decoded = validateJWT($token, $jwt_secret);
        if ($decoded === false) {
            echo json_encode(['success' => false, 'message' => 'Ungültiger oder abgelaufener Token']);
            exit;
        }
        
        $username = $decoded['username'];
        
        $stmt = $pdo->prepare('SELECT username FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
            exit;
        }

        $hashed = password_hash($new_password, PASSWORD_DEFAULT);
        $upd = $pdo->prepare('UPDATE users SET password = ?, password_status = ? WHERE username = ?');
        $upd->execute([$hashed, 'changed', $username]);

        echo json_encode(['success' => true, 'message' => 'Passwort gesetzt']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT username, password, status, password_status FROM users WHERE username = ? LIMIT 1');
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

    $jwt_token = generateJWT($username, $row['status'], $jwt_secret);

    if ($password_status === 'unchanged') {
        echo json_encode([
            'success' => true, 
            'message' => 'Passwort muss geändert werden', 
            'status' => $row['status'], 
            'token' => $jwt_token, 
            'must_change_password' => true
        ]);
        exit;
    }

    echo json_encode([
        'success' => true, 
        'message' => 'Erfolgreich angemeldet', 
        'status' => $row['status'], 
        'token' => $jwt_token, 
        'must_change_password' => false
    ]);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
