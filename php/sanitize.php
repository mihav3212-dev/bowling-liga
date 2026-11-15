<?php

require_once __DIR__ . '/invite.php';
require_once __DIR__ . '/lineup.php';

function sanitize_state($data, $viewer)
{
    $admin = !empty($viewer['admin']);
    $teamId = $viewer['teamId'] ?? null;
    $teams = [];
    foreach ($data['teams'] ?? [] as $team) {
        $hash = $team['passwordHash'] ?? null;
        $inviteHash = $team['inviteHash'] ?? null;
        unset($team['passwordHash'], $team['inviteHash']);
        if ($admin) {
            $team['hasAccess'] = (bool) $hash;
            $team['hasInvite'] = invite_still_open(['inviteHash' => $inviteHash, 'inviteExpires' => $team['inviteExpires'] ?? null]);
        } else {
            unset($team['inviteExpires'], $team['hasInvite'], $team['hasAccess']);
        }
        $teams[] = $team;
    }
    $teamTrainings = null;
    if ($admin) {
        $teamTrainings = $data['teamTrainings'] ?? null;
    } elseif ($teamId) {
        $all = $data['teamTrainings'] ?? [];
        $teamTrainings = [$teamId => $all[$teamId] ?? []];
    }
    $matches = [];
    foreach ($data['matches'] ?? [] as $match) {
        $matches[] = liga_mask_match_lineups($match, $viewer);
    }
    $data['teams'] = $teams;
    $data['matches'] = $matches;
    $data['teamTrainings'] = $teamTrainings;
    if (!$admin) {
        unset($data['trainingSessions']);
    }
    return $data;
}

function preserve_secrets($payload, $existing, $opts = [])
{
    $prevTeams = $existing['teams'] ?? [];
    $lockPerms = !empty($opts['lockPerms']);
    $trustInvite = !empty($opts['trustInviteFields']);
    $payload['teams'] = array_map(function ($team) use ($prevTeams, $lockPerms, $trustInvite) {
        $incoming = $team['passwordHash'] ?? null;
        $incomingInvite = $team['inviteHash'] ?? null;
        $incomingExpires = $team['inviteExpires'] ?? null;
        unset($team['passwordHash'], $team['hasAccess'], $team['hasInvite'], $team['inviteHash'], $team['inviteExpires']);
        $prev = null;
        foreach ($prevTeams as $item) {
            if (($item['id'] ?? null) === ($team['id'] ?? null)) {
                $prev = $item;
                break;
            }
        }
        if ($lockPerms) {
            $team['perms'] = $prev['perms'] ?? ($team['perms'] ?? null);
        }
        // Client saves omit invite fields. Server create/claim/clear must pass
        // trustInviteFields or new inviteHash is dropped and claim fails.
        if ($trustInvite) {
            if (!empty($incomingInvite)) {
                $team['inviteHash'] = $incomingInvite;
            }
            if (!empty($incomingExpires)) {
                $team['inviteExpires'] = $incomingExpires;
            }
        } else {
            if (!empty($prev['inviteHash'])) {
                $team['inviteHash'] = $prev['inviteHash'];
            }
            if (!empty($prev['inviteExpires'])) {
                $team['inviteExpires'] = $prev['inviteExpires'];
            }
        }
        if ($incoming === '') {
            return $team;
        }
        $passwordHash = $incoming ?: ($prev['passwordHash'] ?? null);
        if ($passwordHash) {
            $team['passwordHash'] = $passwordHash;
        }
        return $team;
    }, $payload['teams'] ?? []);
    if (!isset($payload['teamTrainings']) && isset($existing['teamTrainings'])) {
        $payload['teamTrainings'] = $existing['teamTrainings'];
    }
    return $payload;
}
