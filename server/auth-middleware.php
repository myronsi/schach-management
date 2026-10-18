<?php

require_once __DIR__ . '/common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'OPTIONS') {
    requireAllowedDomain();
}
