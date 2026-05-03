<?php
/**
 * Router for PHP built-in web server.
 * Sets MW_CONFIG_FILE for all PHP requests, serves static assets directly.
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$filePath = __DIR__ . $path;

// Check data directory for uploaded files (images/, thumb/)
if ($path !== '/' && !is_file($filePath) && getenv('MW_DATA_PATH')) {
    $dataFilePath = getenv('MW_DATA_PATH') . $path;
    if (is_file($dataFilePath)) {
        $filePath = $dataFilePath;
    }
}

// Serve static (non-PHP) files directly
if ($path !== '/' && is_file($filePath)) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if ($ext !== 'php') {
        $types = [
            'css' => 'text/css',
            'js' => 'application/javascript',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'mp3' => 'audio/mpeg',
            'mp4' => 'video/mp4',
            'ogg' => 'audio/ogg',
            'ogv' => 'video/ogg',
            'opus' => 'audio/opus',
            'wav' => 'audio/wav',
            'webm' => 'video/webm',
            'flac' => 'audio/flac',
        ];
        if (isset($types[$ext])) {
            header('Content-Type: ' . $types[$ext]);
        }
        // Files under the document root can be served natively
        if (strpos($filePath, __DIR__) === 0) {
            return false;
        }
        readfile($filePath);
        return true;
    }
}

// Set LocalSettings path from user data directory for ALL PHP requests
if (getenv('MW_DATA_PATH')) {
    $localSettings = getenv('MW_DATA_PATH') . '/LocalSettings.php';
    if (file_exists($localSettings)) {
        define('MW_CONFIG_FILE', $localSettings);
    }
}

// Determine which PHP entry point to use
if ($path !== '/' && is_file($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) === 'php') {
    $_SERVER['SCRIPT_NAME'] = $path;
    $_SERVER['SCRIPT_FILENAME'] = $filePath;
    require $filePath;
} else {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/index.php';
    require __DIR__ . '/index.php';
}
