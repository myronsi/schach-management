<?php
require_once __DIR__ . '/auth-middleware.php';

sendCorsHeaders(['POST']);

const LOCKABLE_ENTITIES = ['documents', 'events', 'fastinfo', 'history', 'media', 'news', 'teams', 'tournaments'];

try {
    $pdo = contentDb();
    $currentUser = requireEditor();
    $data = requestBody();
    $action = strtolower((string)($data['action'] ?? $_GET['action'] ?? ''));
    $entity = trim((string)($data['entity'] ?? $_GET['entity'] ?? ''));
    $entityId = (string)($data['entity_id'] ?? $_GET['entity_id'] ?? '');
    $token = trim((string)($data['lock_token'] ?? ''));
    $username = (string)($currentUser['username'] ?? 'unknown');

    if ($entity === '' || $entityId === '') {
        jsonError('Missing entity or entity_id', 400);
    }
    if (!in_array($entity, LOCKABLE_ENTITIES, true) || strlen($entityId) > 64) {
        jsonError('Invalid entity', 400);
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
    error_log('Edit lock error: ' . $e->getMessage());
    jsonError('Edit lock error', 500);
}
