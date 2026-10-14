<?php

const INVITE_DAYS = 14;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalize_invite_token($token)
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim((string) $token)) ?? '');
}

function new_invite_token()
{
    $out = '';
    $max = strlen(INVITE_ALPHABET) - 1;
    for ($i = 0; $i < 8; $i++) {
        $out .= INVITE_ALPHABET[random_int(0, $max)];
    }
    return $out;
}

function hash_invite_token($token)
{
    return hash('sha256', normalize_invite_token($token));
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
    $normalized = normalize_invite_token($token);
    if ($normalized === '') {
        return null;
    }
    $hash = hash_invite_token($normalized);
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
