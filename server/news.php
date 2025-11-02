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

// Read env file (single .env). This file should contain host2,user2,password2,database2,port2 keys.
$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $env = parse_ini_file($envFile);

$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;

$input = $_GET;
$slug = $input['slug'] ?? null;

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if ($slug) {
            $stmt = $pdo->prepare('SELECT id, slug, title, description, content, date, image, link FROM news WHERE slug = ? LIMIT 1');
            $stmt->execute([$slug]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
                exit;
            }
            echo json_encode($row);
            exit;
        }

        // no slug -> return list of news (id, slug, title, date, description)
        $stmt = $pdo->query('SELECT id, slug, title, description, date, image FROM news ORDER BY date DESC LIMIT 50');
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($method === 'POST') {
        // accept JSON body or form-encoded
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_POST;

        // Required fields for create/update: slug, title
        $id = isset($data['id']) && $data['id'] !== '' ? (int)$data['id'] : null;
        $slugv = trim($data['slug'] ?? '');
        $title = trim($data['title'] ?? '');
        $description = trim($data['description'] ?? '');
        $content = $data['content'] ?? null;
        $date = $data['date'] ?? date('Y-m-d H:i:s');
        // link and image are optional; store empty string if not provided
        $image = isset($data['image']) ? trim((string)$data['image']) : '';
        $link = isset($data['link']) ? trim((string)$data['link']) : '';

        if ($slugv === '' || $title === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields: slug and title']);
            exit;
        }

        if ($id) {
            // if id provided, check if row exists
            $check = $pdo->prepare('SELECT id FROM news WHERE id = ? LIMIT 1');
            $check->execute([$id]);
            $exists = (bool)$check->fetch();

            // enforce slug uniqueness
            if ($exists) {
                $slugCheck = $pdo->prepare('SELECT id FROM news WHERE slug = ? AND id != ? LIMIT 1');
                $slugCheck->execute([$slugv, $id]);
            } else {
                $slugCheck = $pdo->prepare('SELECT id FROM news WHERE slug = ? LIMIT 1');
                $slugCheck->execute([$slugv]);
            }
            if ($slugCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Slug already exists']);
                exit;
            }

            if ($exists) {
                // update existing
                $stmt = $pdo->prepare('UPDATE news SET slug = ?, title = ?, description = ?, content = ?, date = ?, image = ?, link = ? WHERE id = ?');
                $stmt->execute([$slugv, $title, $description, $content, $date, $image, $link, $id]);
                echo json_encode(['success' => true, 'message' => 'Updated', 'id' => $id]);
                exit;
            } else {
                // insert with provided id
                $stmt = $pdo->prepare('INSERT INTO news (id, slug, title, description, content, date, image, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $slugv, $title, $description, $content, $date, $image, $link]);
                echo json_encode(['success' => true, 'message' => 'Created', 'id' => $id]);
                exit;
            }
        } else {
            // enforce slug uniqueness for auto-increment insert
            $slugCheck = $pdo->prepare('SELECT id FROM news WHERE slug = ? LIMIT 1');
            $slugCheck->execute([$slugv]);
            if ($slugCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Slug already exists']);
                exit;
            }

            // insert without id (auto-increment)
            $stmt = $pdo->prepare('INSERT INTO news (slug, title, description, content, date, image, link) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$slugv, $title, $description, $content, $date, $image, $link]);
            $newId = (int)$pdo->lastInsertId();
            echo json_encode(['success' => true, 'message' => 'Created', 'id' => $newId]);
            exit;
        }
    }

    if ($method === 'DELETE') {
        // accept JSON body or query param
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) $data = $_GET;

        $id = isset($data['id']) ? (int)$data['id'] : null;
        $slugv = isset($data['slug']) ? trim($data['slug']) : null;

        if (!$id && !$slugv) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing id or slug for deletion']);
            exit;
        }

        if ($id) {
            $stmt = $pdo->prepare('DELETE FROM news WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Deleted', 'id' => $id]);
            exit;
        }

        if ($slugv) {
            $stmt = $pdo->prepare('DELETE FROM news WHERE slug = ?');
            $stmt->execute([$slugv]);
            echo json_encode(['success' => true, 'message' => 'Deleted', 'slug' => $slugv]);
            exit;
        }
    }

    // If method not handled
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection error: ' . $e->getMessage()]);
    exit;
}

?>
