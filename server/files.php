<?php

require_once __DIR__ . '/common.php';

const MAX_SCAN_FILES = 2000;

function listFilesRecursive(string $directory, string $relativePath = '', int $depth = 0): array {
    $files = [];
    if ($depth > 5 || !is_dir($directory)) return $files;

    foreach (scandir($directory) ?: [] as $item) {
        if ($item === '.' || $item === '..' || str_starts_with($item, '.')) continue;
        $fullPath = $directory . '/' . $item;
        if (is_link($fullPath)) continue;
        $relPath = $relativePath !== '' ? $relativePath . '/' . $item : $item;

        if (is_dir($fullPath)) {
            $files = array_merge($files, listFilesRecursive($fullPath, $relPath, $depth + 1));
        } else {
            $files[] = ['path' => $relPath, 'name' => $item, 'size' => (int)filesize($fullPath)];
        }
        if (count($files) >= MAX_SCAN_FILES) break;
    }
    return $files;
}

function resolveUploadDir(string $baseDir, string $relative): string {
    if (!is_dir($baseDir)) {
        mkdir($baseDir, 0755, true);
    }
    $target = safeSubPath($baseDir, $relative);
    if ($target === null) {
        jsonError('Ungültiger Pfad', 400);
    }
    return $target;
}

function storeUploadedFiles(string $targetDir, array $allowedExtensions, callable $nameFor): array {
    if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
        error_log('Could not create upload directory ' . $targetDir);
        jsonError('Upload-Verzeichnis konnte nicht erstellt werden', 500);
    }

    $stored = [];
    $errors = [];
    foreach ($_FILES as $file) {
        if (!is_array($file) || is_array($file['name'] ?? null)) {
            $errors[] = 'Ungültiger Upload';
            continue;
        }
        $originalName = basename((string)$file['name']);
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $reason = match ($file['error']) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File too large',
                UPLOAD_ERR_PARTIAL => 'Partial upload',
                UPLOAD_ERR_NO_FILE => 'No file uploaded',
                default => 'Unknown error',
            };
            $errors[] = "Upload error for file: $originalName ($reason)";
            continue;
        }
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedExtensions, true)) {
            $errors[] = "File type not allowed: $originalName (.$extension)";
            continue;
        }
        $newName = $nameFor(pathinfo($originalName, PATHINFO_FILENAME), $extension);
        $destPath = $targetDir . '/' . $newName;
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            $errors[] = "Failed to move uploaded file: $originalName";
            continue;
        }
        $stored[] = ['name' => $newName, 'original' => $originalName, 'size' => (int)filesize($destPath)];
    }
    return [$stored, $errors];
}

function removeFileBelow(?string $publicPath, string $publicPrefix, string $baseDir, bool $requirePrefix = false): bool {
    if (!$publicPath) return false;
    $path = trim($publicPath);
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $path)) return false;
    $path = ltrim($path, '/');
    $prefix = trim($publicPrefix, '/') . '/';
    if (str_starts_with($path, $prefix)) {
        $path = substr($path, strlen($prefix));
    } elseif ($requirePrefix) {
        return false;
    }
    $full = safeSubPath($baseDir, $path);
    if ($full === null || !is_file($full)) return false;
    return @unlink($full);
}
