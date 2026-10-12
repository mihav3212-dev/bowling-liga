<?php

function sanitize_state($data, $viewer)
{
    $admin = !empty($viewer['admin']);
    $teamId = $viewer['teamId'] ?? null;
    $teams = [];
    foreach ($data['teams'] ?? [] as $team) {
        $hash = $team['passwordHash'] ?? null;
        unset($team['passwordHash']);
        if ($admin) {
            $team['hasAccess'] = (bool) $hash;
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
    $data['teams'] = $teams;
    $data['teamTrainings'] = $teamTrainings;
    if (!$admin) {
        unset($data['trainingSessions']);
    }
    return $data;
}

function preserve_secrets($payload, $existing)
{
    $prevTeams = $existing['teams'] ?? [];
    $payload['teams'] = array_map(function ($team) use ($prevTeams) {
        $incoming = $team['passwordHash'] ?? null;
        unset($team['passwordHash'], $team['hasAccess']);
        $prev = null;
        foreach ($prevTeams as $item) {
            if (($item['id'] ?? null) === ($team['id'] ?? null)) {
                $prev = $item;
                break;
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
