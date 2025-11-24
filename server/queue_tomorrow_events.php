<?php

$envEvents = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) $envEvents = parse_ini_file($envFile);

$hostEvents = $envEvents['host2'] ?? '';
$userEvents = $envEvents['user2'] ?? '';
$passwordEvents = $envEvents['password2'] ?? '';
$databaseEvents = $envEvents['database2'] ?? '';
$portEvents = isset($envEvents['port2']) ? (int)$envEvents['port2'] : 3306;

$envUsers = [];
$envFileUsers = __DIR__ . '/.env.auth';
if (file_exists($envFileUsers)) $envUsers = parse_ini_file($envFileUsers);

$hostUsers = $envUsers['host'] ?? '';
$userUsers = $envUsers['user'] ?? '';
$passwordUsers = $envUsers['password'] ?? '';
$databaseUsers = $envUsers['database'] ?? '';
$portUsers = isset($envUsers['port']) ? (int)$envUsers['port'] : 3306;

try {
    $dsn = "mysql:host=$hostEvents;dbname=$databaseEvents;port=$portEvents;charset=utf8mb4";
    $db = new PDO($dsn, $userEvents, $passwordEvents, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $dsnUsers = "mysql:host=$hostUsers;dbname=$databaseUsers;port=$portUsers;charset=utf8mb4";
    $dbUsers = new PDO($dsnUsers, $userUsers, $passwordUsers, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $tomorrow = date("Y-m-d", strtotime("+1 day"));

    $stmt = $db->prepare("SELECT * FROM events WHERE date = ? OR date LIKE ?");
    $stmt->execute([$tomorrow, "$tomorrow:%"]);
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($events)) {
        echo "No events tomorrow ($tomorrow)\n";
        exit;
    }

    $users = $dbUsers->query("SELECT username, email, first_name, last_name, `status` FROM users WHERE notify_events = 1 AND email IS NOT NULL AND email != '' AND (status IS NULL OR status != 'blocked')")->fetchAll(PDO::FETCH_ASSOC);

    if (empty($users)) {
        echo "No users with notifications enabled\n";
        exit;
    }

    $queuedCount = 0;

    foreach ($events as $event) {
        $eventDate = $event['date'];
        $startDate = $eventDate;
        $endDate = null;
        
        if (strpos($eventDate, ':') !== false) {
            list($startDate, $endDate) = explode(':', $eventDate, 2);
        }

        if ($startDate !== $tomorrow) {
            continue;
        }

        foreach ($users as $user) {
            if (empty($user['email'])) {
                continue;
            }

            $formatDate = function($dateStr) {
                $months = [
                    1 => 'Jan.', 2 => 'Feb.', 3 => 'Mär.', 4 => 'Apr.',
                    5 => 'Mai', 6 => 'Jun.', 7 => 'Jul.', 8 => 'Aug.',
                    9 => 'Sep.', 10 => 'Okt.', 11 => 'Nov.', 12 => 'Dez.'
                ];
                $timestamp = strtotime($dateStr);
                $day = date('d', $timestamp);
                $month = (int)date('m', $timestamp);
                $year = date('Y', $timestamp);
                return "$day. {$months[$month]} $year";
            };

            $firstName = !empty($user['first_name']) ? $user['first_name'] : '';
            $lastName = !empty($user['last_name']) ? $user['last_name'] : '';
            $greeting = "Hallo";
            if ($firstName && $lastName) {
                $greeting = "Hallo $firstName $lastName";
            } elseif ($firstName) {
                $greeting = "Hallo $firstName";
            }

            $subject = "Erinnerung: Ereignis «{$event['title']}» findet morgen statt!";
            
            $formattedStartDate = $formatDate($startDate);
            
            $body = "<!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #2c5f2d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
                    .event-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .detail-row { margin: 12px 0; }
                    .detail-label { font-weight: bold; color: #2c5f2d; }
                    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 2px solid #2c5f2d; font-size: 0.9em; color: #666; }
                    .signature { margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h2>Schachclub Laufenburg</h2>
                    </div>
                    <div class='content'>
                        <p><strong>$greeting,</strong></p>
                        <p>Wir möchten Sie daran erinnern, dass morgen folgendes Ereignis stattfindet:</p>
                        
                        <div class='event-details'>
                            <div class='detail-row'>
                                <span class='detail-label'>Titel:</span> {$event['title']}
                            </div>
                            <div class='detail-row'>
                                <span class='detail-label'>Datum:</span> $formattedStartDate";
                        
                        if ($endDate) {
                            $formattedEndDate = $formatDate($endDate);
                            $body .= " bis $formattedEndDate";
                        }
                        
                        $body .= "</div>";
                        
                        if (!empty($event['time'])) {
                            $body .= "
                            <div class='detail-row'>
                                <span class='detail-label'>Uhrzeit:</span> {$event['time']} Uhr
                            </div>";
                        }
                        
                        if (!empty($event['location'])) {
                            $body .= "
                            <div class='detail-row'>
                                <span class='detail-label'>Ort:</span> {$event['location']}
                            </div>";
                        }
                        
                        if (!empty($event['description'])) {
                            $body .= "
                            <div class='detail-row' style='margin-top: 20px;'>
                                <span class='detail-label'>Beschreibung:</span>
                                <div style='margin-top: 8px;'>" . nl2br(htmlspecialchars($event['description'])) . "</div>
                            </div>";
                        }
                        
                        $body .= "
                        </div>
                        
                    </div>
                    
                    <div class='footer'>
                        <div class='signature'>
                            <strong>Mit freundlichen Grüßen</strong><br>
                            Schachclub Laufenburg<br>
                            <br>
                            <em>Diese E-Mail wurde automatisch generiert.</em><br>
                            <small>Sie erhalten diese Benachrichtigung, weil Sie E-Mail-Erinnerungen in Ihrem Mitgliederprofil aktiviert haben.</small>
                        </div>
                        <a href='https://sc-laufenburg.de' target='_blank' rel='noopener noreferrer'>
                            <img src='https://sc-laufenburg.de/photos/email_footer.png' alt='Schachclub Laufenburg' style='width:550px; border:0; display:block; margin:0 auto;'>
                        </a>
                    </div>
                </div>
            </body>
            </html>";

            $checkStmt = $db->prepare("
                SELECT id FROM email_queue 
                WHERE email = ? AND event_id = ? AND DATE(created_at) = CURDATE()
                LIMIT 1
            ");
            $checkStmt->execute([$user['email'], $event['id']]);
            
            if ($checkStmt->fetch()) {
                continue;
            }

            $insert = $db->prepare("
                INSERT INTO email_queue (event_id, email, subject, body, created_at, is_html)
                VALUES (?, ?, ?, ?, NOW(), 1)
            ");
            $insert->execute([
                $event['id'],
                $user['email'],
                $subject,
                $body
            ]);
            
            $queuedCount++;
        }
    }

    echo "Queue updated: $queuedCount emails queued for " . count($events) . " event(s) tomorrow ($tomorrow)\n";

} catch (PDOException $e) {
    http_response_code(500);
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}

?>
