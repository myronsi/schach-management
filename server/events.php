<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST']);

const EVENT_READ_ACTIONS = ['list', 'get', 'upcoming', 'past', 'month'];
const EVENT_FIELDS = ['title', 'date', 'time', 'location', 'description', 'type', 'is_recurring'];

/** Event dates are "YYYY-MM-DD" or a range "YYYY-MM-DD:YYYY-MM-DD". */
function isValidEventDate($value): bool {
    if (!is_string($value)) return false;
    $parts = explode(':', $value);
    if (count($parts) > 2) return false;
    foreach ($parts as $part) {
        if (!isValidDate($part)) return false;
    }
    return count($parts) === 1 || $parts[0] <= $parts[1];
}

/** SQL expression for an event's start day ("2026-05-01" for both "2026-05-01" and "2026-05-01:2026-05-03"). */
const EVENT_START_SQL = "SUBSTRING_INDEX(date, ':', 1)";

/**
 * Validates the fields of a partial update. Only known fields are kept; empty values are skipped
 * (the edit dialogs send only what should change), except is_recurring which may be 0.
 */
function normalizeEventUpdates($updates, array $allowed): array {
    if (!is_array($updates)) jsonError('Ungültige Änderungen', 400);
    $fields = [];
    foreach ($updates as $key => $value) {
        if (!in_array($key, $allowed, true)) continue;
        if ($key === 'is_recurring') {
            $fields[$key] = !empty($value) ? 1 : 0;
            continue;
        }
        if ($value === null || $value === '') continue;
        if (!is_scalar($value)) jsonError('Ungültiger Wert für ' . $key, 400);
        $value = trim((string)$value);
        if ($value === '') continue;
        if ($key === 'date' && !isValidEventDate($value)) jsonError('Ungültiges Datum: ' . $value, 400);
        $fields[$key] = $value;
    }
    return $fields;
}

/** Optional YYYY-MM-DD request value; responds 400 when present but malformed. */
function optionalDate($value, string $label): ?string {
    if ($value === null || $value === '') return null;
    if (!is_string($value) || !isValidDate($value)) jsonError('Ungültiges Datum: ' . $label, 400);
    return $value;
}

function normalizeEvent(array $event): array {
    $title = trim((string)($event['title'] ?? ''));
    $date = trim((string)($event['date'] ?? ''));
    if ($title === '') jsonError('Missing title', 400);
    if (!isValidEventDate($date)) jsonError('Ungültiges Datum: ' . $date, 400);
    return [
        'title' => $title,
        'date' => $date,
        'time' => isset($event['time']) && $event['time'] !== '' ? (string)$event['time'] : null,
        'location' => isset($event['location']) && $event['location'] !== '' ? (string)$event['location'] : null,
        'description' => isset($event['description']) && $event['description'] !== '' ? (string)$event['description'] : null,
        'type' => isset($event['type']) && $event['type'] !== '' ? (string)$event['type'] : null,
        'is_recurring' => !empty($event['is_recurring']) ? 1 : 0,
    ];
}

try {
    $pdo = contentDb();

    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
    $input = requestBody();

    $parseDateRange = function($dateStr) {
        if (!$dateStr) return [null, null];
        if (strpos($dateStr, ':') !== false) {
            $parts = explode(':', $dateStr, 2);
            $start = trim($parts[0]);
            $end = trim($parts[1]);
            return [$start, $end];
        }
        return [trim($dateStr), null];
    };

    // Everything that is not an explicit read action needs an editor - including unknown actions.
    $user = null;
    if (!in_array($action, EVENT_READ_ACTIONS, true)) {
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        $user = requireEditor();
    }

    switch ($action) {
        case 'list':
        case 'get':
            $stmt = $pdo->query('SELECT id, title, date, time, location, description, type, is_recurring, updated_at, updated_by FROM events ORDER BY date ASC');
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;
            
        case 'upcoming':
            $currentDate = date('Y-m-d');
            $stmt = $pdo->prepare(
                "SELECT id, title, date, time, location, description, type, is_recurring, updated_at, updated_by FROM events
                 WHERE (date NOT LIKE '%:%' AND date >= ?) OR (date LIKE '%:%' AND SUBSTRING_INDEX(date, ':', -1) >= ?)
                 ORDER BY date ASC"
            );
            $stmt->execute([$currentDate, $currentDate]);
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;

        case 'past':
            $currentDate = date('Y-m-d');
            $stmt = $pdo->prepare(
                "SELECT id, title, date, time, location, description, type, is_recurring, updated_at, updated_by FROM events
                 WHERE (date NOT LIKE '%:%' AND date < ?) OR (date LIKE '%:%' AND SUBSTRING_INDEX(date, ':', -1) < ?)
                 ORDER BY date DESC"
            );
            $stmt->execute([$currentDate, $currentDate]);
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;
            
        case 'month':
            $year = $input['year'] ?? $_GET['year'] ?? date('Y');
            $month = $input['month'] ?? $_GET['month'] ?? date('m');
            
            $year = (int)$year;
            $month = (int)$month;
            
            if ($year < 1900 || $year > 2100 || $month < 1 || $month > 12) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid year or month']);
                exit;
            }
            
                        $firstDay = sprintf('%04d-%02d-01', $year, $month);
                        $lastDay = date('Y-m-t', strtotime($firstDay));

                        $expandedStart = date('Y-m-d', strtotime($firstDay . ' -8 days'));
                        $expandedEnd = date('Y-m-d', strtotime($lastDay . ' +8 days'));

                        $stmt = $pdo->prepare(
                                "SELECT id, title, date, time, location, description, type, is_recurring, updated_at, updated_by FROM events
                                 WHERE (date NOT LIKE '%:%' AND date >= ? AND date <= ?) 
                                     OR (date LIKE '%:%' AND SUBSTRING_INDEX(date, ':', 1) <= ? AND SUBSTRING_INDEX(date, ':', -1) >= ?) 
                                 ORDER BY date ASC"
                        );
                        $stmt->execute([$expandedStart, $expandedEnd, $expandedEnd, $expandedStart]);
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;
            
        case 'create':
            $events = (isset($input[0]) && array_keys($input) === range(0, count($input) - 1)) ? $input : [$input];
            if (count($events) > 500) jsonError('Zu viele Termine auf einmal', 400);
            $normalized = array_map(fn($e) => normalizeEvent(is_array($e) ? $e : []), $events);

            $createdIds = [];
            $pdo->beginTransaction();
            try {
                $nextId = nextId($pdo, 'events');
                $stmt = $pdo->prepare('INSERT INTO events (id, title, date, time, location, description, type, is_recurring, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
                foreach ($normalized as $event) {
                    $newId = $nextId++;
                    $stmt->execute([$newId, $event['title'], $event['date'], $event['time'], $event['location'], $event['description'], $event['type'], $event['is_recurring'], $user['username']]);
                    $createdIds[] = $newId;
                }
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }
            foreach ($createdIds as $newId) {
                auditLog($pdo, $user, 'events', $newId, 'create', null, auditFetchRow($pdo, 'events', $newId));
            }
            echo json_encode(['success' => true, 'message' => 'Event(s) created', 'affected_ids' => $createdIds]);
            break;

        case 'edit':
            $eventId = (int)($input['id'] ?? 0);
            $updates = $input['updates'] ?? $input;
            if (is_array($updates)) unset($updates['id'], $updates['action'], $updates['expected_updated_at'], $updates['token']);

            if ($eventId <= 0) {
                jsonError('Missing event ID', 400);
            }

            $before = auditFetchRow($pdo, 'events', $eventId);
            if (!$before) jsonError('Event not found', 404);

            $fields = [];
            $values = [];
            foreach (normalizeEventUpdates($updates, EVENT_FIELDS) as $key => $value) {
                $fields[] = "`$key` = ?";
                $values[] = $value;
            }

            if (!empty($fields)) {
                guardWrite($pdo, 'events', $eventId, $user, $input['expected_updated_at'] ?? null);
                $fields[] = 'updated_by = ?';
                $values[] = $user['username'];
                $values[] = $eventId;
                $sql = 'UPDATE events SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
                auditLog($pdo, $user, 'events', $eventId, 'update', $before, auditFetchRow($pdo, 'events', $eventId));
            }
            
            echo json_encode(['success' => true, 'message' => 'Event updated']);
            break;
            
        case 'editByTitle':
            $title = trim((string)($input['title'] ?? ''));
            if ($title === '') {
                jsonError('Missing title', 400);
            }
            $fields = [];
            $values = [];
            foreach (normalizeEventUpdates($input['updates'] ?? [], ['time', 'location', 'description', 'type', 'is_recurring', 'title']) as $key => $value) {
                $fields[] = "`$key` = ?";
                $values[] = $value;
            }

            $startDate = $input['start_date'] ?? null;
            $endDate = $input['end_date'] ?? null;
            if (!$startDate && isset($input['date']) && is_string($input['date']) && strpos($input['date'], ':') !== false) {
                list($startDate, $endDate) = $parseDateRange($input['date']);
            }
            $startDate = optionalDate($startDate, 'start_date');
            $endDate = optionalDate($endDate, 'end_date');
            if ($startDate && $endDate && $startDate > $endDate) jsonError('Startdatum liegt nach dem Enddatum', 400);

            if (!empty($fields)) {
                if (!$startDate) {
                    $startDate = date('Y-m-d');
                }

                // Multi-day events ("start:end") are matched by their start day.
                $where = 'title = ? AND ' . EVENT_START_SQL . ' >= ?';
                $whereParams = [$title, $startDate];
                if ($endDate) {
                    $where .= ' AND ' . EVENT_START_SQL . ' <= ?';
                    $whereParams[] = $endDate;
                }
                $beforeStmt = $pdo->prepare("SELECT * FROM events WHERE $where");
                $beforeStmt->execute($whereParams);
                $beforeRows = $beforeStmt->fetchAll();
                $affectedIds = array_map('intval', array_column($beforeRows, 'id'));
                foreach ($affectedIds as $lockedId) assertNotLockedByOther($pdo, 'events', $lockedId, $user);

                $fields[] = 'updated_by = ?';
                $values[] = $user['username'];
                $stmt = $pdo->prepare('UPDATE events SET ' . implode(', ', $fields) . " WHERE $where");
                $stmt->execute(array_merge($values, $whereParams));
                $affected = $stmt->rowCount();
                $afterRows = [];
                foreach ($affectedIds as $affectedId) {
                    $afterRows[] = auditFetchRow($pdo, 'events', $affectedId);
                }
                auditLog($pdo, $user, 'events', $affectedIds, 'bulk_update', $beforeRows, $afterRows);
                echo json_encode(['success' => true, 'message' => "Updated $affected event(s)", 'affected_ids' => $affectedIds]);
            } else {
                echo json_encode(['success' => true, 'message' => 'No updates provided']);
            }
            break;
            
        case 'delete':
            $eventId = $input['id'] ?? '';
            
            if ($eventId) {
                guardWrite($pdo, 'events', (int)$eventId, $user, $input['expected_updated_at'] ?? null);
                $before = auditFetchRow($pdo, 'events', $eventId);
                $stmt = $pdo->prepare('DELETE FROM events WHERE id = ?');
                $stmt->execute([$eventId]);
                $deleted = $stmt->rowCount();
                if ($deleted) auditLog($pdo, $user, 'events', $eventId, 'delete', $before, null);
                echo json_encode(['success' => true, 'deleted' => $deleted, 'message' => 'Deleted event']);
                break;
            }
            
            $mode = $input['mode'] ?? '';
            
            switch ($mode) {
                case 'upcomingTitle':
                    $title = $input['title'] ?? '';
                    $currentDate = date('Y-m-d');
                    
                    if (!$title) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Missing title']);
                        exit;
                    }
                    
                    $beforeStmt = $pdo->prepare('SELECT * FROM events WHERE title = ? AND ' . EVENT_START_SQL . ' >= ?');
                    $beforeStmt->execute([$title, $currentDate]);
                    $beforeRows = $beforeStmt->fetchAll();
                    $affectedIds = array_map('intval', array_column($beforeRows, 'id'));
                    foreach ($affectedIds as $lockedId) assertNotLockedByOther($pdo, 'events', $lockedId, $user);
                    $stmt = $pdo->prepare('DELETE FROM events WHERE title = ? AND ' . EVENT_START_SQL . ' >= ?');
                    $stmt->execute([$title, $currentDate]);
                    $deleted = $stmt->rowCount();
                    if ($deleted) auditLog($pdo, $user, 'events', $affectedIds, 'bulk_delete', $beforeRows, null);
                    break;
                    
                case 'specificDayTitle':
                    $title = $input['title'] ?? '';
                    $date = $input['date'] ?? '';
                    
                    if (!$title || !$date) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Missing title or date']);
                        exit;
                    }
                    
                    $beforeStmt = $pdo->prepare('SELECT * FROM events WHERE title = ? AND date = ?');
                    $beforeStmt->execute([$title, $date]);
                    $beforeRows = $beforeStmt->fetchAll();
                    $affectedIds = array_map('intval', array_column($beforeRows, 'id'));
                    foreach ($affectedIds as $lockedId) assertNotLockedByOther($pdo, 'events', $lockedId, $user);
                    $stmt = $pdo->prepare('DELETE FROM events WHERE title = ? AND date = ?');
                    $stmt->execute([$title, $date]);
                    $deleted = $stmt->rowCount();
                    if ($deleted) auditLog($pdo, $user, 'events', $affectedIds, 'bulk_delete', $beforeRows, null);
                    break;
                    
                case 'allOnDay':
                    $date = $input['date'] ?? '';
                    
                    if (!$date) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Missing date']);
                        exit;
                    }
                    
                    $beforeStmt = $pdo->prepare('SELECT * FROM events WHERE date = ?');
                    $beforeStmt->execute([$date]);
                    $beforeRows = $beforeStmt->fetchAll();
                    $affectedIds = array_map('intval', array_column($beforeRows, 'id'));
                    foreach ($affectedIds as $lockedId) assertNotLockedByOther($pdo, 'events', $lockedId, $user);
                    $stmt = $pdo->prepare('DELETE FROM events WHERE date = ?');
                    $stmt->execute([$date]);
                    $deleted = $stmt->rowCount();
                    if ($deleted) auditLog($pdo, $user, 'events', $affectedIds, 'bulk_delete', $beforeRows, null);
                    break;

                case 'range':
                    $startDate = $input['start_date'] ?? null;
                    $endDate = $input['end_date'] ?? null;
                    if (!$startDate && isset($input['date']) && strpos($input['date'], ':') !== false) {
                        list($startDate, $endDate) = $parseDateRange($input['date']);
                    }

                    if (!$startDate || !$endDate) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Missing start_date or end_date for range delete']);
                        exit;
                    }
                    $startDate = optionalDate($startDate, 'start_date');
                    $endDate = optionalDate($endDate, 'end_date');
                    if ($startDate > $endDate) jsonError('Startdatum liegt nach dem Enddatum', 400);

                    // Multi-day events are matched by their start day.
                    $rangeWhere = EVENT_START_SQL . ' >= ? AND ' . EVENT_START_SQL . ' <= ?';
                    $beforeStmt = $pdo->prepare("SELECT * FROM events WHERE $rangeWhere");
                    $beforeStmt->execute([$startDate, $endDate]);
                    $beforeRows = $beforeStmt->fetchAll();
                    $affectedIds = array_map('intval', array_column($beforeRows, 'id'));
                    foreach ($affectedIds as $lockedId) assertNotLockedByOther($pdo, 'events', $lockedId, $user);
                    $stmt = $pdo->prepare("DELETE FROM events WHERE $rangeWhere");
                    $stmt->execute([$startDate, $endDate]);
                    $deleted = $stmt->rowCount();
                    if ($deleted) auditLog($pdo, $user, 'events', $affectedIds, 'bulk_delete', $beforeRows, null);
                    break;
                    
                default:
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid delete mode']);
                    exit;
            }
            
            echo json_encode(['success' => true, 'deleted' => $deleted, 'affected_ids' => $affectedIds ?? [], 'message' => "Deleted {$deleted} event(s)"]);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }

} catch (PDOException $e) {
    error_log('events.php: ' . $e->getMessage());
    jsonError('Datenbankfehler', 500);
}
