<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'PATCH', 'DELETE']);

const APPLICATION_RATE_LIMIT = 5;          // submissions per IP ...
const APPLICATION_RATE_WINDOW = 60 * 60;   // ... per hour
const APPLICATION_MAX_FIELD_LENGTH = 255;
const APPLICATION_SIGNATURE_FIELDS = ['signature', 'guardian_signature', 'debit_signature'];
const APPLICATION_REQUIRED_FIELDS = [
    'first_name', 'last_name', 'address', 'postal_city', 'birth_date', 'email', 'nationality',
    'gender', 'membership_type', 'application_place', 'application_date', 'signature',
];
// The list view only gets what it needs; bank details and signatures are loaded per application.
const APPLICATION_LIST_COLUMNS = 'id, status, first_name, last_name, email, membership_type, submitted_at, decided_at, decided_by';
const ADULT_AGE = 18;

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

/** PNG data URL of at most 1 MB. */
function validSignature($value): bool {
    if (!is_string($value) || preg_match('/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/', $value) !== 1) {
        return false;
    }
    $bytes = base64_decode(substr($value, strpos($value, ',') + 1), true);
    return $bytes !== false && strlen($bytes) <= 1024 * 1024;
}

/** True when the applicant is younger than ADULT_AGE on $onDate (both YYYY-MM-DD). */
function isMinor(string $birthDate, string $onDate): bool {
    $adultFrom = (new DateTime($birthDate))->modify('+' . ADULT_AGE . ' years')->format('Y-m-d');
    return $onDate < $adultFrom;
}

function field(array $data, string $name): string {
    return trim((string)($data[$name] ?? ''));
}

$pdo = contentDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireAuthentication(['chairman']);
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM membership_applications WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Antrag nicht gefunden', 404);
        jsonResponse($row);
    }
    $rows = $pdo->query('SELECT ' . APPLICATION_LIST_COLUMNS . ' FROM membership_applications ORDER BY submitted_at DESC LIMIT 500')->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;
}

$data = requestBody();

if ($method === 'POST') {
    foreach (APPLICATION_REQUIRED_FIELDS as $name) {
        if (!isset($data[$name]) || !is_scalar($data[$name]) || trim((string)$data[$name]) === '') {
            jsonError('Pflichtfeld fehlt: ' . $name, 400);
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

    foreach ($data as $name => $value) {
        if (is_array($value) || is_object($value)) {
            jsonError('Ungültige Eingabe: ' . $name, 400);
        }
        if (is_string($value) && !in_array($name, APPLICATION_SIGNATURE_FIELDS, true)
            && mb_strlen($value) > APPLICATION_MAX_FIELD_LENGTH) {
            jsonError('Eingabe zu lang: ' . $name, 400);
        }
    }

    $birthDate = field($data, 'birth_date');
    $applicationDate = field($data, 'application_date');
    $today = date('Y-m-d');
    if (!isValidDate($birthDate) || $birthDate > $today) {
        jsonError('Ungültiges Geburtsdatum', 400);
    }
    if (!isValidDate($applicationDate)) {
        jsonError('Ungültiges Antragsdatum', 400);
    }
    if (!filter_var(field($data, 'email'), FILTER_VALIDATE_EMAIL)) {
        jsonError('Ungültige E-Mail-Adresse', 400);
    }

    $nationality = field($data, 'nationality');
    if (!in_array($nationality, ['Deutsch', 'EU-Angehöriger'], true) && !str_starts_with($nationality, 'Sonstige: ')) {
        jsonError('Ungültige Staatsangehörigkeit', 400);
    }
    if (!in_array(field($data, 'gender'), ['männlich', 'weiblich'], true)) {
        jsonError('Ungültiges Geschlecht', 400);
    }
    if (!in_array(field($data, 'membership_type'), ['Aktivmitglied', 'Passivmitglied'], true)) {
        jsonError('Ungültige Mitgliedschaftsart', 400);
    }

    if (!validSignature($data['signature'])) {
        jsonError('Ungültige digitale Unterschrift', 400);
    }
    $guardianSignature = field($data, 'guardian_signature');
    if ($guardianSignature !== '' && !validSignature($guardianSignature)) {
        jsonError('Ungültige Unterschrift des gesetzlichen Vertreters', 400);
    }
    if ($guardianSignature === '' && isMinor($birthDate, $today)) {
        jsonError('Für Minderjährige ist die Unterschrift des gesetzlichen Vertreters erforderlich', 400);
    }

    $directDebit = !empty($data['direct_debit']);
    $debitSignature = field($data, 'debit_signature');
    if ($directDebit) {
        foreach (['bank_name', 'bic', 'iban'] as $name) {
            if (field($data, $name) === '') jsonError('Pflichtfeld fehlt: ' . $name, 400);
        }
        if (!validIban(field($data, 'iban'))) {
            jsonError('Ungültige IBAN', 400);
        }
        if (!validSignature($debitSignature)) {
            jsonError('Bitte die Einzugsermächtigung unterschreiben', 400);
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO membership_applications (
            first_name, last_name, address, postal_city, birth_date, birth_place, phone, email,
            nationality, gender, previous_club, membership_type, application_place, application_date,
            direct_debit, bank_name, bic, iban, account_holder, signature, guardian_signature,
            debit_signature, signed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        field($data, 'first_name'),
        field($data, 'last_name'),
        field($data, 'address'),
        field($data, 'postal_city'),
        $birthDate,
        field($data, 'birth_place'),
        field($data, 'phone'),
        field($data, 'email'),
        $nationality,
        field($data, 'gender'),
        field($data, 'previous_club'),
        field($data, 'membership_type'),
        field($data, 'application_place'),
        $applicationDate,
        $directDebit ? 1 : 0,
        $directDebit ? field($data, 'bank_name') : '',
        $directDebit ? field($data, 'bic') : '',
        $directDebit ? field($data, 'iban') : '',
        $directDebit ? field($data, 'account_holder') : '',
        $data['signature'],
        $guardianSignature,
        $directDebit ? $debitSignature : '',
        // Recorded by the server: a client-supplied signing time proves nothing.
        date('Y-m-d H:i:s'),
    ]);

    rateLimitHit($rateKey, APPLICATION_RATE_WINDOW);
    jsonResponse(['success' => true, 'id' => (int)$pdo->lastInsertId()]);
}

if ($method === 'PATCH') {
    $chairman = requireAuthentication(['chairman']);
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    $status = $data['status'] ?? '';
    if ($id < 1 || !in_array($status, ['approved', 'rejected'], true)) {
        jsonError('Ungültige Entscheidung', 400);
    }

    $stmt = $pdo->prepare("UPDATE membership_applications SET status = ?, decided_at = NOW(), decided_by = ? WHERE id = ? AND status = 'submitted'");
    $stmt->execute([$status, $chairman['username'], $id]);
    if ($stmt->rowCount() === 0) {
        jsonError('Antrag nicht gefunden oder bereits bearbeitet', 404);
    }

    auditLog($pdo, $chairman, 'membership_applications', (string)$id, 'status_change', ['status' => 'submitted'], ['status' => $status]);
    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    // Applications hold personal and bank data; they must be removable once no longer needed.
    $chairman = requireAuthentication(['chairman']);
    if (!$data) $data = $_GET;
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    if ($id < 1) jsonError('Missing id for deletion', 400);

    $stmt = $pdo->prepare('SELECT status FROM membership_applications WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $status = $stmt->fetchColumn();
    if ($status === false) jsonError('Antrag nicht gefunden', 404);

    $stmt = $pdo->prepare('DELETE FROM membership_applications WHERE id = ?');
    $stmt->execute([$id]);
    // The audit entry deliberately contains no personal data.
    auditLog($pdo, $chairman, 'membership_applications', (string)$id, 'delete', ['status' => $status], null);
    jsonResponse(['success' => true, 'id' => $id]);
}

jsonError('Method not allowed', 405);
