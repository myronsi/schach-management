<?php

require_once __DIR__ . '/auth-middleware.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: false');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $env = parse_ini_file($envFile);

$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
    $input = json_decode(file_get_contents('php://input'), true) ?: [];

    if (isWriteOperation($action)) {
        $user = requireAuthentication(['admin']);
        error_log("Authenticated user '{$user['username']}' performing action: $action");
    }

    switch ($action) {
        case 'list':
        case 'get':
            $stmt = $pdo->query('SELECT id, title, date, time, location, description, type, is_recurring FROM events ORDER BY date ASC');
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;
            
        case 'upcoming':
            $currentDate = date('Y-m-d');
            $stmt = $pdo->prepare('SELECT id, title, date, time, location, description, type, is_recurring FROM events WHERE date >= ? ORDER BY date ASC');
            $stmt->execute([$currentDate]);
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;

        case 'past':
            $currentDate = date('Y-m-d');
            $stmt = $pdo->prepare('SELECT id, title, date, time, location, description, type, is_recurring FROM events WHERE date < ? ORDER BY date DESC');
            $stmt->execute([$currentDate]);
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
            
            $stmt = $pdo->prepare('SELECT id, title, date, time, location, description, type, is_recurring FROM events WHERE date >= ? AND date <= ? ORDER BY date ASC');
            $stmt->execute([$firstDay, $lastDay]);
            $events = $stmt->fetchAll();
            echo json_encode(['events' => $events]);
            break;
            
        case 'create':
            if (isset($input[0])) {
                $stmt = $pdo->prepare('INSERT INTO events (title, date, time, location, description, type, is_recurring) VALUES (?, ?, ?, ?, ?, ?, ?)');
                foreach ($input as $event) {
                    $stmt->execute([
                        $event['title'] ?? '',
                        $event['date'] ?? '',
                        $event['time'] ?? null,
                        $event['location'] ?? null,
                        $event['description'] ?? null,
                        $event['type'] ?? null,
                        $event['is_recurring'] ?? 0
                    ]);
                }
            } else {
                $stmt = $pdo->prepare('INSERT INTO events (title, date, time, location, description, type, is_recurring) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $input['title'] ?? '',
                    $input['date'] ?? '',
                    $input['time'] ?? null,
                    $input['location'] ?? null,
                    $input['description'] ?? null,
                    $input['type'] ?? null,
                    $input['is_recurring'] ?? 0
                ]);
            }
            
            echo json_encode(['success' => true, 'message' => 'Event(s) created']);
            break;
            
        case 'edit':
            $eventId = $input['id'] ?? '';
            $updates = $input['updates'] ?? $input;
            
            unset($updates['id'], $updates['action']);
            
            if (!$eventId) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing event ID']);
                exit;
            }
            
            $fields = [];
            $values = [];
            foreach ($updates as $key => $value) {
                if (in_array($key, ['title', 'date', 'time', 'location', 'description', 'type', 'is_recurring']) && ($value !== null && $value !== '' || $key === 'is_recurring')) {
                    $fields[] = "$key = ?";
                    $values[] = $value;
                }
            }
            
            if (!empty($fields)) {
                $values[] = $eventId;
                $sql = 'UPDATE events SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
            }
            
            echo json_encode(['success' => true, 'message' => 'Event updated']);
            break;
            
        case 'editByTitle':
            $title = $input['title'] ?? '';
            $updates = $input['updates'] ?? [];
            $currentDate = date('Y-m-d');
            
            if (!$title) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing title']);
                exit;
            }
            
            $fields = [];
            $values = [];
            foreach ($updates as $key => $value) {
                if ($value !== null && $value !== '' && in_array($key, ['time', 'location', 'description', 'type'])) {
                    $fields[] = "$key = ?";
                    $values[] = $value;
                }
            }
            
            if (!empty($fields)) {
                $values[] = $title;
                $values[] = $currentDate;
                $sql = 'UPDATE events SET ' . implode(', ', $fields) . ' WHERE title = ? AND date >= ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
                $affected = $stmt->rowCount();
                echo json_encode(['success' => true, 'message' => "Updated $affected event(s)"]);
            } else {
                echo json_encode(['success' => true, 'message' => 'No updates provided']);
            }
            break;
            
        case 'delete':
            $eventId = $input['id'] ?? '';
            
            if ($eventId) {
                $stmt = $pdo->prepare('DELETE FROM events WHERE id = ?');
                $stmt->execute([$eventId]);
                $deleted = $stmt->rowCount();
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
                    
                    $stmt = $pdo->prepare('DELETE FROM events WHERE title = ? AND date >= ?');
                    $stmt->execute([$title, $currentDate]);
                    $deleted = $stmt->rowCount();
                    break;
                    
                case 'specificDayTitle':
                    $title = $input['title'] ?? '';
                    $date = $input['date'] ?? '';
                    
                    if (!$title || !$date) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Missing title or date']);
                        exit;
                    }
                    
                    $stmt = $pdo->prepare('DELETE FROM events WHERE title = ? AND date = ?');
                    $stmt->execute([$title, $date]);
                    $deleted = $stmt->rowCount();
                    break;
                    
                case 'allOnDay':
                    $date = $input['date'] ?? '';
                    
                    if (!$date) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Missing date']);
                        exit;
                    }
                    
                    $stmt = $pdo->prepare('DELETE FROM events WHERE date = ?');
                    $stmt->execute([$date]);
                    $deleted = $stmt->rowCount();
                    break;
                    
                default:
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid delete mode']);
                    exit;
            }
            
            echo json_encode(['success' => true, 'deleted' => $deleted, 'message' => "Deleted {$deleted} event(s)"]);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>