<?php
require_once __DIR__ . '/auth-middleware.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
header('Access-Control-Allow-Credentials: false');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $env = parse_ini_file($envFile);
$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;

try {
    $pdo = new PDO("mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $currentUser = requireAuthentication(['admin']);
    $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = strtolower((string)($data['action'] ?? $_GET['action'] ?? ''));
    $entity = trim((string)($data['entity'] ?? $_GET['entity'] ?? ''));
    $entityId = (string)($data['entity_id'] ?? $_GET['entity_id'] ?? '');
    $token = trim((string)($data['lock_token'] ?? ''));
    $username = (string)($currentUser['username'] ?? 'unknown');

    if ($entity === '' || $entityId === '') {
        http_response_code(400);
        echo json_encode(['success'=>false,'message'=>'Missing entity or entity_id']); exit;
    }

    // Expired locks are never considered active.
    $pdo->exec('DELETE FROM edit_locks WHERE expires_at <= UTC_TIMESTAMP()');

    if ($action === 'acquire') {
        $newToken = bin2hex(random_bytes(32));
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT username, lock_token, expires_at FROM edit_locks WHERE entity = ? AND entity_id = ? FOR UPDATE');
            $stmt->execute([$entity, $entityId]);
            $lock = $stmt->fetch();

            if ($lock && $lock['username'] !== $username) {
                $pdo->rollBack();
                http_response_code(423);
                echo json_encode([
                    'success'=>false, 'locked'=>true,
                    'message'=>'Dieser Eintrag wird gerade von ' . ($lock['username'] ?: 'einem anderen Benutzer') . ' bearbeitet.',
                    'locked_by'=>$lock['username'], 'expires_at'=>$lock['expires_at']
                ]);
                exit;
            }

            if ($lock) {
                $stmt = $pdo->prepare('UPDATE edit_locks SET lock_token = ?, locked_at = UTC_TIMESTAMP(), expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) WHERE entity = ? AND entity_id = ?');
                $stmt->execute([$newToken, $entity, $entityId]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO edit_locks (entity, entity_id, username, lock_token, locked_at, expires_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))');
                $stmt->execute([$entity, $entityId, $username, $newToken]);
            }
            $pdo->commit();
            $stmt = $pdo->prepare('SELECT expires_at FROM edit_locks WHERE entity = ? AND entity_id = ?');
            $stmt->execute([$entity, $entityId]);
            $row = $stmt->fetch();
            echo json_encode(['success'=>true,'locked'=>true,'lock_token'=>$newToken,'locked_by'=>$username,'expires_at'=>$row['expires_at'] ?? null]);
            exit;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    if ($action === 'heartbeat') {
        if ($token === '') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Missing lock token']); exit; }
        $stmt = $pdo->prepare('UPDATE edit_locks SET expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) WHERE entity = ? AND entity_id = ? AND username = ? AND lock_token = ?');
        $stmt->execute([$entity, $entityId, $username, $token]);
        if ($stmt->rowCount() < 1) {
            http_response_code(409);
            echo json_encode(['success'=>false,'locked'=>false,'message'=>'Die Bearbeitungssperre ist nicht mehr aktiv. Bitte erneut bearbeiten.']); exit;
        }
        echo json_encode(['success'=>true]); exit;
    }

    if ($action === 'release') {
        if ($token === '') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Missing lock token']); exit; }
        $stmt = $pdo->prepare('DELETE FROM edit_locks WHERE entity = ? AND entity_id = ? AND username = ? AND lock_token = ?');
        $stmt->execute([$entity, $entityId, $username, $token]);
        echo json_encode(['success'=>true]); exit;
    }

    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Unknown action']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Edit lock error: ' . $e->getMessage()]);
}
