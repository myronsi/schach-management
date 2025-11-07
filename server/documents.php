<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT, PATCH');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: false');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $env = parse_ini_file($envFile);

$uploadBaseDir = __DIR__ . '/../docs/';

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
            $fileSize = filesize($fullPath);
            $files[] = [
                'path' => $relPath,
                'size' => $fileSize,
                'name' => $item
            ];
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
$docId = isset($input['id']) ? (int)$input['id'] : null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $action = $input['action'] ?? '';
        
        if ($action === 'scan') {
            $scanPath = $input['path'] ?? '';
            if (!$scanPath) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Path is required for scanning']);
                exit;
            }
            
            $scanPath = ltrim($scanPath, '/');
            
            $targetDir = rtrim($uploadBaseDir, '/') . '/' . $scanPath;
            
            if (!is_dir($targetDir)) {
                echo json_encode([
                    'success' => true, 
                    'files' => [], 
                    'scanned_path' => '/docs/' . $scanPath,
                    'message' => 'Directory does not exist'
                ]);
                exit;
            }
            
            $files = listFilesInDirectory($targetDir, $scanPath);
            
            $transformedFiles = array_map(function($file) {
                return [
                    'filepath' => '/docs/' . $file['path'],
                    'filename' => $file['name'],
                    'size' => $file['size']
                ];
            }, $files);
            
            echo json_encode([
                'success' => true, 
                'files' => $transformedFiles, 
                'scanned_path' => '/docs/' . $scanPath,
                'file_count' => count($transformedFiles)
            ]);
            exit;
        }
        
        if ($docId) {
            $stmt = $pdo->prepare('SELECT id, name, filename, filepath, category, description, file_size, upload_date, updated_at, is_active FROM documents WHERE id = ? LIMIT 1');
            $stmt->execute([$docId]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Document not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        $category = isset($input['category']) ? trim($input['category']) : null;
        $activeOnly = isset($input['active_only']) ? filter_var($input['active_only'], FILTER_VALIDATE_BOOLEAN) : false;
        $search = isset($input['search']) ? trim($input['search']) : null;

        $sql = 'SELECT id, name, filename, filepath, category, description, file_size, upload_date, updated_at, is_active FROM documents WHERE 1=1';
        $params = [];

        if ($activeOnly) {
            $sql .= ' AND is_active = 1';
        }

        if ($category) {
            $sql .= ' AND category = ?';
            $params[] = $category;
        }

        if ($search) {
            $sql .= ' AND (name LIKE ? OR filename LIKE ? OR description LIKE ?)';
            $searchParam = '%' . $search . '%';
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
        }

        $sql .= ' ORDER BY name ASC LIMIT 200';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        if (!empty($_FILES)) {
            $action = $_POST['action'] ?? '';
            if ($action === 'upload') {
                $category = $_POST['category'] ?? 'sonstiges';
                
                $targetDir = rtrim($uploadBaseDir, '/') . '/' . $category;
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
                
                $allowedExtensions = array('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'odt', 'ods', 'odp', 'zip', 'rar', 'jpg', 'jpeg', 'png', 'gif');
                
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
                        
                        $baseName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($fileName, PATHINFO_FILENAME));
                        $newFileName = $baseName . '_' . time() . '.' . $fileExtension;
                        $destPath = $targetDir . '/' . $newFileName;
                        
                        if (move_uploaded_file($fileTmpPath, $destPath)) {
                            $fileSize = filesize($destPath);
                            $relativePath = '/docs/' . $category . '/' . $newFileName;
                            
                            $uploadedFiles[] = [
                                'filepath' => $relativePath,
                                'filename' => $fileName,
                                'size' => $fileSize,
                                'category' => $category
                            ];
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
                    'target_path' => '/docs/' . $category
                ]);
                exit;
            }
        }
        
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) && $data['id'] !== '' ? (int)$data['id'] : null;
        
        $documentExists = false;
        if ($id) {
            $check = $pdo->prepare('SELECT id FROM documents WHERE id = ? LIMIT 1');
            $check->execute([$id]);
            $documentExists = (bool)$check->fetch();
        }
        
        if ($id && $documentExists) {

            $updateFields = [];
            $updateParams = [];

            if (isset($data['name'])) {
                $updateFields[] = 'name = ?';
                $updateParams[] = trim($data['name']);
            }
            if (isset($data['filename'])) {
                $updateFields[] = 'filename = ?';
                $updateParams[] = trim($data['filename']);
            }
            if (isset($data['filepath'])) {
                $updateFields[] = 'filepath = ?';
                $updateParams[] = trim($data['filepath']);
            }
            if (isset($data['category'])) {
                $updateFields[] = 'category = ?';
                $updateParams[] = trim($data['category']);
            }
            if (isset($data['description'])) {
                $updateFields[] = 'description = ?';
                $updateParams[] = trim($data['description']);
            }
            if (isset($data['file_size'])) {
                $updateFields[] = 'file_size = ?';
                $updateParams[] = (int)$data['file_size'];
            }
            if (isset($data['is_active'])) {
                $updateFields[] = 'is_active = ?';
                $updateParams[] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            }

            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No fields to update']);
                exit;
            }

            $updateParams[] = $id;
            $sql = 'UPDATE documents SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($updateParams);

            echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
            exit;
        }
        
        $name = trim($data['name'] ?? '');
        $filename = trim($data['filename'] ?? '');
        $filepath = trim($data['filepath'] ?? '');
        $category = isset($data['category']) ? trim($data['category']) : null;
        $description = isset($data['description']) ? trim($data['description']) : null;
        $fileSize = isset($data['file_size']) ? (int)$data['file_size'] : null;
        $isActive = isset($data['is_active']) ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) : true;

        if ($name === '' || $filepath === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: name and filepath']);
            exit;
        }

        if ($filename === '') {
            $filename = basename($filepath);
        }

        if ($id) {
            $stmt = $pdo->prepare('INSERT INTO documents (id, name, filename, filepath, category, description, file_size, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $name, $filename, $filepath, $category, $description, $fileSize, $isActive ? 1 : 0]);
            echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO documents (name, filename, filepath, category, description, file_size, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$name, $filename, $filepath, $category, $description, $fileSize, $isActive ? 1 : 0]);
            $newId = (int)$pdo->lastInsertId();
            echo json_encode(['success' => true, 'message' => 'Created', 'id' => $newId]);
        }
        exit;
    }

    if ($method === 'PATCH' || $method === 'PUT') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        $id = isset($data['id']) ? (int)$data['id'] : null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id for update']);
            exit;
        }

        $check = $pdo->prepare('SELECT id FROM documents WHERE id = ? LIMIT 1');
        $check->execute([$id]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Document not found']);
            exit;
        }

        $updateFields = [];
        $updateParams = [];

        if (isset($data['name'])) {
            $updateFields[] = 'name = ?';
            $updateParams[] = trim($data['name']);
        }
        if (isset($data['filename'])) {
            $updateFields[] = 'filename = ?';
            $updateParams[] = trim($data['filename']);
        }
        if (isset($data['filepath'])) {
            $updateFields[] = 'filepath = ?';
            $updateParams[] = trim($data['filepath']);
        }
        if (isset($data['category'])) {
            $updateFields[] = 'category = ?';
            $updateParams[] = trim($data['category']);
        }
        if (isset($data['description'])) {
            $updateFields[] = 'description = ?';
            $updateParams[] = trim($data['description']);
        }
        if (isset($data['file_size'])) {
            $updateFields[] = 'file_size = ?';
            $updateParams[] = (int)$data['file_size'];
        }
        if (isset($data['is_active'])) {
            $updateFields[] = 'is_active = ?';
            $updateParams[] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }

        if (empty($updateFields)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No fields to update']);
            exit;
        }

        $updateParams[] = $id;
        $sql = 'UPDATE documents SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($updateParams);

        echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
        exit;
    }

    if ($method === 'DELETE') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_GET;

        $id = isset($data['id']) ? (int)$data['id'] : null;
        $hardDelete = isset($data['hard']) ? filter_var($data['hard'], FILTER_VALIDATE_BOOLEAN) : false;

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id for deletion']);
            exit;
        }

        if ($hardDelete) {
            $stmt = $pdo->prepare('DELETE FROM documents WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Permanently deleted', 'id' => $id]);
        } else {
            $stmt = $pdo->prepare('UPDATE documents SET is_active = 0 WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Document deactivated', 'id' => $id]);
        }
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
