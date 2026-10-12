<?php

function hash_password_liga($plain)
{
    $salt = bin2hex(random_bytes(16));
    return $salt . ':' . hash('sha256', $salt . $plain);
}

function verify_password_liga($plain, $stored)
{
    if (!$plain || !$stored || !is_string($stored)) {
        return false;
    }
    $parts = explode(':', $stored, 2);
    if (count($parts) !== 2) {
        return false;
    }
    return hash_equals($parts[1], hash('sha256', $parts[0] . $plain));
}
