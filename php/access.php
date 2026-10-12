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
