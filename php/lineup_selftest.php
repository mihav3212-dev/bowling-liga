<?php
/**
 * CLI self-test: menjava must persist across rounds + admin-style save.
 * Run: php php/lineup_selftest.php
 */
require_once __DIR__ . '/lineup.php';

function fail($msg)
{
    fwrite(STDERR, "FAIL: $msg\n");
    exit(1);
}

function ok($msg)
{
    echo "ok: $msg\n";
}

function empty_rounds($home, $away)
{
    $rounds = [];
    foreach (liga_pairings() as $games) {
        $row = ['games' => []];
        foreach ($games as $g) {
            $row['games'][] = [
                'homePlayerId' => $home[$g['homeSlot']] ?? '',
                'awayPlayerId' => $away[$g['awaySlot']] ?? '',
                'lane' => $g['lane'],
                'homePins' => null,
                'awayPins' => null,
            ];
        }
        $rounds[] = $row;
    }
    return $rounds;
}

$home = ['h1', 'h2', 'h3', 'h4'];
$away = ['a1', 'a2', 'a3', 'a4'];
$match = [
    'homeStarters' => $home,
    'awayStarters' => $away,
    'homeBench' => ['h5'],
    'awayBench' => ['a5'],
    'rounds' => empty_rounds($home, $away),
];
$match['rounds'][0]['games'][0]['homePins'] = 120;
$match['rounds'][0]['games'][0]['awayPins'] = 110;

// Round 1 game 2 is homeSlot 0 (A1 → h1). Sub h5 there.
$subbed = liga_preserve_substitutions(
    liga_apply_player_substitution($match, 1, 2, 'home', 'h5')
);

if (($subbed['rounds'][1]['games'][2]['homePlayerId'] ?? '') !== 'h5') {
    fail('sub cell should be h5');
}
$forward = 0;
foreach ([1, 2, 3] as $ri) {
    foreach ($subbed['rounds'][$ri]['games'] as $g) {
        if (($g['homePlayerId'] ?? '') === 'h5') {
            $forward++;
        }
    }
}
if ($forward < 3) {
    fail("expected h5 in later rounds, got $forward hits");
}
if (($subbed['homeStarters'] ?? []) !== $home) {
    fail('nomination starters must stay unchanged');
}
ok('forward substitution keeps h5 and nomination');

// Single-cell-only (old PHP bug) would leave later rounds as h1.
$broken = $match;
$broken['rounds'][1]['games'][2]['homePlayerId'] = 'h5';
$laterStillH1 = false;
foreach ([2, 3] as $ri) {
    foreach ($broken['rounds'][$ri]['games'] as $gi => $g) {
        $slot = liga_slot_at('home', $ri, $gi);
        if ($slot === 0 && ($g['homePlayerId'] ?? '') === 'h1') {
            $laterStillH1 = true;
        }
    }
}
if (!$laterStillH1) {
    fail('fixture for old bug path invalid');
}
ok('old single-cell bug fixture valid');

// apply_lineup after sub must not wipe rounds.
$saved = liga_apply_lineup($subbed, 'home', $home, ['h5']);
if (($saved['rounds'][1]['games'][2]['homePlayerId'] ?? '') !== 'h5') {
    fail('apply_lineup wiped menjava');
}
if (!liga_has_mid_match_substitutions($saved)) {
    fail('has_mid_match_substitutions false after sub');
}
ok('apply_lineup preserves mid-match sub');

// Admin save overlay + match sheet view.
$incoming = $subbed;
$next = liga_apply_lineup($match, 'home', $home, ['h5']);
$next = liga_apply_lineup($next, 'away', $away, ['a5']);
foreach ($next['rounds'] as $ri => $round) {
    foreach ($round['games'] as $gi => $game) {
        $cell = $incoming['rounds'][$ri]['games'][$gi] ?? null;
        if (!is_array($cell)) {
            continue;
        }
        if (array_key_exists('homePlayerId', $cell)) {
            $next['rounds'][$ri]['games'][$gi]['homePlayerId'] = $cell['homePlayerId'];
        }
        if (array_key_exists('awayPlayerId', $cell)) {
            $next['rounds'][$ri]['games'][$gi]['awayPlayerId'] = $cell['awayPlayerId'];
        }
        if (array_key_exists('homePins', $cell)) {
            $next['rounds'][$ri]['games'][$gi]['homePins'] = $cell['homePins'];
        }
        if (array_key_exists('awayPins', $cell)) {
            $next['rounds'][$ri]['games'][$gi]['awayPins'] = $cell['awayPins'];
        }
    }
}
$next = liga_match_sheet_view($next);
if (($next['rounds'][1]['games'][2]['homePlayerId'] ?? '') !== 'h5') {
    fail('admin overlay + match_sheet_view lost h5');
}
$forward2 = 0;
foreach ([1, 2, 3] as $ri) {
    foreach ($next['rounds'][$ri]['games'] as $g) {
        if (($g['homePlayerId'] ?? '') === 'h5') {
            $forward2++;
        }
    }
}
if ($forward2 < 3) {
    fail("admin save lost forward sub ($forward2)");
}
ok('admin-style save keeps post-sub players');

// Returning out player blocked.
$blocked = liga_apply_player_substitution($subbed, 2, 0, 'home', 'h1');
$out = liga_substituted_out_ids($subbed, 'home');
if (!isset($out['h1'])) {
    fail('h1 should be substituted out');
}
if ($blocked !== $subbed) {
    fail('returning h1 must be a no-op');
}
ok('outgoing player cannot return');

// Mid-game: add A5/A6 after round-1 pins; starters stay frozen.
$lockedMatch = $match;
$lockedMatch['homeBench'] = [];
$lockedMatch['rounds'][0]['games'][0]['homePins'] = 120;
$lockedMatch['rounds'][0]['games'][0]['awayPins'] = 110;
$withBench = liga_apply_lineup($lockedMatch, 'home', ['x1', 'x2', 'x3', 'x4'], ['h5', 'h6']);
if (($withBench['homeStarters'] ?? []) !== $home) {
    fail('locked apply_lineup must freeze A1–A4');
}
if (($withBench['homeBench'] ?? []) !== ['h5', 'h6']) {
    fail('locked apply_lineup must accept A5/A6');
}
$frozen = liga_starters_for_lineup_save($home, ['x1', 'x2', 'x3', 'x4'], $lockedMatch['rounds']);
if ($frozen !== $home) {
    fail('liga_starters_for_lineup_save must freeze when locked');
}
ok('mid-game bench A5/A6 allowed while starters frozen');

echo "ALL PASSED\n";
exit(0);
