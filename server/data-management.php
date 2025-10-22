<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Load .env file
$env = parse_ini_file('.env');
if ($env === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load .env file']);
    exit;
}

// Database connection
try {
    $dsn = "mysql:host={$env['host2']};port={$env['port2']};dbname={$env['database2']};charset=utf8mb4";
    $pdo = new PDO($dsn, $env['user2'], $env['password2'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Helper function to send response
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Get request method and table
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));
$table = isset($pathParts[0]) ? $pathParts[0] : '';
$id = isset($pathParts[1]) ? $pathParts[1] : null;

// Validate table
$validTables = ['calendar', 'history', 'media', 'news', 'teams', 'tournaments'];
if (!in_array($table, $validTables)) {
    sendResponse(['error' => 'Invalid table'], 400);
}

// Handle requests
switch ($method) {
    case 'GET':
        if ($id) {
            // Get single record
            $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = ?");
            $stmt->execute([$id]);
            $result = $stmt->fetch();
            if ($result) {
                sendResponse($result);
            } else {
                sendResponse(['error' => 'Record not found'], 404);
            }
        } else {
            // Get all records
            $stmt = $pdo->query("SELECT * FROM `$table`");
            $results = $stmt->fetchAll();
            sendResponse($results);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            sendResponse(['error' => 'Invalid JSON data'], 400);
        }

        // Prepare column names and placeholders
        $columns = array_keys($data);
        $placeholders = array_fill(0, count($columns), '?');
        $columnList = implode(',', $columns);
        $placeholderList = implode(',', $placeholders);

        // Validate required fields based on table
        $requiredFields = [
            'calendar' => ['title', 'date', 'time', 'location', 'description', 'type', 'id'],
            'history' => ['date', 'text', 'id'],
            'media' => ['src', 'title', 'description', 'children', 'id'],
            'news' => ['title', 'description', 'image', 'link', 'id'],
            'teams' => ['name', 'league', 'image', 'url', 'captain', 'contact', 'nextMatch', 'venue', 'record', 'squad', 'notes', 'founded', 'id'],
            'tournaments' => ['type', 'year', 'first', 'second', 'third', 'id']
        ];

        foreach ($requiredFields[$table] as $field) {
            if (!isset($data[$field])) {
                sendResponse(['error' => "Missing required field: $field"], 400);
            }
        }

        // Validate JSON fields
        if ($table === 'media' && !json_decode($data['children'], true)) {
            sendResponse(['error' => 'Invalid JSON in children field'], 400);
        }
        if ($table === 'teams') {
            if (!json_decode($data['record'], true) || !json_decode($data['squad'], true)) {
                sendResponse(['error' => 'Invalid JSON in record or squad field'], 400);
            }
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO `$table` ($columnList) VALUES ($placeholderList)");
            $stmt->execute(array_values($data));
            sendResponse(['message' => 'Record created', 'id' => $data['id']]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'Failed to create record: ' . $e->getMessage()], 500);
        }
        break;

    case 'PUT':
        if (!$id) {
            sendResponse(['error' => 'ID required for update'], 400);
        }
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            sendResponse(['error' => 'Invalid JSON data'], 400);
        }

        // Prepare update query
        $updates = [];
        $values = [];
        foreach ($data as $key => $value) {
            $updates[] = "$key = ?";
            $values[] = $value;
        }
        $updateList = implode(',', $updates);

        try {
            $stmt = $pdo->prepare("UPDATE `$table` SET $updateList WHERE id = ?");
            $values[] = $id;
            $stmt->execute($values);
            if ($stmt->rowCount() > 0) {
                sendResponse(['message' => 'Record updated']);
            } else {
                sendResponse(['error' => 'Record not found or no changes made'], 404);
            }
        } catch (PDOException $e) {
            sendResponse(['error' => 'Failed to update record: ' . $e->getMessage()], 500);
        }
        break;

    case 'DELETE':
        if (!$id) {
            sendResponse(['error' => 'ID required for delete'], 400);
        }
        try {
            $stmt = $pdo->prepare("DELETE FROM `$table` WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() > 0) {
                sendResponse(['message' => 'Record deleted']);
            } else {
                sendResponse(['error' => 'Record not found'], 404);
            }
        } catch (PDOException $e) {
            sendResponse(['error' => 'Failed to delete record: ' . $e->getMessage()], 500);
        }
        break;

    default:
        sendResponse(['error' => 'Method not allowed'], 405);
}
?>