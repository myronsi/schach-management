<?php
/**
 * Restricts the e-mail cron scripts to the command line, or to HTTP calls that pass
 * ?key=<cron_key> (cron_key is set in server/.env). Without cron_key only CLI works.
 */

require_once __DIR__ . '/common.php';

if (PHP_SAPI !== 'cli') {
    $expected = (string)(contentEnv()['cron_key'] ?? '');
    $given = (string)($_GET['key'] ?? '');
    if ($expected === '' || !hash_equals($expected, $given)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Forbidden\n";
        exit;
    }
    header('Content-Type: text/plain; charset=utf-8');
}

/** Encodes a header value (subject) as UTF-8 and strips line breaks to prevent header injection. */
function encodeMailHeader(string $value): string {
    $value = trim(preg_replace('/[\r\n]+/', ' ', $value));
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function e(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
