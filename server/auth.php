<?php

require_once __DIR__ . '/common.php';

sendCorsHeaders(['POST']);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') jsonError('Method not allowed', 405);

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES_PER_ACCOUNT_IP = 8;
const LOGIN_MAX_FAILURES_PER_ACCOUNT = 50;
const LOGIN_MAX_FAILURES_PER_IP = 30;
const MIN_PASSWORD_LENGTH = 8;
const RENEW_THRESHOLD_SECONDS = 24 * 60 * 60;

$input = requestBody();
$action = (string)($input['action'] ?? '');

function requireValidSession(): array {
    $token = getRequestToken();
    if ($token === null) jsonError('Token erforderlich', 200);
    $claims = decodeJWT($token);
    if ($claims === null) jsonError('Ungültiger oder abgelaufener Token', 200);
    $row = fetchUserRow($claims['username']);
    if ($row === null) jsonError('Ungültiger oder abgelaufener Token', 200);
    $reason = tokenRejectionReason($claims, $row);
    if ($reason !== null) jsonError($reason, 200);
    if ($row['status'] === 'blocked') jsonError('Benutzerkonto gesperrt', 200);
    return [$claims, $row, $token];
}

if ($action === 'check' || $action === 'validate') {
    [$claims, $row] = requireValidSession();
    jsonResponse([
        'success' => true,
        'message' => 'Token gültig',
        'status' => $claims['status'],
        'username' => $claims['username'],
        'expires_at' => $claims['exp'],
        'must_change_password' => (($row['password_status'] ?? 'changed') === 'unchanged'),
    ]);
}

if ($action === 'renew') {
    [$claims, $row, $token] = requireValidSession();
    $tokenExp = (int)($claims['exp'] ?? 0);
    if (($tokenExp - time()) > RENEW_THRESHOLD_SECONDS) {
        jsonResponse(['success' => true, 'message' => 'Token still valid, no renewal needed', 'token' => $token, 'expires_at' => $tokenExp]);
    }
    $authTime = (int)($claims['auth_time'] ?? $claims['iat'] ?? 0);
    if ($authTime <= 0 || time() - $authTime > MAX_SESSION_SECONDS) jsonError('Sitzung abgelaufen, bitte erneut anmelden', 200);
    jsonResponse(['success' => true, 'message' => 'Token erfolgreich erneuert', 'token' => generateJWT($row, $authTime), 'username' => $row['username'], 'status' => $row['status']]);
}

if ($action === 'logout') jsonResponse(['success' => true, 'message' => 'Erfolgreich abgemeldet']);

if ($action === 'set_password') {
    [$claims] = requireValidSession();
    $newPassword = $input['new_password'] ?? '';
    $currentPassword = $input['current_password'] ?? '';
    if (!is_string($newPassword) || $newPassword === '') jsonError('Token und new_password erforderlich', 200);
    if (mb_strlen($newPassword) < MIN_PASSWORD_LENGTH) jsonError('Das Passwort muss mindestens ' . MIN_PASSWORD_LENGTH . ' Zeichen lang sein', 200);

    $stmt = authDb()->prepare('SELECT username, password, password_status FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$claims['username']]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Ungültiger oder abgelaufener Token', 200);

    if (($user['password_status'] ?? 'changed') !== 'unchanged') {
        $rateKey = 'setpw:' . $user['username'];
        if (rateLimitCount($rateKey, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_FAILURES_PER_ACCOUNT) jsonError('Zu viele Versuche. Bitte später erneut versuchen.', 429);
        if (!is_string($currentPassword) || $currentPassword === '' || !password_verify($currentPassword, (string)$user['password'])) {
            rateLimitHit($rateKey, LOGIN_WINDOW_SECONDS);
            jsonError('Aktuelles Passwort ist falsch', 200);
        }
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $upd = authDb()->prepare('UPDATE users SET password = ?, password_status = ? WHERE username = ?');
    $upd->execute([$newHash, 'changed', $user['username']]);
    $fresh = fetchUserRow($user['username']);
    jsonResponse(['success' => true, 'message' => 'Passwort gesetzt', 'token' => $fresh ? generateJWT($fresh) : null, 'must_change_password' => false]);
}

if ($action !== '' && $action !== 'login') jsonError('Unbekannte Aktion', 400);

$username = $input['username'] ?? '';
$pass = $input['password'] ?? '';
if (!is_string($username) || !is_string($pass) || trim($username) === '' || $pass === '') jsonError('Bitte Benutzername und Passwort angeben.', 400);
$username = trim($username);

$accountKey = 'login:' . mb_strtolower($username);
$accountIpKey = 'login-acc-ip:' . mb_strtolower($username) . '|' . clientIp();
$ipKey = 'login-ip:' . clientIp();
if (rateLimitCount($accountIpKey, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_FAILURES_PER_ACCOUNT_IP || rateLimitCount($accountKey, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_FAILURES_PER_ACCOUNT || rateLimitCount($ipKey, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_FAILURES_PER_IP) jsonError('Zu viele fehlgeschlagene Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.', 429);

$stmt = authDb()->prepare('SELECT username, password, status, password_status FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$row = $stmt->fetch();
$hash = $row['password'] ?? '$2y$10$.vGA1O9wmRjrwAVXD98HNOgsNpDczlqm3Jq7KnEd1rVAGv3Fykk1a';
$valid = password_verify($pass, (string)$hash) && $row;
if (!$valid) {
    rateLimitHit($accountIpKey, LOGIN_WINDOW_SECONDS);
    rateLimitHit($accountKey, LOGIN_WINDOW_SECONDS);
    rateLimitHit($ipKey, LOGIN_WINDOW_SECONDS);
    jsonError('Benutzername oder Passwort ungültig', 200);
}
if ($row['status'] === 'blocked') jsonError('Benutzerkonto gesperrt', 200);
rateLimitClear($accountIpKey);
if (password_needs_rehash((string)$row['password'], PASSWORD_DEFAULT)) {
    $row['password'] = password_hash($pass, PASSWORD_DEFAULT);
    $upd = authDb()->prepare('UPDATE users SET password = ? WHERE username = ?');
    $upd->execute([$row['password'], $row['username']]);
}
$mustChange = ($row['password_status'] ?? 'changed') === 'unchanged';
jsonResponse(['success' => true, 'message' => $mustChange ? 'Passwort muss geändert werden' : 'Erfolgreich angemeldet', 'status' => $row['status'], 'token' => generateJWT($row), 'must_change_password' => $mustChange]);
