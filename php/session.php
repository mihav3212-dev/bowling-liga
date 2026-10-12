<?php

const LIGA_COOKIE = 'liga_admin';
const LIGA_DAY_MS = 86400000;

function admin_password()
{
    return $GLOBALS['liga_admin_password'] ?? '';
}

function set_admin_password($value)
{
    if (is_string($value) && $value !== '') {
        $GLOBALS['liga_admin_password'] = $value;
    }
}

function liga_secret()
{
    return admin_password() !== '' ? admin_password() : 'missing-admin-password';
}

function liga_hmac($value)
{
    return hash_hmac('sha256', $value, liga_secret());
}

function b64url_encode($raw)
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function b64url_decode($value)
{
    $pad = strlen($value) % 4;
    if ($pad > 0) {
        $value .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($value, '-_', '+/'));
}

function sign_token(array $payload)
{
    $exp = (string) ((int) round(microtime(true) * 1000) + (30 * LIGA_DAY_MS));
    $body = b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $sig = liga_hmac($exp . '.' . $body);
    return $exp . '.' . $body . '.' . $sig;
}

function read_session($token)
{
    $empty = ['admin' => false, 'teamId' => null];
    if (!$token || admin_password() === '') {
        return $empty;
    }
    $parts = explode('.', $token);
    $now = (int) round(microtime(true) * 1000);
    if (count($parts) === 2) {
        [$exp, $sig] = $parts;
        if (!$exp || !$sig || (int) $exp < $now) {
            return $empty;
        }
        if (!hash_equals(liga_hmac($exp), $sig)) {
            return $empty;
        }
        return ['admin' => true, 'teamId' => null];
    }
    if (count($parts) !== 3) {
        return $empty;
    }
    [$exp, $body, $sig] = $parts;
    if (!$exp || !$body || !$sig || (int) $exp < $now) {
        return $empty;
    }
    if (!hash_equals(liga_hmac($exp . '.' . $body), $sig)) {
        return $empty;
    }
    $data = json_decode(b64url_decode($body), true);
    if (!is_array($data)) {
        return $empty;
    }
    if (!empty($data['a'])) {
        return ['admin' => true, 'teamId' => null];
    }
    if (!empty($data['t']) && is_string($data['t'])) {
        return ['admin' => false, 'teamId' => $data['t']];
    }
    return $empty;
}

function password_ok($password)
{
    $expected = admin_password();
    return is_string($password) && $expected !== '' && hash_equals($expected, $password);
}

function is_secure_request()
{
    $proto = explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0];
    $proto = trim($proto);
    return $proto === 'https' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
}

function set_liga_cookie($token, $secure)
{
    $opts = [
        'expires' => time() + 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ];
    setcookie(LIGA_COOKIE, $token, $opts);
}

function clear_liga_cookie($secure)
{
    $opts = [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ];
    setcookie(LIGA_COOKIE, '', $opts);
}

function read_token()
{
    return (string) ($_COOKIE[LIGA_COOKIE] ?? '');
}

function viewer_of()
{
    return read_session(read_token());
}
