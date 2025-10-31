<?php
/**
 * Simple Calendar Events Handler
 * Single file that handles all CRUD operations
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Load environment variables from .env if exists
if (file_exists('.env')) {
    $lines = file('.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '=') !== false && !str_starts_with($line, '#')) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

$filename = 'calendarList.json';

function loadEvents($filename) {
    if (file_exists($filename)) {
        $data = file_get_contents($filename);
        return json_decode($data, true) ?: [];
    }
    return [];
}

function saveEvents($events, $filename) {
    // Add IDs to events that don't have them
    foreach ($events as &$event) {
        if (!isset($event['id'])) {
            $event['id'] = uniqid();
        }
    }
    
    usort($events, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });
    
    $json = json_encode($events, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents($filename, $json);
    
    // Simple FTP upload using cURL if credentials exist
    uploadToFTP($filename);
    
    return true;
}

function uploadToFTP($filename) {
    $host = $_ENV['FTP_HOST'] ?? '';
    $user = $_ENV['FTP_USER'] ?? '';
    $pass = $_ENV['FTP_PASS'] ?? '';
    $port = $_ENV['FTP_PORT'] ?? 21;
    
    if (!$host || !$user || !$pass) {
        error_log("FTP credentials missing, skipping upload");
        return false;
    }
    
    if (!extension_loaded('curl')) {
        error_log("cURL not available, skipping FTP upload");
        return false;
    }
    
    $ftpUrl = "ftp://{$host}:{$port}/" . basename($filename);
    $ch = curl_init();
    $fp = fopen($filename, 'r');
    
    if (!$fp) return false;
    
    curl_setopt($ch, CURLOPT_URL, $ftpUrl);
    curl_setopt($ch, CURLOPT_USERPWD, $user . ':' . $pass);
    curl_setopt($ch, CURLOPT_UPLOAD, 1);
    curl_setopt($ch, CURLOPT_INFILE, $fp);
    curl_setopt($ch, CURLOPT_INFILESIZE, filesize($filename));
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    curl_close($ch);
    fclose($fp);
    
    if ($result) {
        error_log("File uploaded to FTP successfully");
    }
    
    return $result;
}

// Get operation type
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$input = json_decode(file_get_contents('php://input'), true) ?: [];

switch ($action) {
    case 'list':
    case 'get':
        $events = loadEvents($filename);
        echo json_encode(['events' => $events]);
        break;
        
    case 'create':
        $events = loadEvents($filename);
        
        if (isset($input[0])) {
            // Array of events
            $events = array_merge($events, $input);
        } else {
            // Single event
            $events[] = $input;
        }
        
        saveEvents($events, $filename);
        echo json_encode(['success' => true, 'message' => 'Event(s) created']);
        break;
        
    case 'edit':
        $events = loadEvents($filename);
        $eventId = $input['id'] ?? '';
        $updates = $input['updates'] ?? $input;
        
        // Remove non-field keys from updates
        unset($updates['id'], $updates['action']);
        
        foreach ($events as &$event) {
            if ($event['id'] === $eventId) {
                foreach ($updates as $key => $value) {
                    if ($value !== null && $value !== '') {
                        $event[$key] = $value;
                    }
                }
                break;
            }
        }
        
        saveEvents($events, $filename);
        echo json_encode(['success' => true, 'message' => 'Event updated']);
        break;
        
    case 'editByTitle':
        $events = loadEvents($filename);
        $title = strtolower($input['title'] ?? '');
        $updates = $input['updates'] ?? [];
        $currentDate = date('Y-m-d');
        
        foreach ($events as &$event) {
            if (strtolower($event['title']) === $title && $event['date'] >= $currentDate) {
                foreach ($updates as $key => $value) {
                    if ($value !== null && $value !== '') {
                        $event[$key] = $value;
                    }
                }
            }
        }
        
        saveEvents($events, $filename);
        echo json_encode(['success' => true, 'message' => 'Events updated']);
        break;
        
    case 'delete':
        $events = loadEvents($filename);
        $eventId = $input['id'] ?? '';
        
        if ($eventId) {
            // Delete single event by ID
            $originalCount = count($events);
            $events = array_filter($events, function($event) use ($eventId) {
                return $event['id'] !== $eventId;
            });
            $events = array_values($events);
            saveEvents($events, $filename);
            
            $deleted = $originalCount - count($events);
            echo json_encode(['success' => true, 'deleted' => $deleted, 'message' => "Deleted event"]);
            break;
        }
        
        // Bulk delete operations
        $mode = $input['mode'] ?? '';
        $originalCount = count($events);
        
        switch ($mode) {
            case 'upcomingTitle':
                $title = strtolower($input['title'] ?? '');
                $currentDate = date('Y-m-d');
                $events = array_filter($events, function($event) use ($title, $currentDate) {
                    return !(strtolower($event['title']) === $title && $event['date'] >= $currentDate);
                });
                break;
                
            case 'specificDayTitle':
                $title = strtolower($input['title'] ?? '');
                $date = $input['date'] ?? '';
                $events = array_filter($events, function($event) use ($title, $date) {
                    return !(strtolower($event['title']) === $title && $event['date'] === $date);
                });
                break;
                
            case 'allOnDay':
                $date = $input['date'] ?? '';
                $events = array_filter($events, function($event) use ($date) {
                    return $event['date'] !== $date;
                });
                break;
                
            default:
                echo json_encode(['error' => 'Invalid delete mode']);
                exit;
        }
        
        $events = array_values($events);
        saveEvents($events, $filename);
        
        $deleted = $originalCount - count($events);
        echo json_encode(['success' => true, 'deleted' => $deleted, 'message' => "Deleted {$deleted} event(s)"]);
        break;
        
    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}
?>