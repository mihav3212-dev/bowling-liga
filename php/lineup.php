<?php

function liga_lineup_locked($rounds)
{
    $games = $rounds[0]['games'] ?? [];
    foreach ($games as $game) {
        if (($game['homePins'] ?? null) !== null || ($game['awayPins'] ?? null) !== null) {
            return true;
        }
    }
    return false;
}

function liga_team_match_side($match, $teamId)
{
    if (!$teamId || !$match) {
        return null;
    }
    if (($match['homeTeamId'] ?? '') === $teamId) {
        return 'home';
    }
    if (($match['awayTeamId'] ?? '') === $teamId) {
        return 'away';
    }
    return null;
}

function liga_sanitize_lineup($starters, $bench, $allowed)
{
    $used = [];
    $cleanStarters = [];
    for ($i = 0; $i < 4; $i++) {
        $id = $starters[$i] ?? '';
        if ($id !== '' && isset($allowed[$id]) && !isset($used[$id])) {
            $used[$id] = true;
            $cleanStarters[] = $id;
        } else {
            $cleanStarters[] = '';
        }
    }
    $cleanBench = [];
    foreach (is_array($bench) ? $bench : [] as $id) {
        if (count($cleanBench) >= 2) {
            break;
        }
        if ($id !== '' && isset($allowed[$id]) && !isset($used[$id])) {
            $used[$id] = true;
            $cleanBench[] = $id;
        }
    }
    return [$cleanStarters, $cleanBench];
}

function liga_pairings()
{
    return [
        [
            ['homeSlot' => 0, 'awaySlot' => 3, 'lane' => 1],
            ['homeSlot' => 1, 'awaySlot' => 2, 'lane' => 2],
            ['homeSlot' => 2, 'awaySlot' => 1, 'lane' => 3],
            ['homeSlot' => 3, 'awaySlot' => 0, 'lane' => 4],
        ],
        [
            ['homeSlot' => 2, 'awaySlot' => 0, 'lane' => 1],
            ['homeSlot' => 3, 'awaySlot' => 1, 'lane' => 2],
            ['homeSlot' => 0, 'awaySlot' => 2, 'lane' => 3],
            ['homeSlot' => 1, 'awaySlot' => 3, 'lane' => 4],
        ],
        [
            ['homeSlot' => 1, 'awaySlot' => 1, 'lane' => 1],
            ['homeSlot' => 0, 'awaySlot' => 0, 'lane' => 2],
            ['homeSlot' => 3, 'awaySlot' => 3, 'lane' => 3],
            ['homeSlot' => 2, 'awaySlot' => 2, 'lane' => 4],
        ],
        [
            ['homeSlot' => 3, 'awaySlot' => 2, 'lane' => 1],
            ['homeSlot' => 2, 'awaySlot' => 3, 'lane' => 2],
            ['homeSlot' => 1, 'awaySlot' => 0, 'lane' => 3],
            ['homeSlot' => 0, 'awaySlot' => 1, 'lane' => 4],
        ],
    ];
}

function liga_apply_lineup($match, $side, $starters, $bench)
{
    $home = $side === 'home' ? $starters : ($match['homeStarters'] ?? []);
    $away = $side === 'away' ? $starters : ($match['awayStarters'] ?? []);
    if ($side === 'home') {
        $match['homeStarters'] = $starters;
        $match['homeBench'] = $bench;
    } else {
        $match['awayStarters'] = $starters;
        $match['awayBench'] = $bench;
    }
    $rounds = [];
    foreach (liga_pairings() as $ri => $games) {
        $row = ['games' => []];
        foreach ($games as $gi => $g) {
            $prev = $match['rounds'][$ri]['games'][$gi] ?? [];
            $row['games'][] = [
                'homePlayerId' => $side === 'home'
                    ? ($home[$g['homeSlot']] ?? '')
                    : (($prev['homePlayerId'] ?? '') !== '' ? $prev['homePlayerId'] : ($home[$g['homeSlot']] ?? '')),
                'awayPlayerId' => $side === 'away'
                    ? ($away[$g['awaySlot']] ?? '')
                    : (($prev['awayPlayerId'] ?? '') !== '' ? $prev['awayPlayerId'] : ($away[$g['awaySlot']] ?? '')),
                'lane' => $g['lane'],
                'homePins' => $prev['homePins'] ?? null,
                'awayPins' => $prev['awayPins'] ?? null,
            ];
        }
        $rounds[] = $row;
    }
    $match['rounds'] = $rounds;
    return $match;
}
