<?php
/**
 * Included by the admin content endpoints. Loads the shared helpers and applies the
 * Origin/Referer check (browser CSRF defence; real access control is requireAuthentication()).
 */

require_once __DIR__ . '/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'OPTIONS') {
    requireAllowedDomain();
}
