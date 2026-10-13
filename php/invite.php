<?php

const INVITE_DAYS = 14;

function new_invite_token()
{
    return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function hash_invite_token($token)
{
    return hash('sha256', (string) $token);
}

function invite_still_open($team)
{
    if (empty($team['inviteHash'])) {
        return false;
    }
    $exp = strtotime($team['inviteExpires'] ?? '');
    return $exp !== false && $exp > time();
}

function hashes_equal($a, $b)
{
    $left = (string) $a;
    $right = (string) $b;
    if (strlen($left) !== strlen($right)) {
        return false;
    }
    return hash_equals($left, $right);
}

function find_invite_team($teams, $token)
{
    $hash = hash_invite_token($token);
    foreach ($teams ?? [] as $team) {
        if (hashes_equal($team['inviteHash'] ?? '', $hash)) {
            return $team;
        }
    }
    return null;
}

function invite_expiry_iso()
{
    return gmdate('Y-m-d\\TH:i:s.000\\Z', time() + INVITE_DAYS * 86400);
}
