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

function liga_side_player_key($side)
{
    return $side === 'home' ? 'homePlayerId' : 'awayPlayerId';
}

function liga_slot_at($side, $roundIndex, $gameIndex)
{
    $pair = liga_pairings()[$roundIndex][$gameIndex] ?? null;
    if (!$pair) {
        return null;
    }
    return $side === 'home' ? ($pair['homeSlot'] ?? null) : ($pair['awaySlot'] ?? null);
}

/** Odhajajoči se ne sme vrniti. Menjava (A5/A6) ostane na voljo. */
function liga_substituted_out_ids($match, $side)
{
    $key = liga_side_player_key($side);
    $out = [];
    $active = [];
    foreach ($match['rounds'] ?? [] as $ri => $round) {
        foreach ($round['games'] ?? [] as $gi => $game) {
            $slot = liga_slot_at($side, $ri, $gi);
            $id = $game[$key] ?? '';
            if ($slot === null || $id === '') {
                continue;
            }
            $prev = $active[$slot] ?? null;
            if ($prev === null) {
                $active[$slot] = $id;
                continue;
            }
            if ($prev === $id || isset($out[$id])) {
                continue;
            }
            $out[$prev] = true;
            $active[$slot] = $id;
        }
    }
    return $out;
}

function liga_has_mid_match_substitutions($match)
{
    return count(liga_substituted_out_ids($match, 'home')) > 0
        || count(liga_substituted_out_ids($match, 'away')) > 0;
}

/** Če je odhajajoči spet vpisan, ga zamenja igralec, ki je ostal v igri. */
function liga_preserve_substitutions($match)
{
    $rounds = [];
    foreach ($match['rounds'] ?? [] as $round) {
        $games = [];
        foreach ($round['games'] ?? [] as $game) {
            $games[] = $game;
        }
        $rounds[] = ['games' => $games];
    }
    $changed = false;
    foreach (['home', 'away'] as $side) {
        $key = liga_side_player_key($side);
        $out = [];
        $active = [];
        foreach ($rounds as $ri => $round) {
            foreach ($round['games'] as $gi => $game) {
                $slot = liga_slot_at($side, $ri, $gi);
                $id = $game[$key] ?? '';
                if ($slot === null || $id === '') {
                    continue;
                }
                $prev = $active[$slot] ?? null;
                if ($prev === null) {
                    $active[$slot] = $id;
                    continue;
                }
                if ($prev === $id) {
                    continue;
                }
                if (isset($out[$id])) {
                    $rounds[$ri]['games'][$gi][$key] = $prev;
                    $changed = true;
                    continue;
                }
                $out[$prev] = true;
                $active[$slot] = $id;
            }
        }
    }
    if (!$changed) {
        return $match;
    }
    $match['rounds'] = $rounds;
    return $match;
}

/**
 * Menjava: novi igralec na tej stezi + v vseh naslednjih krogih namesto odhajajočega.
 * Odhajajoči ne more več vstopiti. Nominacija A1–A6 ostane.
 */
function liga_apply_player_substitution($match, $roundIndex, $gameIndex, $side, $playerId)
{
    $key = liga_side_player_key($side);
    $round = $match['rounds'][$roundIndex] ?? null;
    $game = $round['games'][$gameIndex] ?? null;
    if (!$game) {
        return $match;
    }

    $starters = $side === 'home' ? ($match['homeStarters'] ?? []) : ($match['awayStarters'] ?? []);
    $bench = $side === 'home' ? ($match['homeBench'] ?? []) : ($match['awayBench'] ?? []);
    $allowed = array_flip(array_filter(array_merge($starters, $bench)));
    $pid = (string) ($playerId ?? '');
    if ($pid !== '' && !isset($allowed[$pid])) {
        return $match;
    }
    if ($pid !== '' && liga_player_on_other_lane($round['games'] ?? [], $side, $pid, $gameIndex)) {
        return $match;
    }
    if ($pid !== '' && isset(liga_substituted_out_ids($match, $side)[$pid])) {
        return $match;
    }

    $oldId = (string) ($game[$key] ?? '');

    if ($pid === '' || $oldId === $pid) {
        $rounds = $match['rounds'];
        $rounds[$roundIndex]['games'][$gameIndex][$key] = $pid;
        $match['rounds'] = $rounds;
        return $match;
    }

    $fromSlot = liga_slot_at($side, $roundIndex, $gameIndex);
    $rounds = [];
    foreach ($match['rounds'] as $ri => $r) {
        if ($ri < $roundIndex) {
            $rounds[] = $r;
            continue;
        }
        $games = [];
        foreach ($r['games'] ?? [] as $g) {
            $games[] = $g;
        }
        if ($ri === $roundIndex) {
            $games[$gameIndex][$key] = $pid;
            $rounds[] = ['games' => $games];
            continue;
        }
        $hits = [];
        foreach ($games as $gi => $g) {
            $sameSlot = $fromSlot !== null && liga_slot_at($side, $ri, $gi) === $fromSlot;
            $samePerson = $oldId !== '' && (($g[$key] ?? '') === $oldId);
            if ($sameSlot || $samePerson) {
                $hits[] = $gi;
            }
        }
        $chosen = null;
        foreach ($hits as $gi) {
            if (liga_slot_at($side, $ri, $gi) === $fromSlot) {
                $chosen = $gi;
                break;
            }
        }
        if ($chosen === null && count($hits) > 0) {
            $chosen = $hits[0];
        }
        if ($chosen !== null) {
            $games[$chosen][$key] = $pid;
        }
        $rounds[] = ['games' => $games];
    }
    $match['rounds'] = $rounds;
    return $match;
}

/** Ohrani menjave v rundah; nominacije A1–A6 pusti pri miru. */
function liga_match_sheet_view($match)
{
    return liga_repair_duplicate_lane_players(liga_preserve_substitutions($match));
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
    // Po prvem keglju / menjavah ne povoziti parov z začetno sestavo.
    // Same heal order as liga_match_sheet_view: preserve menjava, then repair starter dupes.
    if (liga_lineup_locked($match['rounds'] ?? []) || liga_has_mid_match_substitutions($match)) {
        return liga_repair_duplicate_lane_players(liga_preserve_substitutions($match));
    }
    $nominated = array_flip(array_filter(array_merge($starters, $bench)));
    $rounds = [];
    foreach (liga_pairings() as $ri => $games) {
        $row = ['games' => []];
        foreach ($games as $gi => $g) {
            $prev = $match['rounds'][$ri]['games'][$gi] ?? [];
            $prevHome = $prev['homePlayerId'] ?? '';
            $prevAway = $prev['awayPlayerId'] ?? '';
            $templateHome = $home[$g['homeSlot']] ?? '';
            $templateAway = $away[$g['awaySlot']] ?? '';
            $row['games'][] = [
                'homePlayerId' => $side === 'home'
                    ? ($prevHome !== '' && isset($nominated[$prevHome]) ? $prevHome : $templateHome)
                    : ($prevHome !== '' ? $prevHome : $templateHome),
                'awayPlayerId' => $side === 'away'
                    ? ($prevAway !== '' && isset($nominated[$prevAway]) ? $prevAway : $templateAway)
                    : ($prevAway !== '' ? $prevAway : $templateAway),
                'lane' => $g['lane'],
                'homePins' => $prev['homePins'] ?? null,
                'awayPins' => $prev['awayPins'] ?? null,
            ];
        }
        $rounds[] = $row;
    }
    $match['rounds'] = $rounds;
    return liga_repair_duplicate_lane_players(liga_preserve_substitutions($match));
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
            $starterIds = array_flip(array_filter($starters));
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
                // Menjava (A5/A6) ni starter — ne vračaj je nazaj na A1–A4.
                if ($id !== '' && isset($starterIds[$id]) && ($counts[$id] ?? 0) > 1 && $id !== $expected) {
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
