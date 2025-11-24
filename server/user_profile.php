<?php
require_once __DIR__ . '/vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$envFile = __DIR__ . '/.env.auth';
if (!file_exists($envFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '.env.auth not found']);
    exit;
}

$env = parse_ini_file($envFile);
$host = $env['host'] ?? '';
$user = $env['user'] ?? '';
$password = $env['password'] ?? '';
$database = $env['database'] ?? '';
$port = isset($env['port']) ? (int)$env['port'] : 3306;
$jwt_secret = $env['jwt_secret'] ?? 'default_secret_change_this';

function getTokenFromHeader() {
    $authHeader = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (empty($authHeader)) $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($authHeader)) $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) return $matches[1];
    return null;
}

function validateJWT($token, $jwt_secret) {
    try {
        $decoded = JWT::decode($token, new Key($jwt_secret, 'HS256'));
        return (array) $decoded;
    } catch (Exception $e) {
        return false;
    }
}

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];
    $token = getTokenFromHeader();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token fehlt']);
        exit;
    }

    $decoded = validateJWT($token, $jwt_secret);
    if ($decoded === false) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Ungültiger oder abgelaufener Token']);
        exit;
    }

    $username = $decoded['username'] ?? null;
    if (!$username) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Token enthält keinen Benutzernamen']);
        exit;
    }

    $colsStmt = $pdo->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'");
    $colsStmt->execute([$database]);
    $colsRows = $colsStmt->fetchAll(PDO::FETCH_COLUMN, 0);
    $availableCols = array_map('strtolower', $colsRows ?: []);

    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT username, email, first_name, last_name, notify_events FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
            exit;
        }
        echo json_encode(array_merge(['success' => true], $row));
        exit;
    }

    if ($method === 'PUT') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Ungültiger Anfragekörper']);
            exit;
        }

        $email = isset($data['email']) ? trim((string)$data['email']) : null;
        $notify = isset($data['notify_events']) ? (int)$data['notify_events'] : null;
        $first_name = isset($data['first_name']) ? trim((string)$data['first_name']) : null;
        $last_name = isset($data['last_name']) ? trim((string)$data['last_name']) : null;

        if ($email !== null && $email !== '') {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Ungültige E-Mail-Adresse']);
                exit;
            }
        }
        $fields = [];
        $params = [];

        if ($email !== null) {
            if (!in_array('email', $availableCols, true)) {
                echo json_encode(['success' => false, 'message' => 'Spalte "email" existiert nicht in users-Tabelle']);
                exit;
            }
            $fields[] = '`email` = ?';
            $params[] = $email;
        }
        if ($first_name !== null) {
            if (!in_array('first_name', $availableCols, true)) {
                echo json_encode(['success' => false, 'message' => 'Spalte "first_name" existiert nicht in users-Tabelle']);
                exit;
            }
            $fields[] = '`first_name` = ?';
            $params[] = $first_name;
        }
        if ($last_name !== null) {
            if (!in_array('last_name', $availableCols, true)) {
                echo json_encode(['success' => false, 'message' => 'Spalte "last_name" existiert nicht in users-Tabelle']);
                exit;
            }
            $fields[] = '`last_name` = ?';
            $params[] = $last_name;
        }
        if ($notify !== null) {
            if (!in_array('notify_events', $availableCols, true)) {
                echo json_encode(['success' => false, 'message' => 'Spalte "notify_events" existiert nicht in users-Tabelle']);
                exit;
            }
            $fields[] = '`notify_events` = ?';
            $params[] = $notify ? 1 : 0;
        }

        if (count($fields) === 0) {
            echo json_encode(['success' => false, 'message' => 'Keine zu aktualisierenden Felder']);
            exit;
        }

        $params[] = $username;
        $sql = 'UPDATE `users` SET ' . implode(', ', $fields) . ' WHERE `username` = ?';
        $upd = $pdo->prepare($sql);
        $upd->execute($params);

        echo json_encode(['success' => true, 'message' => 'Profil aktualisiert']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode nicht erlaubt']);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB error: ' . $e->getMessage()]);
    exit;
}

?>