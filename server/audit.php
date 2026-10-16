<?php

require_once __DIR__ . '/common.php';

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

/**
 * Optimistic concurrency check. Responds 409 with conflict=true when the row changed since
 * the client loaded it. $table must be a hard-coded table name, never user input.
 */
function auditCheckConflict(PDO $pdo, string $table, $id, $expected): void {
    if (!is_string($expected) || $expected === '') return;
    $stmt = $pdo->prepare("SELECT updated_at, updated_by FROM `$table` WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if ($row && $row['updated_at'] !== $expected) {
        jsonError(
            'Dieser Eintrag wurde zwischenzeitlich geändert von '
                . ($row['updated_by'] ?: 'unbekannt') . ' (' . $row['updated_at'] . '). Bitte neu laden.',
            409,
            ['conflict' => true, 'updated_at' => $row['updated_at'], 'updated_by' => $row['updated_by']]
        );
    }
}

/** $table must be a hard-coded table name, never user input. */
function auditFetchRow(PDO $pdo, string $table, $id): ?array {
    $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Lock + conflict checks every update/delete of an existing row has to pass. */
function guardWrite(PDO $pdo, string $table, $id, array $user, $expectedUpdatedAt): void {
    assertNotLockedByOther($pdo, $table, $id, $user);
    auditCheckConflict($pdo, $table, $id, $expectedUpdatedAt);
}
