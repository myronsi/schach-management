<?php
/**
 * Shared helpers for all API endpoints: config, CORS, JSON responses, DB access,
 * authentication, input validation and small security utilities.
 */

require_once __DIR__ . '/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

const ROLE_RANK = ['blocked' => 0, 'user' => 1, 'admin' => 2, 'chairman' => 3];
const EDITOR_ROLES = ['admin', 'chairman'];

// ---------------------------------------------------------------------------
// Responses / errors
// ---------------------------------------------------------------------------

function jsonResponse(array $data, int $status = 200): void {
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $status = 400, array $extra = []): void {
    jsonResponse(array_merge(['success' => false, 'message' => $message], $extra), $status);
}

// Never leak exception details (DB host, SQL, paths) to clients.
set_exception_handler(function (Throwable $e) {
    error_log(sprintf('[%s] %s: %s in %s:%d', $_SERVER['SCRIPT_NAME'] ?? 'cli', get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()));
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Internal error\n");
        exit(1);
    }
    jsonError('Interner Serverfehler', 500);
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function loadEnvFile(string $name): array {
    static $cache = [];
    if (!array_key_exists($name, $cache)) {
        $file = __DIR__ . '/' . $name;
        $parsed = is_file($file) ? parse_ini_file($file) : false;
        $cache[$name] = is_array($parsed) ? $parsed : [];
    }
    return $cache[$name];
}

function authEnv(): array {
    return loadEnvFile('.env.auth');
}

function contentEnv(): array {
    return loadEnvFile('.env');
}

function jwtSecret(): string {
    $secret = (string)(authEnv()['jwt_secret'] ?? '');
    if ($secret === '') {
        error_log('jwt_secret is not configured in .env.auth');
        jsonError('Server ist nicht korrekt konfiguriert', 500);
    }
    return $secret;
}

function makePdo(string $host, string $database, int $port, string $user, string $password): PDO {
    $dsn = sprintf('mysql:host=%s;dbname=%s;port=%d;charset=utf8mb4', $host, $database, $port);
    return new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

/** Database holding the users table (.env.auth). */
function authDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $env = authEnv();
        $pdo = makePdo($env['host'] ?? '', $env['database'] ?? '', (int)($env['port'] ?? 3306), $env['user'] ?? '', $env['password'] ?? '');
    }
    return $pdo;
}

/** Database holding the site content tables (.env). */
function contentDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $env = contentEnv();
        $pdo = makePdo($env['host2'] ?? '', $env['database2'] ?? '', (int)($env['port2'] ?? 3306), $env['user2'] ?? '', $env['password2'] ?? '');
    }
    return $pdo;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function allowedOriginHosts(): array {
    $raw = (string)(authEnv()['allowed_origins'] ?? '');
    $hosts = [];
    foreach (explode(',', $raw) as $entry) {
        $entry = trim($entry);
        if ($entry === '') continue;
        $hosts[] = strtolower(parse_url($entry, PHP_URL_HOST) ?: $entry);
    }
    return $hosts;
}

function isOriginAllowed(string $origin): bool {
    $allowed = allowedOriginHosts();
    if (!$allowed) return true; // not configured: keep previous behaviour
    $host = strtolower((string)parse_url($origin, PHP_URL_HOST));
    return $host !== '' && in_array($host, $allowed, true);
}

/**
 * Emits CORS headers (only for allowed origins) and answers preflight requests.
 */
function sendCorsHeaders(array $methods): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    header('Vary: Origin');
    if ($origin !== '' && isOriginAllowed($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: ' . implode(', ', array_unique(array_merge($methods, ['OPTIONS']))));
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
        header('Access-Control-Max-Age: 600');
    }
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/**
 * Rejects requests whose Origin/Referer is not in allowed_origins.
 * Defence in depth against browser-based CSRF only - NOT an access control,
 * non-browser clients can send any header.
 */
function requireAllowedDomain(): void {
    if (!allowedOriginHosts()) return;
    $candidate = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($candidate === '' || !isOriginAllowed($candidate)) {
        jsonError('cross site', 403);
    }
}

// ---------------------------------------------------------------------------
// Request input
// ---------------------------------------------------------------------------

/** Decoded JSON body, falling back to form fields. */
function requestBody(): array {
    static $body = null;
    if ($body === null) {
        $decoded = json_decode((string)file_get_contents('php://input'), true);
        $body = is_array($decoded) ? $decoded : $_POST;
    }
    return $body;
}

function clientIp(): string {
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

function getTokenFromAuthHeader(): ?string {
    $authHeader = '';
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $authHeader = (string)$value;
                break;
            }
        }
    }
    if ($authHeader === '') $authHeader = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($authHeader === '') $authHeader = (string)($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+(\S+)$/i', trim($authHeader), $matches)) {
        return $matches[1];
    }
    return null;
}

function getTokenFromCustomHeader(): ?string {
    $token = (string)($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');
    if ($token === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'X-Auth-Token') === 0) {
                $token = (string)$value;
                break;
            }
        }
    }
    $token = trim($token);
    return $token !== '' ? $token : null;
}

/** Token from header, X-Auth-Token or the request body field "token" (used by sendBeacon). */
function getRequestToken(): ?string {
    $token = getTokenFromAuthHeader() ?? getTokenFromCustomHeader();
    if ($token === null) {
        $bodyToken = requestBody()['token'] ?? null;
        if (is_string($bodyToken) && trim($bodyToken) !== '') $token = trim($bodyToken);
    }
    return $token;
}

function generateJWT(string $username, string $status): string {
    $issuedAt = time();
    return JWT::encode([
        'iss' => 'schach-club',
        'aud' => 'schach-club-client',
        'iat' => $issuedAt,
        'exp' => $issuedAt + (8 * 24 * 60 * 60),
        'username' => $username,
        'status' => $status,
    ], jwtSecret(), 'HS256');
}

/** @return array|null decoded claims or null when invalid/expired */
function decodeJWT(string $token): ?array {
    try {
        $claims = (array)JWT::decode($token, new Key(jwtSecret(), 'HS256'));
        return isset($claims['username']) && is_string($claims['username']) ? $claims : null;
    } catch (Throwable $e) {
        return null;
    }
}

function fetchUserRow(string $username): ?array {
    $stmt = authDb()->prepare('SELECT username, status FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/**
 * Validates the bearer token AND re-checks the user's current status in the database,
 * so demoted, blocked or deleted users lose access immediately.
 *
 * @return array token claims with 'status' replaced by the current DB status
 */
function requireAuthentication(array $requiredPermissions = ['admin']): array {
    $token = getRequestToken();
    if ($token === null) {
        jsonError('Access denied', 401);
    }
    $claims = decodeJWT($token);
    if ($claims === null) {
        jsonError('Invalid or expired token', 401);
    }
    $row = fetchUserRow($claims['username']);
    if ($row === null) {
        jsonError('Invalid or expired token', 401);
    }
    if (($claims['status'] ?? null) !== $row['status']) {
        jsonError('Benutzerstatus geändert, bitte erneut anmelden', 401);
    }
    if (!in_array($row['status'], $requiredPermissions, true)) {
        jsonError('Insufficient permissions', 403);
    }
    $claims['status'] = $row['status'];
    return $claims;
}

function requireEditor(): array {
    return requireAuthentication(EDITOR_ROLES);
}

// ---------------------------------------------------------------------------
// Rate limiting (file based, no schema needed)
// ---------------------------------------------------------------------------

function rateLimitDir(): string {
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/schach-api-ratelimit';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

/** Number of hits recorded for $key inside the window. */
function rateLimitCount(string $key, int $windowSeconds): int {
    $file = rateLimitDir() . '/' . hash('sha256', $key);
    if (!is_file($file)) return 0;
    $now = time();
    $hits = array_filter(array_map('intval', explode("\n", (string)@file_get_contents($file))), fn($t) => $t > $now - $windowSeconds);
    return count($hits);
}

function rateLimitHit(string $key, int $windowSeconds): void {
    $file = rateLimitDir() . '/' . hash('sha256', $key);
    $now = time();
    $fh = @fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $hits = array_filter(array_map('intval', explode("\n", stream_get_contents($fh))), fn($t) => $t > $now - $windowSeconds);
    $hits[] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, implode("\n", $hits));
    flock($fh, LOCK_UN);
    fclose($fh);
}

function rateLimitClear(string $key): void {
    @unlink(rateLimitDir() . '/' . hash('sha256', $key));
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

/**
 * Returns the next free id for $table. Must be called inside a transaction;
 * the FOR UPDATE lock serialises concurrent creates on InnoDB.
 */
function nextId(PDO $pdo, string $table): int {
    $stmt = $pdo->query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM `$table` FOR UPDATE");
    return max(1, (int)$stmt->fetchColumn());
}

/**
 * Runs $insert(int $id) with a server-assigned id inside a transaction.
 * @return int the new id
 */
function insertWithNextId(PDO $pdo, string $table, callable $insert): int {
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $pdo->beginTransaction();
        try {
            $id = nextId($pdo, $table);
            $insert($id);
            $pdo->commit();
            return $id;
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($e->getCode() !== '23000' || $attempt === 2) throw $e; // retry only duplicate key
        }
    }
    throw new RuntimeException('unreachable');
}

/**
 * Refuses a write when another user currently holds the edit lock for the entry.
 */
function assertNotLockedByOther(PDO $pdo, string $entity, $entityId, array $user): void {
    try {
        $stmt = $pdo->prepare('SELECT username, expires_at FROM edit_locks WHERE entity = ? AND entity_id = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1');
        $stmt->execute([$entity, (string)$entityId]);
        $lock = $stmt->fetch();
    } catch (PDOException $e) {
        error_log('edit lock check failed: ' . $e->getMessage());
        return; // lock table unavailable: fall back to optimistic conflict check
    }
    if ($lock && $lock['username'] !== ($user['username'] ?? null)) {
        jsonError(
            'Dieser Eintrag wird gerade von ' . ($lock['username'] ?: 'einem anderen Benutzer') . ' bearbeitet.',
            423,
            ['locked' => true, 'locked_by' => $lock['username'], 'expires_at' => $lock['expires_at']]
        );
    }
}

/**
 * Resolves a user-supplied relative directory below $baseDir.
 * Rejects absolute paths, "..", "." and empty segments, backslashes and control characters.
 *
 * @return string|null absolute path (may not exist yet) or null if unsafe
 */
function safeSubPath(string $baseDir, string $relative): ?string {
    $relative = trim($relative);
    if ($relative === '' || preg_match('/[\x00-\x1f\\\\]/', $relative)) return null;
    $relative = trim($relative, '/');
    if ($relative === '') return null;
    foreach (explode('/', $relative) as $segment) {
        if ($segment === '' || $segment === '.' || $segment === '..') return null;
    }
    $base = realpath($baseDir);
    if ($base === false) return null;
    $full = $base . '/' . $relative;

    // Resolve the deepest existing ancestor to defend against symlinks pointing outside.
    $probe = $full;
    while (!file_exists($probe) && $probe !== $base) {
        $probe = dirname($probe);
    }
    $resolved = realpath($probe);
    if ($resolved === false || ($resolved !== $base && !str_starts_with($resolved, $base . DIRECTORY_SEPARATOR) && !str_starts_with($resolved, $base . '/'))) {
        return null;
    }
    return $full;
}

/** Accepts http(s) URLs, root-relative paths and (optionally) mailto/tel. Returns '' for unsafe values. */
function sanitizeUrl(?string $url, bool $allowMailTel = false): string {
    $url = trim((string)$url);
    if ($url === '') return '';
    if (preg_match('/[\x00-\x1f]/', $url)) return '';
    if (str_starts_with($url, '/') && !str_starts_with($url, '//')) return $url;
    if (str_starts_with($url, '#')) return $url;
    $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));
    if (in_array($scheme, ['http', 'https'], true)) return $url;
    if ($allowMailTel && in_array($scheme, ['mailto', 'tel'], true)) return $url;
    if ($scheme === '' && !str_contains($url, ':')) return $url; // plain relative path like "photos/x.jpg"
    return '';
}

/**
 * Allow-list HTML sanitiser for rich text (news content, team description).
 * The public website renders these fields with dangerouslySetInnerHTML.
 */
function sanitizeHtml(?string $html): string {
    $html = (string)$html;
    if (trim($html) === '') return '';

    $allowedTags = [
        'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup',
        'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'pre', 'code',
        'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ];
    $dropWithContent = ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'textarea', 'select', 'button', 'link', 'meta', 'base'];
    $globalAttrs = ['class', 'dir', 'style', 'title', 'align'];
    $tagAttrs = [
        'a' => ['href', 'target', 'rel'],
        'img' => ['src', 'alt', 'width', 'height'],
        'td' => ['colspan', 'rowspan'],
        'th' => ['colspan', 'rowspan'],
        'ol' => ['start'],
    ];

    $doc = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="UTF-8"?><div id="__root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    $root = $doc->getElementById('__root');
    if (!$root) return '';

    $walk = function (DOMNode $node) use (&$walk, $allowedTags, $dropWithContent, $globalAttrs, $tagAttrs) {
        for ($child = $node->firstChild; $child !== null; $child = $next) {
            $next = $child->nextSibling;
            if ($child instanceof DOMComment || $child instanceof DOMProcessingInstruction) {
                $node->removeChild($child);
                continue;
            }
            if (!($child instanceof DOMElement)) continue;

            $tag = strtolower($child->tagName);
            if (in_array($tag, $dropWithContent, true)) {
                $node->removeChild($child);
                continue;
            }
            if (!in_array($tag, $allowedTags, true)) {
                // unwrap: keep the (sanitised) children, drop the element itself
                $walk($child);
                while ($child->firstChild) $node->insertBefore($child->firstChild, $child);
                $node->removeChild($child);
                continue;
            }

            $allowed = array_merge($globalAttrs, $tagAttrs[$tag] ?? []);
            foreach (iterator_to_array($child->attributes) as $attr) {
                $name = strtolower($attr->nodeName);
                $value = $attr->nodeValue;
                if (!in_array($name, $allowed, true)) {
                    $child->removeAttribute($attr->nodeName);
                    continue;
                }
                if ($name === 'href') {
                    $safe = sanitizeUrl($value, true);
                    $safe === '' ? $child->removeAttribute('href') : $child->setAttribute('href', $safe);
                } elseif ($name === 'src') {
                    $safe = sanitizeUrl($value);
                    if ($safe === '') $child->removeAttribute('src');
                } elseif ($name === 'style' && preg_match('/expression|url\s*\(|javascript:|behavior|@import|<|>/i', $value)) {
                    $child->removeAttribute('style');
                } elseif ($name === 'target' && !in_array($value, ['_blank', '_self'], true)) {
                    $child->removeAttribute('target');
                }
            }
            if ($tag === 'a' && $child->getAttribute('target') === '_blank') {
                $child->setAttribute('rel', 'noopener noreferrer');
            }
            $walk($child);
        }
    };
    $walk($root);

    $out = '';
    foreach ($root->childNodes as $child) {
        $out .= $doc->saveHTML($child);
    }
    return $out;
}

function isValidDate(?string $value): bool {
    if (!is_string($value)) return false;
    $d = DateTime::createFromFormat('!Y-m-d', $value);
    return $d !== false && $d->format('Y-m-d') === $value;
}
