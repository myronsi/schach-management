<?php

$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $env = parse_ini_file($envFile);

$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;
$fromEmail = $env['from_email'] ?? 'no-reply@sc-laufenburg.de';

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";
    $db = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $stmt = $db->query("SELECT * FROM email_queue WHERE sent = 0 ORDER BY created_at ASC LIMIT 50");
    $emails = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($emails)) {
        echo "No emails in queue to send\n";
        exit;
    }

    $sentCount = 0;
    $failedCount = 0;

    foreach ($emails as $mail) {
        try {
            $isHtml = !empty($mail['is_html']) && $mail['is_html'] == 1;
            
            $headers = "From: {$fromEmail}\r\n";
            if ($isHtml) {
                $headers .= "MIME-Version: 1.0\r\n";
                $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            } else {
                $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
            }
            
            $success = mail(
                $mail['email'],
                $mail['subject'],
                $mail['body'],
                $headers
            );

            if ($success) {
                $upd = $db->prepare("UPDATE email_queue SET sent = 1, sent_at = NOW() WHERE id = ?");
                $upd->execute([$mail['id']]);
                $sentCount++;
            } else {
                $upd = $db->prepare("UPDATE email_queue SET failed = 1, error_message = ? WHERE id = ?");
                $upd->execute(['mail() function returned false', $mail['id']]);
                $failedCount++;
                error_log("Failed to send email to {$mail['email']}: mail() returned false");
            }
        } catch (Exception $e) {
            $upd = $db->prepare("UPDATE email_queue SET failed = 1, error_message = ? WHERE id = ?");
            $upd->execute([$e->getMessage(), $mail['id']]);
            $failedCount++;
            error_log("Failed to send email to {$mail['email']}: {$e->getMessage()}");
        }
    }

    echo "Emails processed: $sentCount sent, $failedCount failed\n";

} catch (PDOException $e) {
    http_response_code(500);
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}

?>
