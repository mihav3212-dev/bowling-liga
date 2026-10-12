<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/passwords.php';
require_once __DIR__ . '/sanitize.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/lineup.php';
require_once __DIR__ . '/access.php';

function get_pdo()
{
    static $pdo = false;
    if ($pdo !== false) {
        return $pdo;
    }
    $mysql = load_config()['mysql'] ?? null;
    if (!is_array($mysql) || empty($mysql['host']) || empty($mysql['user']) || empty($mysql['database'])) {
        $pdo = null;
        return null;
    }
    $host = $mysql['host'];
    $port = (int) ($mysql['port'] ?? 3306);
    $db = $mysql['database'];
    $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, $mysql['user'], (string) ($mysql['password'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        $pdo = null;
    }
    return $pdo;
}

function as_state($data)
{
    if (is_string($data)) {
        $data = $data === '' ? [] : json_decode($data, true);
    }
    if (!is_array($data)) {
        $data = [];
    }
    return [
        'seasonKey' => $data['seasonKey'] ?? null,
        'seasonTitle' => $data['seasonTitle'] ?? null,
        'training' => !empty($data['training']),
        'teams' => isset($data['teams']) && is_array($data['teams']) ? $data['teams'] : [],
        'players' => isset($data['players']) && is_array($data['players']) ? $data['players'] : [],
        'matches' => isset($data['matches']) && is_array($data['matches']) ? $data['matches'] : [],
        'roundNotes' => isset($data['roundNotes']) && is_array($data['roundNotes']) ? $data['roundNotes'] : null,
        'roundLabels' => isset($data['roundLabels']) && is_array($data['roundLabels']) ? $data['roundLabels'] : null,
        'trainingSessions' => isset($data['trainingSessions']) && is_array($data['trainingSessions']) ? $data['trainingSessions'] : null,
        'teamTrainings' => isset($data['teamTrainings']) && is_array($data['teamTrainings']) ? $data['teamTrainings'] : null,
    ];
}

function as_iso($value)
{
    if (!$value) {
        return null;
    }
    $ts = strtotime((string) $value);
    return $ts ? gmdate('Y-m-d\TH:i:s.000\Z', $ts) : (string) $value;
}

function as_season($row)
{
    $data = as_state($row['data'] ?? '{}');
    return [
        'id' => $row['id'],
        'label' => $row['label'],
        'archived' => !empty($row['archived_at']),
        'training' => !empty($data['training']),
        'updatedAt' => as_iso($row['updated_at'] ?? null),
        'data' => $data,
    ];
}

function dump_state($data)
{
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function q_all(PDO $pdo, $sql, $params = [])
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function q_run(PDO $pdo, $sql, $params = [])
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function ensure_schema(PDO $pdo, $seed = '')
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS seasons (
          id VARCHAR(64) NOT NULL,
          label VARCHAR(255) NOT NULL,
          archived_at DATETIME NULL DEFAULT NULL,
          data MEDIUMTEXT NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_seasons_archived_updated (archived_at, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS settings (
          name VARCHAR(64) NOT NULL,
          value TEXT NOT NULL,
          PRIMARY KEY (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    sync_admin_password($pdo, $seed);
}

function sync_admin_password(PDO $pdo, $seed = '')
{
    $rows = q_all($pdo, 'SELECT value FROM settings WHERE name = ? LIMIT 1', ['admin_password']);
    $fromDb = $rows[0]['value'] ?? '';
    if (is_string($fromDb) && trim($fromDb) !== '') {
        set_admin_password(trim($fromDb));
        return trim($fromDb);
    }
    $fromSeed = trim((string) $seed);
    if ($fromSeed !== '') {
        q_run($pdo, 'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = name', [
            'admin_password',
            $fromSeed,
        ]);
        set_admin_password($fromSeed);
    }
    return $fromSeed;
}

function list_seasons(PDO $pdo, $includeTraining = false)
{
    $rows = q_all(
        $pdo,
        'SELECT id, label, archived_at, updated_at, data FROM seasons ORDER BY (archived_at IS NULL) DESC, updated_at DESC'
    );
    $out = [];
    foreach ($rows as $row) {
        $training = !empty(as_state($row['data'])['training']);
        if (!$includeTraining && $training) {
            continue;
        }
        $out[] = [
            'id' => $row['id'],
            'label' => $row['label'],
            'archived' => !empty($row['archived_at']),
            'training' => $training,
            'updatedAt' => as_iso($row['updated_at'] ?? null),
        ];
    }
    return $out;
}

function get_season(PDO $pdo, $id)
{
    $rows = q_all($pdo, 'SELECT * FROM seasons WHERE id = ? LIMIT 1', [$id]);
    return $rows ? as_season($rows[0]) : null;
}

function get_current_season(PDO $pdo)
{
    $rows = q_all($pdo, 'SELECT * FROM seasons WHERE archived_at IS NULL ORDER BY updated_at DESC');
    foreach ($rows as $row) {
        $season = as_season($row);
        if (empty($season['training'])) {
            return $season;
        }
    }
    $id = 's_' . base_convert((string) (int) round(microtime(true) * 1000), 10, 36);
    $label = '2026/27';
    $empty = ['seasonTitle' => $label, 'teams' => [], 'players' => [], 'matches' => []];
    q_run($pdo, 'INSERT INTO seasons (id, label, data) VALUES (?, ?, ?)', [$id, $label, dump_state($empty)]);
    return ['id' => $id, 'label' => $label, 'archived' => false, 'updatedAt' => gmdate('Y-m-d\TH:i:s.000\Z'), 'data' => $empty];
}

function save_season(PDO $pdo, $id, $data, $opts = [])
{
    $existing = get_season($pdo, $id);
    $payload = preserve_secrets(as_state($data), $existing['data'] ?? null, $opts);
    $stmt = q_run(
        $pdo,
        'UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL',
        [dump_state($payload), $id]
    );
    return $stmt->rowCount() > 0;
}

function archive_current(PDO $pdo, $id)
{
    $targetId = $id;
    if (!$targetId) {
        $targetId = get_current_season($pdo)['id'];
    }
    q_run($pdo, 'UPDATE seasons SET archived_at = NOW(), updated_at = NOW() WHERE id = ?', [$targetId]);
    return get_season($pdo, $targetId);
}

function reopen_season(PDO $pdo, $id)
{
    $targetId = $id;
    if (!$targetId) {
        $rows = q_all($pdo, 'SELECT id, label, data FROM seasons WHERE archived_at IS NOT NULL ORDER BY updated_at DESC');
        foreach ($rows as $row) {
            $label = strtolower((string) $row['label']);
            $key = as_state($row['data'])['seasonKey'] ?? '';
            if (strpos($label, '2026/2027') !== false || strpos($label, '2026/27') !== false || $key === '2026-27') {
                $targetId = $row['id'];
                break;
            }
        }
    }
    if (!$targetId) {
        return get_current_season($pdo);
    }
    q_run($pdo, 'UPDATE seasons SET archived_at = NULL, updated_at = NOW() WHERE id = ?', [$targetId]);
    return get_season($pdo, $targetId);
}

function replace_season(PDO $pdo, $id, $data, $label)
{
    $current = get_season($pdo, $id);
    if (!$current) {
        return null;
    }
    $payload = preserve_secrets(as_state($data), $current['data']);
    $name = trim((string) ($label ?: ($payload['seasonTitle'] ?? $current['label'])));
    $payload['seasonTitle'] = $name;
    $payload['training'] = !empty($current['training']);
    q_run(
        $pdo,
        'UPDATE seasons SET label = ?, data = ?, archived_at = NULL, updated_at = NOW() WHERE id = ?',
        [$name, dump_state($payload), $id]
    );
    return get_season($pdo, $id);
}

function rename_season(PDO $pdo, $id, $label)
{
    $current = get_season($pdo, $id);
    if (!$current) {
        return null;
    }
    $name = trim((string) $label);
    if ($name === '') {
        return $current;
    }
    $payload = as_state(array_merge($current['data'], ['seasonTitle' => $name]));
    q_run($pdo, 'UPDATE seasons SET label = ?, data = ?, updated_at = NOW() WHERE id = ?', [
        $name,
        dump_state($payload),
        $id,
    ]);
    return get_season($pdo, $id);
}

function delete_season(PDO $pdo, $id)
{
    $listed = q_all($pdo, 'SELECT id FROM seasons ORDER BY (archived_at IS NULL) DESC, updated_at DESC');
    if (count($listed) <= 1) {
        throw new Exception('Zadnje sezone ni mogoče izbrisati.');
    }
    q_run($pdo, 'DELETE FROM seasons WHERE id = ?', [$id]);
    $nextId = null;
    foreach ($listed as $row) {
        if ($row['id'] !== $id) {
            $nextId = $row['id'];
            break;
        }
    }
    return $nextId ? get_season($pdo, $nextId) : null;
}

function save_match_lineup(PDO $pdo, $teamId, $matchId, $side, $starters, $bench, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $matches = $current['data']['matches'] ?? [];
    $players = $current['data']['players'] ?? [];
    $teamRow = null;
    foreach ($current['data']['teams'] ?? [] as $item) {
        if (($item['id'] ?? '') === $teamId) {
            $teamRow = $item;
            break;
        }
    }
    if (empty(liga_team_perms($teamRow)['lineup'])) {
        return null;
    }
    $found = false;
    foreach ($matches as $i => $match) {
        if (($match['id'] ?? '') !== $matchId) {
            continue;
        }
        $own = liga_team_match_side($match, $teamId);
        if ($own === null || $own !== $side) {
            return null;
        }
        if (liga_lineup_locked($match['rounds'] ?? [])) {
            return null;
        }
        $allowed = [];
        foreach ($players as $player) {
            if (($player['teamId'] ?? '') === $teamId) {
                $allowed[$player['id']] = true;
            }
        }
        [$cleanStarters, $cleanBench] = liga_sanitize_lineup($starters, $bench, $allowed);
        $matches[$i] = liga_apply_lineup($match, $side, $cleanStarters, $cleanBench);
        $found = true;
        break;
    }
    if (!$found) {
        return null;
    }
    $data = $current['data'];
    $data['matches'] = $matches;
    $ok = save_season($pdo, $current['id'], $data);
    return $ok ? get_season($pdo, $current['id']) : null;
}

function save_match_game(PDO $pdo, $teamId, $patch, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $teamRow = null;
    foreach ($current['data']['teams'] ?? [] as $item) {
        if (($item['id'] ?? '') === $teamId) {
            $teamRow = $item;
            break;
        }
    }
    if (!$teamRow) {
        return null;
    }
    $matches = $current['data']['matches'] ?? [];
    $found = false;
    foreach ($matches as $i => $match) {
        if (($match['id'] ?? '') !== ($patch['matchId'] ?? '')) {
            continue;
        }
        if (liga_team_match_side($match, $teamId) === null) {
            return null;
        }
        $ri = (int) ($patch['roundIndex'] ?? -1);
        $gi = (int) ($patch['gameIndex'] ?? -1);
        $side = $patch['side'] ?? '';
        $game = $match['rounds'][$ri]['games'][$gi] ?? null;
        if (!$game || ($side !== 'home' && $side !== 'away')) {
            return null;
        }
        if (array_key_exists('pins', $patch)) {
            $key = $side === 'home' ? 'homePins' : 'awayPins';
            $existing = $game[$key] ?? null;
            if (!liga_can_enter_pins($teamRow, $existing)) {
                return null;
            }
            $game[$key] = $patch['pins'];
        }
        if (array_key_exists('playerId', $patch)) {
            if (empty(liga_team_perms($teamRow)['lineup'])) {
                return null;
            }
            if (liga_team_match_side($match, $teamId) !== $side) {
                return null;
            }
            if ($ri === 0 && liga_lineup_locked($match['rounds'] ?? [])) {
                return null;
            }
            $pid = (string) ($patch['playerId'] ?? '');
            $starters = $side === 'home' ? ($match['homeStarters'] ?? []) : ($match['awayStarters'] ?? []);
            $bench = $side === 'home' ? ($match['homeBench'] ?? []) : ($match['awayBench'] ?? []);
            $allowed = array_flip(array_filter(array_merge($starters, $bench)));
            if ($pid !== '' && !isset($allowed[$pid])) {
                return null;
            }
            if ($side === 'home') {
                $game['homePlayerId'] = $pid;
            } else {
                $game['awayPlayerId'] = $pid;
            }
        }
        $match['rounds'][$ri]['games'][$gi] = $game;
        $filled = true;
        foreach ($match['rounds'] as $round) {
            foreach ($round['games'] ?? [] as $item) {
                if (($item['homePins'] ?? null) === null || ($item['awayPins'] ?? null) === null) {
                    $filled = false;
                    break 2;
                }
            }
        }
        $match['status'] = $filled ? 'done' : 'scheduled';
        $matches[$i] = $match;
        $found = true;
        break;
    }
    if (!$found) {
        return null;
    }
    $data = $current['data'];
    $data['matches'] = $matches;
    $ok = save_season($pdo, $current['id'], $data);
    return $ok ? get_season($pdo, $current['id']) : null;
}

function save_team_roster(PDO $pdo, $teamId, $roster, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $teamRow = null;
    foreach ($current['data']['teams'] ?? [] as $item) {
        if (($item['id'] ?? '') === $teamId) {
            $teamRow = $item;
            break;
        }
    }
    if (empty(liga_team_perms($teamRow)['roster'])) {
        return null;
    }
    $cleaned = [];
    foreach (is_array($roster) ? $roster : [] as $player) {
        $name = trim((string) ($player['name'] ?? ''));
        $id = (string) ($player['id'] ?? '');
        if ($name === '' || $id === '') {
            continue;
        }
        $cleaned[] = [
            'id' => $id,
            'teamId' => $teamId,
            'name' => $name,
            'gender' => (($player['gender'] ?? '') === 'F') ? 'F' : 'M',
            'bzsMember' => !empty($player['bzsMember']),
        ];
    }
    $others = [];
    foreach ($current['data']['players'] ?? [] as $player) {
        if (($player['teamId'] ?? '') !== $teamId) {
            $others[] = $player;
        }
    }
    $data = $current['data'];
    $data['players'] = array_merge($others, $cleaned);
    $ok = save_season($pdo, $current['id'], $data);
    return $ok ? get_season($pdo, $current['id']) : null;
}

function save_team_trainings(PDO $pdo, $teamId, $sessions, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $found = false;
    foreach ($current['data']['teams'] ?? [] as $team) {
        if (($team['id'] ?? null) === $teamId) {
            $found = true;
            break;
        }
    }
    if (!$found) {
        return null;
    }
    $data = $current['data'];
    $all = $data['teamTrainings'] ?? [];
    $all[$teamId] = is_array($sessions) ? $sessions : [];
    $data['teamTrainings'] = $all;
    $ok = save_season($pdo, $current['id'], $data);
    return $ok ? get_season($pdo, $current['id']) : null;
}

function set_team_password(PDO $pdo, $teamId, $password, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $trimmed = trim((string) $password);
    $hash = $trimmed !== '' ? hash_password_liga($trimmed) : '';
    $found = false;
    $teams = [];
    foreach ($current['data']['teams'] ?? [] as $team) {
        if (($team['id'] ?? null) === $teamId) {
            $found = true;
            $team['passwordHash'] = $hash;
        }
        $teams[] = $team;
    }
    if (!$found) {
        return null;
    }
    $data = $current['data'];
    $data['teams'] = $teams;
    $ok = save_season($pdo, $current['id'], $data);
    return $ok ? get_season($pdo, $current['id']) : null;
}

function create_season(PDO $pdo, $label, $data)
{
    $id = 's_' . base_convert((string) (int) round(microtime(true) * 1000), 10, 36);
    $payload = as_state($data ?: []);
    if (empty($payload['seasonTitle'])) {
        $payload['seasonTitle'] = $label;
    }
    q_run($pdo, 'INSERT INTO seasons (id, label, data) VALUES (?, ?, ?)', [$id, $label, dump_state($payload)]);
    return get_season($pdo, $id);
}

function present_season($season, $viewer)
{
    if (!$season) {
        return $season;
    }
    $season['data'] = sanitize_state($season['data'], $viewer);
    return $season;
}
