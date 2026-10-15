<?php

function auditLog(PDO $pdo, ?array $user, string $entity, $entityId, string $action, $old = null, $new = null): void {
    try {
        $stmt = $pdo->prepare('INSERT INTO audit_log (username, entity, entity_id, action, old_data, new_data) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $user['username'] ?? 'unknown',
            $entity,
            is_array($entityId) ? json_encode(array_values($entityId), JSON_UNESCAPED_UNICODE) : (string)$entityId,
            $action,
            $old === null ? null : json_encode($old, JSON_UNESCAPED_UNICODE),
            $new === null ? null : json_encode($new, JSON_UNESCAPED_UNICODE),
        ]);
    } catch (Throwable $e) {
        error_log('audit_log failed: ' . $e->getMessage());
    }
}

function auditCheckConflict(PDO $pdo, string $table, $id, ?string $expected): void {
    if ($expected === null || $expected === '') return;
    $stmt = $pdo->prepare("SELECT updated_at, updated_by FROM `$table` WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if ($row && $row['updated_at'] !== $expected) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'conflict' => true,
            'message' => 'Dieser Eintrag wurde zwischenzeitlich geändert von '
                . ($row['updated_by'] ?: 'unbekannt') . ' (' . $row['updated_at'] . '). Bitte neu laden.',
            'updated_at' => $row['updated_at'],
            'updated_by' => $row['updated_by'],
        ]);
        exit;
    }
}

function auditFetchRow(PDO $pdo, string $table, $id): ?array {
    $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}
