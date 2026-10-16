<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'PATCH']);

const APPLICATION_RATE_LIMIT = 5;          // submissions per IP ...
const APPLICATION_RATE_WINDOW = 60 * 60;   // ... per hour
const APPLICATION_MAX_FIELD_LENGTH = 255;

/** Basic IBAN check (format + ISO 13616 mod-97 checksum). */
function validIban(string $iban): bool {
    $iban = strtoupper(preg_replace('/\s+/', '', $iban));
    if (!preg_match('/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/', $iban)) return false;
    $rearranged = substr($iban, 4) . substr($iban, 0, 4);
    $numeric = '';
    foreach (str_split($rearranged) as $char) {
        $numeric .= ctype_alpha($char) ? (string)(ord($char) - 55) : $char;
    }
    $remainder = 0;
    foreach (str_split($numeric, 7) as $chunk) {
        $remainder = (int)(($remainder . $chunk) % 97);
    }
    return $remainder === 1;
}

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

    $pdo = contentDb();

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

        // Honeypot: real users never fill the hidden "website" field.
        if (!empty($data['website'])) {
            jsonResponse(['success' => true, 'id' => 0]);
        }

        $rateKey = 'membership:' . clientIp();
        if (rateLimitCount($rateKey, APPLICATION_RATE_WINDOW) >= APPLICATION_RATE_LIMIT) {
            jsonError('Zu viele Anträge. Bitte später erneut versuchen.', 429);
        }

        foreach ($data as $field => $value) {
            if (is_string($value) && !in_array($field, ['signature', 'guardian_signature', 'debit_signature'], true)
                && mb_strlen($value) > APPLICATION_MAX_FIELD_LENGTH) {
                jsonError('Eingabe zu lang: ' . $field, 400);
            }
        }

        if (!isValidDate((string)$data['birth_date']) || (string)$data['birth_date'] > date('Y-m-d')) {
            jsonError('Ungültiges Geburtsdatum', 400);
        }

        if (!isValidDate((string)$data['application_date'])) {
            jsonError('Ungültiges Antragsdatum', 400);
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

            if (!validIban((string)$data['iban'])) {
                jsonError('Ungültige IBAN', 400);
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

        rateLimitHit($rateKey, APPLICATION_RATE_WINDOW);

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
