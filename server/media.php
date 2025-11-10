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

$uploadBaseDir = __DIR__ . '/../photos/';

if (!is_dir($uploadBaseDir)) {
    mkdir($uploadBaseDir, 0755, true);
}

function listFilesInDirectory($directory, $relativePath = '') {
    $files = [];
    
    if (!is_dir($directory)) {
        return $files;
    }
    
    $items = scandir($directory);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $fullPath = $directory . '/' . $item;
        $relPath = $relativePath ? $relativePath . '/' . $item : $item;
        
        if (is_dir($fullPath)) {
            $subFiles = listFilesInDirectory($fullPath, $relPath);
            $files = array_merge($files, $subFiles);
        } else {
            $files[] = $relPath;
        }
    }
    
    return $files;
}

$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;

$input = $_GET;
$id = $input['id'] ?? null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST' || $method === 'DELETE' || $method === 'PUT' || $method === 'PATCH') {
        $user = requireAuthentication(['admin']);
        error_log("Authenticated user '{$user['username']}' performing $method operation on media");
    }

    if ($method === 'GET') {
        $action = $input['action'] ?? '';
        
        if ($action === 'scan') {
            $title = $input['title'] ?? '';
            if (!$title) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Title is required for scanning']);
                exit;
            }
            
            $targetDir = rtrim($uploadBaseDir, '/') . '/' . $title;
            
            if (!is_dir($targetDir)) {
                echo json_encode([
                    'success' => true, 
                    'files' => [], 
                    'scanned_path' => '/photos/' . $title,
                    'message' => 'Directory does not exist yet'
                ]);
                exit;
            }
            
            $files = listFilesInDirectory($targetDir, $title);
            echo json_encode([
                'success' => true, 
                'files' => $files, 
                'scanned_path' => '/photos/' . $title,
                'file_count' => count($files)
            ]);
            exit;
        }
        
        if ($id) {
            $stmt = $pdo->prepare('SELECT id, src, title, description, children FROM media WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        $stmt = $pdo->query('SELECT id, src, title, description, children FROM media ORDER BY id DESC');
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        if (!empty($_FILES)) {
            $action = $_POST['action'] ?? '';
            if ($action === 'upload') {
                $title = $_POST['title'] ?? '';
                if (!$title) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Title is required for upload']);
                    exit;
                }
                
                $targetDir = rtrim($uploadBaseDir, '/') . '/' . $title;
                if (!is_dir($targetDir)) {
                    if (!mkdir($targetDir, 0755, true)) {
                        http_response_code(500);
                        echo json_encode([
                            'success' => false, 
                            'message' => 'Could not create upload directory',
                            'details' => "Failed to create directory: $targetDir"
                        ]);
                        exit;
                    }
                }
                
                $allowedExtensions = array('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'pdf');
                
                $uploadedFiles = [];
                $errors = [];
                
                foreach ($_FILES as $file) {
                    if ($file['error'] === UPLOAD_ERR_OK) {
                        $fileTmpPath = $file['tmp_name'];
                        $fileName = basename($file['name']);
                        $fileNameCmps = explode(".", $fileName);
                        $fileExtension = strtolower(end($fileNameCmps));
                        
                        if (!in_array($fileExtension, $allowedExtensions)) {
                            $errors[] = "File type not allowed: $fileName (.$fileExtension)";
                            continue;
                        }
                        
                        $newFileName = md5(time() . $fileName . rand()) . '.' . $fileExtension;
                        $destPath = $targetDir . '/' . $newFileName;
                        
                        if (move_uploaded_file($fileTmpPath, $destPath)) {
                            $relativePath = $title . '/' . $newFileName;
                            $uploadedFiles[] = $relativePath;
                        } else {
                            $errors[] = "Failed to move uploaded file: $fileName";
                        }
                    } else {
                        $errorMsg = 'Unknown error';
                        switch ($file['error']) {
                            case UPLOAD_ERR_INI_SIZE:
                            case UPLOAD_ERR_FORM_SIZE:
                                $errorMsg = 'File too large';
                                break;
                            case UPLOAD_ERR_PARTIAL:
                                $errorMsg = 'Partial upload';
                                break;
                            case UPLOAD_ERR_NO_FILE:
                                $errorMsg = 'No file uploaded';
                                break;
                        }
                        $errors[] = "Upload error for file: " . ($file['name'] ?? 'unknown') . " ($errorMsg)";
                    }
                }
                
                echo json_encode([
                    'success' => true, 
                    'files' => $uploadedFiles,
                    'errors' => $errors,
                    'uploaded_count' => count($uploadedFiles),
                    'target_path' => '/photos/' . $title
                ]);
                exit;
            }
        }
        
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) && $data['id'] !== '' ? (int)$data['id'] : null;
        $src = trim($data['src'] ?? '');
        $title = trim($data['title'] ?? '');
        $description = trim($data['description'] ?? '');
        $children = $data['children'] ?? '[]';

        if (is_array($children)) {
            $children = json_encode($children, JSON_UNESCAPED_SLASHES);
        } else if (is_string($children)) {
            $decoded = json_decode($children);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid JSON in children field']);
                exit;
            }
            $children = json_encode($decoded, JSON_UNESCAPED_SLASHES);
        }

        if ($src === '' || $title === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: src and title']);
            exit;
        }

        if ($id) {
            $check = $pdo->prepare('SELECT id FROM media WHERE id = ? LIMIT 1');
            $check->execute([$id]);
            $exists = (bool)$check->fetch();

            if ($exists) {
                $stmt = $pdo->prepare('UPDATE media SET src = ?, title = ?, description = ?, children = ? WHERE id = ?');
                $stmt->execute([$src, $title, $description, $children, $id]);
                echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
                exit;
            } else {
                $stmt = $pdo->prepare('INSERT INTO media (id, src, title, description, children) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([$id, $src, $title, $description, $children]);
                echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
                exit;
            }
        } else {
            $stmt = $pdo->prepare('INSERT INTO media (src, title, description, children) VALUES (?, ?, ?, ?)');
            $stmt->execute([$src, $title, $description, $children]);
            $newId = (int)$pdo->lastInsertId();
            echo json_encode(['success' => true, 'message' => 'Created', 'id' => $newId]);
            exit;
        }
    }

    if ($method === 'DELETE') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_GET;

        $id = isset($data['id']) ? (int)$data['id'] : null;

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id for deletion']);
            exit;
        }

        $stmt = $pdo->prepare('DELETE FROM media WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Deleted', 'id' => $id]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
