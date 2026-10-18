<?php
/**
 * Restricts the e-mail cron scripts to the command line, or to HTTP calls that pass the cron_key
 * (set in server/.env) as "X-Cron-Key" header - preferred, it does not end up in access logs -
 * or as ?key=<cron_key>. Without cron_key only CLI works.
 */

require_once __DIR__ . '/common.php';

if (PHP_SAPI !== 'cli') {
    $expected = (string)(contentEnv()['cron_key'] ?? '');
    $given = (string)($_SERVER['HTTP_X_CRON_KEY'] ?? $_GET['key'] ?? '');
    if ($expected === '' || !hash_equals($expected, $given)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Forbidden\n";
        exit;
    }
    header('Content-Type: text/plain; charset=utf-8');
}

/**
 * Ensures only one run of the calling cron script at a time; a second, overlapping run exits.
 * The lock is released automatically when the process ends.
 */
function acquireCronLock(string $name): void {
    static $handles = [];
    $file = rtrim(sys_get_temp_dir(), '/\\') . '/schach-cron-' . $name . '.lock';
    $fh = @fopen($file, 'c');
    if (!$fh) return; // cannot lock (e.g. read-only temp dir): run unguarded as before
    if (!flock($fh, LOCK_EX | LOCK_NB)) {
        echo "Another run of $name is still in progress\n";
        exit;
    }
    $handles[$name] = $fh;
}

/** Encodes a header value (subject) as UTF-8 and strips line breaks to prevent header injection. */
function encodeMailHeader(string $value): string {
    $value = trim(preg_replace('/[\r\n]+/', ' ', $value));
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function e(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
