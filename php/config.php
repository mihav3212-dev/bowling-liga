<?php

function app_root()
{
    return dirname(__DIR__);
}

function config_path()
{
    return app_root() . '/data/config.json';
}

function load_config()
{
    $file = config_path();
    if (!is_file($file)) {
        return null;
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

function mysql_from_env()
{
    $url = getenv('DATABASE_URL') ?: getenv('MYSQL_URL') ?: '';
    if (is_string($url) && (strpos($url, 'mysql://') === 0 || strpos($url, 'mariadb://') === 0)) {
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['host']) || empty($parts['path'])) {
            return null;
        }
        $database = ltrim((string) $parts['path'], '/');
        if ($database === '') {
            return null;
        }
        return [
            'host' => (string) $parts['host'],
            'user' => (string) ($parts['user'] ?? ''),
            'password' => (string) ($parts['pass'] ?? ''),
            'database' => $database,
            'port' => (int) ($parts['port'] ?? 3306),
        ];
    }
    $host = getenv('MYSQL_HOST') ?: '';
    $user = getenv('MYSQL_USER') ?: '';
    $database = getenv('MYSQL_DATABASE') ?: '';
    if ($host === '' || $user === '' || $database === '') {
        return null;
    }
    return [
        'host' => $host,
        'user' => $user,
        'password' => getenv('MYSQL_PASSWORD') ?: '',
        'database' => $database,
        'port' => (int) (getenv('MYSQL_PORT') ?: 3306),
    ];
}

function is_configured()
{
    $mysql = load_config()['mysql'] ?? null;
    if (is_array($mysql)
        && !empty($mysql['host'])
        && !empty($mysql['user'])
        && !empty($mysql['database'])) {
        return true;
    }
    return mysql_from_env() !== null;
}

function save_config(array $config)
{
    $dir = app_root() . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $deny = $dir . '/.htaccess';
    if (!is_file($deny)) {
        file_put_contents($deny, "Require all denied\nDeny from all\n");
    }
    file_put_contents(config_path(), json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}
