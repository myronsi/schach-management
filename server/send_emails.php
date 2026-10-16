<?php

require_once __DIR__ . '/cron-guard.php';

$env = contentEnv();
$fromEmail = $env['from_email'] ?? 'no-reply@sc-laufenburg.de';

try {
    $db = contentDb();

    $stmt = $db->query("SELECT * FROM email_queue WHERE sent = 0 AND (failed IS NULL OR failed = 0) ORDER BY created_at ASC LIMIT 50");
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
            
            $headers = 'From: ' . preg_replace('/[\r\n]+/', '', $fromEmail) . "\r\n";
            if ($isHtml) {
                $headers .= "MIME-Version: 1.0\r\n";
                $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            } else {
                $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
            }
            
            $success = mail(
                $mail['email'],
                encodeMailHeader((string)$mail['subject']),
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
    error_log('send_emails.php: ' . $e->getMessage());
    http_response_code(500);
    echo "Database error\n";
    exit(1);
}
