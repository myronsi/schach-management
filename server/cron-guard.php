<?php

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

function acquireCronLock(string $name): void {
    static $handles = [];
    $file = rtrim(sys_get_temp_dir(), '/\\') . '/schach-cron-' . $name . '.lock';
    $fh = @fopen($file, 'c');
    if (!$fh) return;
    if (!flock($fh, LOCK_EX | LOCK_NB)) {
        echo "Another run of $name is still in progress\n";
        exit;
    }
    $handles[$name] = $fh;
}

function encodeMailHeader(string $value): string {
    $value = trim(preg_replace('/[\r\n]+/', ' ', $value));
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function e(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
