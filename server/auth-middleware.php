<?php

require_once __DIR__ . '/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function checkDomainAllowed(): bool {
    $envFile = __DIR__ . '/.env.auth';
    if (!file_exists($envFile)) return true;
    $env = parse_ini_file($envFile);
    $allowedRaw = $env['allowed_origins'] ?? '';
    if (trim($allowedRaw) === '') return true;
    $allowed = array_map('trim', explode(',', $allowedRaw));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    if (empty($origin) && empty($referer)) return false;
    $candidate = $origin ?: $referer;
    $candidateHost = parse_url($candidate, PHP_URL_HOST) ?: $candidate;
    foreach ($allowed as $a) {
        $a = trim($a);
        if ($a === '') continue;
        $allowedHost = parse_url($a, PHP_URL_HOST) ?: $a;
        if (strcasecmp($allowedHost, $candidateHost) === 0) return true;
    }
    return false;
}

function requireAllowedDomain() {
    if (!checkDomainAllowed()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'cross site']);
        exit;
    }
}

requireAllowedDomain();

function requireAuthentication($requiredPermissions = ['admin']) {
    $envFile = __DIR__ . '/.env.auth';
    if (!file_exists($envFile)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '.env file not found']);
        exit;
    }
    
    $env = parse_ini_file($envFile);
    $jwt_secret = $env['jwt_secret'] ?? 'default_secret_change_this';
    
    $token = null;
    
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $token = $input['token'] ?? $_POST['token'] ?? null;
    
    if (!$token) {
        $token = getTokenFromAuthHeader();
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        exit;
    }
    
    try {
        $decoded = JWT::decode($token, new Key($jwt_secret, 'HS256'));
        $userData = (array) $decoded;
        
        $userStatus = $userData['status'] ?? '';
        if (!in_array($userStatus, $requiredPermissions)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
            exit;
        }
        
        return $userData;
        
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }
}

function getTokenFromAuthHeader() {
    $authHeader = '';
    
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    
    if (empty($authHeader)) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    }
    
    if (empty($authHeader)) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    }
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }
    
    return null;
}

function checkReadOnlyAccess() {
    return true;
}

function requirePermissions($permissions) {
    return requireAuthentication($permissions);
}

function isWriteOperation($action) {
    $writeOperations = ['create', 'add', 'edit', 'update', 'delete', 'remove', 'upload'];
    return in_array(strtolower($action), $writeOperations);
}

function getAuthenticatedUser() {
    try {
        return requireAuthentication(['admin']);
    } catch (Exception $e) {
        return null;
    }
}
?>