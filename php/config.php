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

function is_configured()
{
    $mysql = load_config()['mysql'] ?? null;
    return is_array($mysql)
        && !empty($mysql['host'])
        && !empty($mysql['user'])
        && !empty($mysql['database']);
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
