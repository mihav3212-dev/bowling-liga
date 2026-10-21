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

function liga_lineups_revealed($match, $now = null)
{
    if (liga_lineup_locked($match['rounds'] ?? [])) {
        return true;
    }
    $starts = $match['startsAt'] ?? null;
    if (!$starts) {
        return false;
    }
    $start = strtotime($starts);
    if ($start === false) {
        return false;
    }
    $now = $now ?? time();
    return $now >= $start;
}

function liga_blank_match_side($match, $side)
{
    $rounds = [];
    foreach ($match['rounds'] ?? [] as $round) {
        $games = [];
        foreach ($round['games'] ?? [] as $game) {
            if ($side === 'home') {
                $game['homePlayerId'] = '';
            } else {
                $game['awayPlayerId'] = '';
            }
            $games[] = $game;
        }
        $rounds[] = ['games' => $games];
    }
    $match['rounds'] = $rounds;
    if ($side === 'home') {
        $match['homeStarters'] = ['', '', '', ''];
        $match['homeBench'] = [];
    } else {
        $match['awayStarters'] = ['', '', '', ''];
        $match['awayBench'] = [];
    }
    return $match;
}

function liga_mask_match_lineups($match, $viewer, $now = null)
{
    if (!empty($viewer['admin']) || liga_lineups_revealed($match, $now)) {
        return $match;
    }
    $side = liga_team_match_side($match, $viewer['teamId'] ?? null);
    if ($side === 'home') {
        return liga_blank_match_side($match, 'away');
    }
    if ($side === 'away') {
        return liga_blank_match_side($match, 'home');
    }
    return liga_blank_match_side(liga_blank_match_side($match, 'home'), 'away');
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
    return liga_repair_duplicate_lane_players($match);
}

function liga_player_on_other_lane($games, $side, $playerId, $gameIndex)
{
    if ($playerId === '' || $playerId === null) {
        return false;
    }
    $key = $side === 'home' ? 'homePlayerId' : 'awayPlayerId';
    foreach ($games as $index => $game) {
        if ((int) $index === (int) $gameIndex) {
            continue;
        }
        if (($game[$key] ?? '') === $playerId) {
            return true;
        }
    }
    return false;
}

function liga_repair_duplicate_lane_players($match)
{
    $pairings = liga_pairings();
    $changed = false;
    $rounds = [];
    foreach ($match['rounds'] ?? [] as $ri => $round) {
        $games = [];
        foreach ($round['games'] ?? [] as $game) {
            $games[] = $game;
        }
        foreach (['home', 'away'] as $side) {
            $key = $side === 'home' ? 'homePlayerId' : 'awayPlayerId';
            $starters = $side === 'home' ? ($match['homeStarters'] ?? []) : ($match['awayStarters'] ?? []);
            $counts = [];
            foreach ($games as $game) {
                $id = $game[$key] ?? '';
                if ($id !== '') {
                    $counts[$id] = ($counts[$id] ?? 0) + 1;
                }
            }
            foreach ($games as $gi => $game) {
                $slot = $side === 'home'
                    ? ($pairings[$ri][$gi]['homeSlot'] ?? null)
                    : ($pairings[$ri][$gi]['awaySlot'] ?? null);
                $expected = $slot === null ? '' : ($starters[$slot] ?? '');
                $id = $game[$key] ?? '';
                if ($id !== '' && ($counts[$id] ?? 0) > 1 && $id !== $expected) {
                    $games[$gi][$key] = $expected;
                    $changed = true;
                }
            }
        }
        $rounds[] = ['games' => $games];
    }
    if (!$changed) {
        return $match;
    }
    $match['rounds'] = $rounds;
    return $match;
}
