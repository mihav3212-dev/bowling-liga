<?php

function liga_default_team_perms($partial = null)
{
    $next = [
        'roster' => false,
        'lineup' => true,
        'results' => false,
        'resultsEdit' => false,
        'season' => false,
    ];
    if (is_array($partial)) {
        foreach (['roster', 'lineup', 'results', 'resultsEdit', 'season'] as $key) {
            if (array_key_exists($key, $partial)) {
                $next[$key] = (bool) $partial[$key];
            }
        }
    }
    if (!empty($next['resultsEdit'])) {
        $next['results'] = true;
    }
    return $next;
}

function liga_team_perms($team)
{
    return liga_default_team_perms(is_array($team) ? ($team['perms'] ?? null) : null);
}

function liga_can_enter_pins($team, $existing)
{
    $perms = liga_team_perms($team);
    if ($existing !== null) {
        return !empty($perms['resultsEdit']);
    }
    return !empty($perms['results']) || !empty($perms['resultsEdit']);
}

function liga_roster_window_open($matches, $now = null)
{
    if ($now === null) {
        $now = (int) (microtime(true) * 1000);
    }
    $later = [];
    foreach (is_array($matches) ? $matches : [] as $match) {
        if ((int) ($match['round'] ?? 0) >= 2) {
            $later[] = $match;
        }
    }
    if (count($later) === 0) {
        return true;
    }
    $earliest = null;
    foreach ($later as $match) {
        $iso = $match['startsAt'] ?? null;
        if (!$iso) {
            continue;
        }
        $start = strtotime((string) $iso);
        if ($start === false) {
            continue;
        }
        $ms = $start * 1000;
        if ($earliest === null || $ms < $earliest) {
            $earliest = $ms;
        }
    }
    if ($earliest !== null) {
        return $now < $earliest;
    }
    foreach ($later as $match) {
        foreach ($match['rounds'] ?? [] as $round) {
            foreach ($round['games'] ?? [] as $game) {
                if (($game['homePins'] ?? null) !== null || ($game['awayPins'] ?? null) !== null) {
                    return false;
                }
            }
        }
    }
    return true;
}
