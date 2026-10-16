<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$env = [];
$envFile = __DIR__ . '/.env';

if (file_exists($envFile)) {
    $env = parse_ini_file($envFile);
}

$host = $env['host2'] ?? '';
$user = $env['user2'] ?? '';
$password = $env['password2'] ?? '';
$database = $env['database2'] ?? '';
$port = isset($env['port2']) ? (int)$env['port2'] : 3306;

function validSignature($value): bool
{
    if (!is_string($value)) {
        return false;
    }

    if (
        preg_match(
            '/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/',
            $value
        ) !== 1
    ) {
        return false;
    }

    $comma = strpos($value, ',');

    if ($comma === false) {
        return false;
    }

    $bytes = base64_decode(
        substr($value, $comma + 1),
        true
    );

    return $bytes !== false
        && strlen($bytes) <= 1024 * 1024;
}

try {

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;port=%d;charset=utf8mb4',
        $host,
        $database,
        $port
    );

    $pdo = new PDO(
        $dsn,
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {

        $chairman = requireAuthentication(['chairman']);

        $stmt = $pdo->query(
            'SELECT *
             FROM membership_applications
             ORDER BY submitted_at DESC'
        );

        echo json_encode(
            $stmt->fetchAll(),
            JSON_UNESCAPED_UNICODE
        );

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

        if (
            !filter_var(
                $data['email'],
                FILTER_VALIDATE_EMAIL
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Ungültige E-Mail-Adresse'
            ]);

            exit;
        }

        $nationality = trim(
            (string)$data['nationality']
        );

        if (
            !in_array(
                $nationality,
                [
                    'Deutsch',
                    'EU-Angehöriger'
                ],
                true
            )
            &&
            !str_starts_with(
                $nationality,
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

        if (
            !in_array(
                $data['gender'],
                [
                    'männlich',
                    'weiblich'
                ],
                true
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Ungültiges Geschlecht'
            ]);

            exit;
        }

        if (
            !in_array(
                $data['membership_type'],
                [
                    'Aktivmitglied',
                    'Passivmitglied'
                ],
                true
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Ungültige Mitgliedschaftsart'
            ]);

            exit;
        }

        if (
            !validSignature(
                $data['signature']
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Ungültige digitale Unterschrift'
            ]);

            exit;
        }

        if (
            !empty($data['guardian_signature'])
            &&
            !validSignature(
                $data['guardian_signature']
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Ungültige Unterschrift des gesetzlichen Vertreters'
            ]);

            exit;
        }

        $directDebit = !empty(
            $data['direct_debit']
        );

        if ($directDebit) {

            foreach (
                [
                    'bank_name',
                    'bic',
                    'iban'
                ] as $field
            ) {

                if (
                    !isset($data[$field])
                    ||
                    trim((string)$data[$field]) === ''
                ) {
                    http_response_code(400);

                    echo json_encode([
                        'success' => false,
                        'message' =>
                            'Pflichtfeld fehlt: ' . $field
                    ]);

                    exit;
                }
            }

            if (
                !validSignature(
                    $data['debit_signature'] ?? ''
                )
            ) {
                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'message' =>
                        'Bitte die Einzugsermächtigung unterschreiben'
                ]);

                exit;
            }
        }

        $signedAt = strtotime(
            (string)$data['signed_at']
        );

        if ($signedAt === false) {

            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Ungültiger Signaturzeitpunkt'
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
            trim((string)$data['first_name']),
            trim((string)$data['last_name']),
            trim((string)$data['address']),
            trim((string)$data['postal_city']),
            $data['birth_date'],
            trim(
                (string)($data['birth_place'] ?? '')
            ),
            trim(
                (string)($data['phone'] ?? '')
            ),
            trim((string)$data['email']),
            $nationality,
            trim((string)$data['gender']),
            trim(
                (string)($data['previous_club'] ?? '')
            ),
            trim(
                (string)$data['membership_type']
            ),
            trim(
                (string)$data['application_place']
            ),
            $data['application_date'],
            $directDebit ? 1 : 0,
            trim(
                (string)($data['bank_name'] ?? '')
            ),
            trim(
                (string)($data['bic'] ?? '')
            ),
            trim(
                (string)($data['iban'] ?? '')
            ),
            trim(
                (string)($data['account_holder'] ?? '')
            ),
            $data['signature'],
            trim(
                (string)($data['guardian_signature'] ?? '')
            ),
            trim(
                (string)($data['debit_signature'] ?? '')
            ),
            date(
                'Y-m-d H:i:s',
                $signedAt
            )
        ]);

        echo json_encode([
            'success' => true,
            'id' => (int)$pdo->lastInsertId()
        ]);

        exit;
    }

    if ($method === 'PATCH') {

        $chairman = requireAuthentication(
            ['chairman']
        );

        $id = isset($data['id'])
            ? (int)$data['id']
            : 0;

        $status = $data['status'] ?? '';

        if (
            $id < 1
            ||
            !in_array(
                $status,
                [
                    'approved',
                    'rejected'
                ],
                true
            )
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Ungültige Entscheidung'
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
            [
                'status' => 'submitted'
            ],
            [
                'status' => $status
            ]
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
        'Membership applications DB error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'DB connection error'
    ]);
}
?>
