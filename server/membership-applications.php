<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PATCH');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: false');
header('Vary: Origin');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$env = [];
$envFile = __DIR__ . '/.env.auth';

if (file_exists($envFile)) {
    $env = parse_ini_file($envFile);
}

$host = $env['host'] ?? '';
$user = $env['user'] ?? '';
$password = $env['password'] ?? '';
$database = $env['database'] ?? '';
$port = isset($env['port']) ? (int)$env['port'] : 3306;

function validSignature($value): bool
{
    return is_string($value)
        && preg_match('/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/', $value) === 1
        && (($bytes = base64_decode(
            substr($value, strpos($value, ',') + 1),
            true
        )) !== false)
        && strlen($bytes) <= 1024 * 1024;
}

try {
    $dsn = "mysql:host=$host;dbname=$database;port=$port;charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $chairman = requireAuthentication(['chairman']);

        $stmt = $pdo->query(
            'SELECT *
             FROM membership_applications
             ORDER BY submitted_at DESC'
        );

        echo json_encode($stmt->fetchAll());
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        $data = $_POST;
    }

    if ($method === 'POST') {

        $required = [
            'first_name',
            'last_name',
            'address',
            'postal_city',
            'birth_date',
            'email',
            'nationality',
            'gender',
            'membership_type',
            'application_place',
            'application_date',
            'signature',
            'signed_at'
        ];

        foreach ($required as $field) {
            if (
                !isset($data[$field]) ||
                trim((string)$data[$field]) === ''
            ) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Pflichtfeld fehlt: ' . $field
                ]);
                exit;
            }
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültige E-Mail-Adresse'
            ]);
            exit;
        }

        if (
            !in_array(
                $data['nationality'],
                ['Deutsch', 'EU-Angehöriger'],
                true
            )
            && !str_starts_with(
                (string)$data['nationality'],
                'Sonstige: '
            )
        ) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültige Staatsangehörigkeit'
            ]);
            exit;
        }

        if (!in_array(
            $data['gender'],
            ['männlich', 'weiblich'],
            true
        )) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültiges Geschlecht'
            ]);
            exit;
        }

        if (!in_array(
            $data['membership_type'],
            ['Aktivmitglied', 'Passivmitglied'],
            true
        )) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültige Mitgliedschaftsart'
            ]);
            exit;
        }

        if (!validSignature($data['signature'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültige digitale Unterschrift'
            ]);
            exit;
        }

        if (
            !empty($data['guardian_signature'])
            && !validSignature($data['guardian_signature'])
        ) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' =>
                    'Ungültige Unterschrift des gesetzlichen Vertreters'
            ]);
            exit;
        }

        /*
         * Optional Einzugsermächtigung.
         */
        if (!empty($data['direct_debit'])) {

            foreach (['bank_name', 'bic', 'iban'] as $field) {

                if (
                    !isset($data[$field])
                    || trim((string)$data[$field]) === ''
                ) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Pflichtfeld fehlt: ' . $field
                    ]);
                    exit;
                }
            }

            if (!validSignature($data['debit_signature'] ?? '')) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' =>
                        'Bitte die Einzugsermächtigung unterschreiben'
                ]);
                exit;
            }
        }

        $signedAt = strtotime((string)$data['signed_at']);

        if ($signedAt === false) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültiger Signaturzeitpunkt'
            ]);
            exit;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO membership_applications (
                first_name,
                last_name,
                address,
                postal_city,
                birth_date,
                birth_place,
                phone,
                email,
                nationality,
                gender,
                previous_club,
                membership_type,
                application_place,
                application_date,
                direct_debit,
                bank_name,
                bic,
                iban,
                account_holder,
                signature,
                guardian_signature,
                debit_signature,
                signed_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )'
        );

        $stmt->execute([
            trim($data['first_name']),
            trim($data['last_name']),
            trim($data['address']),
            trim($data['postal_city']),
            $data['birth_date'],
            trim($data['birth_place'] ?? ''),
            trim($data['phone'] ?? ''),
            trim($data['email']),
            trim($data['nationality']),
            trim($data['gender']),
            trim($data['previous_club'] ?? ''),
            trim($data['membership_type']),
            trim($data['application_place']),
            $data['application_date'],
            !empty($data['direct_debit']) ? 1 : 0,
            trim($data['bank_name'] ?? ''),
            trim($data['bic'] ?? ''),
            trim($data['iban'] ?? ''),
            trim($data['account_holder'] ?? ''),
            $data['signature'],
            trim($data['guardian_signature'] ?? ''),
            trim($data['debit_signature'] ?? ''),
            date('Y-m-d H:i:s', $signedAt)
        ]);

        echo json_encode([
            'success' => true,
            'id' => (int)$pdo->lastInsertId()
        ]);

        exit;
    }

    if ($method === 'PATCH') {

        $chairman = requireAuthentication(['chairman']);

        $id = isset($data['id'])
            ? (int)$data['id']
            : 0;

        $status = $data['status'] ?? '';

        if (
            $id < 1
            || !in_array(
                $status,
                ['approved', 'rejected'],
                true
            )
        ) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Ungültige Entscheidung'
            ]);
            exit;
        }

        $stmt = $pdo->prepare(
            "UPDATE membership_applications
             SET
                status = ?,
                decided_at = NOW(),
                decided_by = ?
             WHERE id = ?
             AND status = 'submitted'"
        );

        $stmt->execute([
            $status,
            $chairman['username'] ?? '',
            $id
        ]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' =>
                    'Antrag nicht gefunden oder bereits bearbeitet'
            ]);
            exit;
        }

        auditLog(
            $pdo,
            $chairman,
            'membership_applications',
            (string)$id,
            'status_change',
            ['status' => 'submitted'],
            ['status' => $status]
        );

        echo json_encode([
            'success' => true
        ]);

        exit;
    }

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);

} catch (PDOException $e) {

    error_log(
        'Membership applications DB error: ' . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'DB connection error'
    ]);
}
?>
