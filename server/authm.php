<?php

require_once __DIR__ . '/auth-middleware.php';
require_once __DIR__ . '/audit.php';

sendCorsHeaders(['GET', 'POST', 'DELETE']);

const USER_COLUMNS = 'username, status, password_status, first_name, last_name';
const MIN_PASSWORD_LENGTH = 8;

$method = $_SERVER['REQUEST_METHOD'];
$currentUser = requireEditor();
$pdo = authDb();

function fetchManagedUser(PDO $pdo, string $username): ?array {
    $stmt = $pdo->prepare('SELECT ' . USER_COLUMNS . ', password FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function publicUser(?array $row): ?array {
    if ($row === null) return null;
    unset($row['password']);
    return $row;
}

/**
 * The chairman may manage everyone. Admins may manage accounts ranked below them (and edit their
 * own record), but never another admin's or the chairman's account.
 */
function assertMayManage(array $currentUser, ?array $target): void {
    if (!$target || $currentUser['status'] === 'chairman') return;
    if ($target['username'] === $currentUser['username']) return;
    $targetRank = ROLE_RANK[$target['status']] ?? 0;
    if ($targetRank >= ROLE_RANK[$currentUser['status']]) {
        jsonError($target['status'] === 'chairman'
            ? 'Nur der Vorsitzende kann das Konto des Vorsitzenden ändern'
            : 'Nur der Vorsitzende kann Konten anderer Administratoren ändern', 403);
    }
}

if ($method === 'GET') {
    $username = $_GET['username'] ?? null;
    if (is_string($username) && $username !== '') {
        $stmt = $pdo->prepare('SELECT ' . USER_COLUMNS . ' FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $rows = $pdo->query('SELECT ' . USER_COLUMNS . ' FROM users ORDER BY username ASC')->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $data = requestBody();

    $usernameValue = trim((string)($data['username'] ?? ''));
    $passwordValue = (string)($data['password'] ?? ''); // never trim passwords
    $statusValue = trim((string)($data['status'] ?? 'user'));
    $passwordStatusValue = trim((string)($data['password_status'] ?? 'unchanged'));
    $firstNameValue = isset($data['first_name']) ? trim((string)$data['first_name']) : '';
    $lastNameValue = isset($data['last_name']) ? trim((string)$data['last_name']) : '';
    $isUpdate = ($data['is_update'] ?? false) === true;

    if ($usernameValue === '' || mb_strlen($usernameValue) > 100) {
        jsonError('Missing required field: username', 400);
    }
    if (!array_key_exists($statusValue, ROLE_RANK)) {
        jsonError('Invalid status', 400);
    }
    if (!in_array($passwordStatusValue, ['changed', 'unchanged'], true)) {
        jsonError('Invalid password_status', 400);
    }
    if ($passwordValue !== '' && mb_strlen($passwordValue) < MIN_PASSWORD_LENGTH) {
        jsonError('Das Passwort muss mindestens ' . MIN_PASSWORD_LENGTH . ' Zeichen lang sein', 400);
    }

    $isChairman = $currentUser['status'] === 'chairman';
    if (!$isChairman && ROLE_RANK[$statusValue] > ROLE_RANK[$currentUser['status']]) {
        jsonError('You cannot assign a status higher than your own', 403);
    }

    $existing = fetchManagedUser($pdo, $usernameValue);

    if (!$isUpdate && $existing) {
        // A create must never silently overwrite an existing account.
        jsonError('Username already exists', 409);
    }

    if ($isUpdate) {
        if (!$existing) jsonError('User not found', 404);
        assertMayManage($currentUser, $existing);

        $isSelf = $existing['username'] === $currentUser['username'];
        if ($isSelf && $statusValue !== $existing['status']) {
            jsonError('Den eigenen Status kann man nicht ändern', 403);
        }
        // Omitted name fields keep their current value instead of being blanked.
        if (!array_key_exists('first_name', $data)) $firstNameValue = (string)($existing['first_name'] ?? '');
        if (!array_key_exists('last_name', $data)) $lastNameValue = (string)($existing['last_name'] ?? '');

        $before = publicUser($existing);
        if ($passwordValue !== '') {
            $stmt = $pdo->prepare('UPDATE users SET password = ?, status = ?, password_status = ?, first_name = ?, last_name = ? WHERE username = ?');
            $stmt->execute([password_hash($passwordValue, PASSWORD_DEFAULT), $statusValue, $passwordStatusValue, $firstNameValue, $lastNameValue, $usernameValue]);
        } else {
            $existingPassword = (string)$existing['password'];
            $info = password_get_info($existingPassword);
            if ($existingPassword !== '' && ($info['algo'] === null || $info['algo'] === 0)) {
                // Legacy plaintext password: hash it while we're here.
                $stmt = $pdo->prepare('UPDATE users SET password = ?, status = ?, password_status = ?, first_name = ?, last_name = ? WHERE username = ?');
                $stmt->execute([password_hash($existingPassword, PASSWORD_DEFAULT), $statusValue, $passwordStatusValue, $firstNameValue, $lastNameValue, $usernameValue]);
            } else {
                $stmt = $pdo->prepare('UPDATE users SET status = ?, password_status = ?, first_name = ?, last_name = ? WHERE username = ?');
                $stmt->execute([$statusValue, $passwordStatusValue, $firstNameValue, $lastNameValue, $usernameValue]);
            }
        }

        $after = publicUser(fetchManagedUser($pdo, $usernameValue));
        auditLog($pdo, $currentUser, 'authm', $usernameValue, 'update', $before, $after);
        jsonResponse(['success' => true, 'message' => 'Updated', 'username' => $usernameValue]);
    }

    if ($passwordValue === '') {
        jsonError('Password is required for new user', 400);
    }

    try {
        $stmt = $pdo->prepare('INSERT INTO users (username, password, status, password_status, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$usernameValue, password_hash($passwordValue, PASSWORD_DEFAULT), $statusValue, $passwordStatusValue, $firstNameValue, $lastNameValue]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') jsonError('Username already exists', 409);
        throw $e;
    }
    auditLog($pdo, $currentUser, 'authm', $usernameValue, 'create', null, publicUser(fetchManagedUser($pdo, $usernameValue)));
    jsonResponse(['success' => true, 'message' => 'Created', 'username' => $usernameValue]);
}

if ($method === 'DELETE') {
    $data = requestBody();
    if (!$data) $data = $_GET;
    $usernameValue = isset($data['username']) ? trim((string)$data['username']) : '';
    if ($usernameValue === '') {
        jsonError('Missing username for deletion', 400);
    }
    if ($usernameValue === $currentUser['username']) {
        jsonError('Das eigene Konto kann nicht gelöscht werden', 403);
    }

    $existing = fetchManagedUser($pdo, $usernameValue);
    if (!$existing) jsonError('User not found', 404);
    assertMayManage($currentUser, $existing);

    $stmt = $pdo->prepare('DELETE FROM users WHERE username = ?');
    $stmt->execute([$usernameValue]);
    if ($stmt->rowCount() === 0) jsonError('User not found', 404);

    auditLog($pdo, $currentUser, 'authm', $usernameValue, 'delete', publicUser($existing), null);
    jsonResponse(['success' => true, 'message' => 'Deleted', 'username' => $usernameValue]);
}

jsonError('Method not allowed', 405);
