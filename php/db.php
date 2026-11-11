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
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_edit_locks (
          season_id VARCHAR(64) NOT NULL,
          match_id VARCHAR(64) NOT NULL,
          token VARCHAR(64) NOT NULL,
          label VARCHAR(128) NOT NULL,
          updated_at DATETIME(3) NOT NULL,
          PRIMARY KEY (season_id, match_id),
          KEY idx_match_edit_locks_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS season_snapshots (
          id VARCHAR(64) NOT NULL,
          season_id VARCHAR(64) NOT NULL,
          kind VARCHAR(32) NOT NULL,
          round_num INT NULL,
          label VARCHAR(255) NOT NULL,
          data MEDIUMTEXT NOT NULL,
          created_at DATETIME(3) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_season_snapshots_round (season_id, kind, round_num),
          KEY idx_season_snapshots_created (season_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS site_presence (
          viewer_id VARCHAR(64) NOT NULL,
          kind VARCHAR(16) NOT NULL,
          seen_at DATETIME(3) NOT NULL,
          PRIMARY KEY (viewer_id),
          KEY idx_site_presence_seen (seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    sync_admin_password($pdo, $seed);
    sync_display_password($pdo);
}

function presence_kind_of($kind)
{
    $value = (string) $kind;
    return in_array($value, ['tv', 'standings', 'results', 'other'], true) ? $value : 'other';
}

function presence_viewer_id($id)
{
    $value = trim((string) $id);
    return preg_match('/^[A-Za-z0-9-]{8,64}$/', $value) ? $value : '';
}

function empty_presence_counts()
{
    return ['ok' => true, 'total' => 0, 'tv' => 0, 'standings' => 0, 'results' => 0, 'other' => 0];
}

function touch_site_presence(PDO $pdo, $id, $kind)
{
    $viewerId = presence_viewer_id($id);
    if ($viewerId === '') {
        return ['ok' => false];
    }
    q_run(
        $pdo,
        'DELETE FROM site_presence WHERE seen_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE)'
    );
    q_run(
        $pdo,
        'INSERT INTO site_presence (viewer_id, kind, seen_at)
         VALUES (?, ?, CURRENT_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), seen_at = CURRENT_TIMESTAMP(3)',
        [$viewerId, presence_kind_of($kind)]
    );
    return ['ok' => true];
}

function count_site_presence(PDO $pdo)
{
    $rows = q_all(
        $pdo,
        'SELECT kind, COUNT(*) AS n
         FROM site_presence
         WHERE seen_at >= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 90 SECOND)
         GROUP BY kind'
    );
    $counts = empty_presence_counts();
    foreach ($rows as $row) {
        $kind = presence_kind_of($row['kind'] ?? '');
        $counts[$kind] += (int) ($row['n'] ?? 0);
    }
    $counts['total'] = $counts['tv'] + $counts['standings'] + $counts['results'] + $counts['other'];
    return $counts;
}

define('SNAPSHOT_KEEP', 10);

function match_fully_filled($match)
{
    $rounds = $match['rounds'] ?? null;
    if (!is_array($rounds) || count($rounds) === 0) {
        return false;
    }
    foreach ($rounds as $round) {
        foreach ($round['games'] ?? [] as $game) {
            if (!array_key_exists('homePins', $game) || $game['homePins'] === null
                || !array_key_exists('awayPins', $game) || $game['awayPins'] === null) {
                return false;
            }
        }
    }
    return true;
}

function is_round_complete($data, $roundNum)
{
    $list = [];
    foreach ($data['matches'] ?? [] as $match) {
        if ((int) ($match['round'] ?? 0) === (int) $roundNum) {
            $list[] = $match;
        }
    }
    if (count($list) === 0) {
        return false;
    }
    foreach ($list as $match) {
        if (!match_fully_filled($match)) {
            return false;
        }
    }
    return true;
}

function prune_season_snapshots(PDO $pdo, $seasonId)
{
    $rows = q_all(
        $pdo,
        'SELECT id FROM season_snapshots WHERE season_id = ? ORDER BY created_at DESC',
        [$seasonId]
    );
    if (count($rows) <= SNAPSHOT_KEEP) {
        return;
    }
    $drop = array_slice(array_map(static fn ($r) => $r['id'], $rows), SNAPSHOT_KEEP);
    if (!$drop) {
        return;
    }
    $ph = implode(',', array_fill(0, count($drop), '?'));
    q_run($pdo, "DELETE FROM season_snapshots WHERE id IN ($ph)", $drop);
}

function ensure_round_snapshot(PDO $pdo, $seasonId, $roundNum)
{
    $season = get_season($pdo, $seasonId);
    if (!$season || !empty($season['archived']) || !empty($season['training'])) {
        return null;
    }
    $round = (int) $roundNum;
    if ($round < 1 || !is_round_complete($season['data'], $round)) {
        return null;
    }
    $label = "Po {$round}. kolu";
    $dataJson = dump_state($season['data']);
    $existing = q_all(
        $pdo,
        "SELECT id FROM season_snapshots WHERE season_id = ? AND kind = 'round' AND round_num = ? LIMIT 1",
        [$season['id'], $round]
    );
    if ($existing) {
        q_run(
            $pdo,
            'UPDATE season_snapshots SET label = ?, data = ?, created_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
            [$label, $dataJson, $existing[0]['id']]
        );
    } else {
        $id = 'snap_' . base_convert((string) time(), 10, 36) . '_' . bin2hex(random_bytes(3));
        q_run(
            $pdo,
            'INSERT INTO season_snapshots (id, season_id, kind, round_num, label, data, created_at)
             VALUES (?, ?, \'round\', ?, ?, ?, CURRENT_TIMESTAMP(3))',
            [$id, $season['id'], $round, $label, $dataJson]
        );
    }
    prune_season_snapshots($pdo, $season['id']);
    return true;
}

function create_manual_snapshot(PDO $pdo, $seasonId, $label = '')
{
    $season = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$season || !empty($season['archived'])) {
        return null;
    }
    $name = trim((string) $label);
    if ($name === '') {
        $name = 'Ročna točka';
    }
    $id = 'snap_' . base_convert((string) time(), 10, 36) . '_' . bin2hex(random_bytes(3));
    q_run(
        $pdo,
        'INSERT INTO season_snapshots (id, season_id, kind, round_num, label, data, created_at)
         VALUES (?, ?, \'manual\', NULL, ?, ?, CURRENT_TIMESTAMP(3))',
        [$id, $season['id'], mb_substr($name, 0, 255), dump_state($season['data'])]
    );
    prune_season_snapshots($pdo, $season['id']);
    return list_season_snapshots($pdo, $season['id']);
}

function list_season_snapshots(PDO $pdo, $seasonId)
{
    if (!$seasonId) {
        return [];
    }
    $rows = q_all(
        $pdo,
        'SELECT id, season_id, kind, round_num, label, created_at
         FROM season_snapshots WHERE season_id = ?
         ORDER BY created_at DESC LIMIT ' . (int) SNAPSHOT_KEEP,
        [$seasonId]
    );
    $out = [];
    foreach ($rows as $row) {
        $out[] = [
            'id' => $row['id'],
            'seasonId' => $row['season_id'],
            'kind' => $row['kind'],
            'round' => $row['round_num'] === null ? null : (int) $row['round_num'],
            'label' => $row['label'],
            'createdAt' => as_iso($row['created_at'] ?? null),
        ];
    }
    return $out;
}

function restore_season_snapshot(PDO $pdo, $snapshotId)
{
    $rows = q_all($pdo, 'SELECT * FROM season_snapshots WHERE id = ? LIMIT 1', [$snapshotId]);
    if (!$rows) {
        return null;
    }
    $snap = $rows[0];
    $current = get_season($pdo, $snap['season_id']);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $payload = preserve_secrets(as_state($snap['data']), $current['data']);
    $stmt = q_run(
        $pdo,
        'UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL',
        [dump_state($payload), $current['id']]
    );
    if ($stmt->rowCount() < 1) {
        return null;
    }
    return get_season($pdo, $current['id']);
}

define('MATCH_EDIT_LOCK_TTL_MS', 60000);

function match_edit_lock_fresh($row)
{
    if (empty($row['updated_at'])) {
        return false;
    }
    $t = strtotime((string) $row['updated_at']);
    if (!$t) {
        return false;
    }
    return (microtime(true) * 1000) - ($t * 1000) < MATCH_EDIT_LOCK_TTL_MS;
}

function read_match_edit_lock(PDO $pdo, $seasonId, $matchId)
{
    $rows = q_all(
        $pdo,
        'SELECT season_id, match_id, token, label, updated_at FROM match_edit_locks WHERE season_id = ? AND match_id = ? LIMIT 1',
        [$seasonId, $matchId]
    );
    return $rows[0] ?? null;
}

function write_match_edit_lock(PDO $pdo, $seasonId, $matchId, $token, $label)
{
    q_run(
        $pdo,
        'INSERT INTO match_edit_locks (season_id, match_id, token, label, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE token = VALUES(token), label = VALUES(label), updated_at = CURRENT_TIMESTAMP(3)',
        [$seasonId, $matchId, $token, $label]
    );
}

function claim_match_edit_lock(PDO $pdo, $seasonId, $matchId, $token, $label, $force = false)
{
    $sid = trim((string) $seasonId);
    $mid = trim((string) $matchId);
    $tok = trim((string) $token);
    $lab = trim((string) $label);
    if ($lab === '') {
        $lab = 'Nekdo';
    }
    $lab = mb_substr($lab, 0, 128);
    if ($sid === '' || $mid === '' || $tok === '') {
        return ['ok' => false, 'error' => 'invalid'];
    }
    $existing = read_match_edit_lock($pdo, $sid, $mid);
    if ($existing && match_edit_lock_fresh($existing) && ($existing['token'] ?? '') !== $tok && !$force) {
        return [
            'ok' => true,
            'held' => false,
            'conflict' => [
                'label' => (string) ($existing['label'] ?? 'Nekdo'),
                'updatedAt' => as_iso($existing['updated_at'] ?? null),
            ],
        ];
    }
    write_match_edit_lock($pdo, $sid, $mid, $tok, $lab);
    return ['ok' => true, 'held' => true];
}

function heartbeat_match_edit_lock(PDO $pdo, $seasonId, $matchId, $token, $label)
{
    $sid = trim((string) $seasonId);
    $mid = trim((string) $matchId);
    $tok = trim((string) $token);
    $lab = trim((string) $label);
    if ($lab === '') {
        $lab = 'Nekdo';
    }
    $lab = mb_substr($lab, 0, 128);
    if ($sid === '' || $mid === '' || $tok === '') {
        return ['ok' => false];
    }
    $existing = read_match_edit_lock($pdo, $sid, $mid);
    if ($existing && match_edit_lock_fresh($existing) && ($existing['token'] ?? '') !== $tok) {
        return [
            'ok' => true,
            'held' => false,
            'conflict' => [
                'label' => (string) ($existing['label'] ?? 'Nekdo'),
                'updatedAt' => as_iso($existing['updated_at'] ?? null),
            ],
        ];
    }
    write_match_edit_lock($pdo, $sid, $mid, $tok, $lab);
    return ['ok' => true, 'held' => true];
}

function release_match_edit_lock(PDO $pdo, $seasonId, $matchId, $token)
{
    $sid = trim((string) $seasonId);
    $mid = trim((string) $matchId);
    $tok = trim((string) $token);
    if ($sid === '' || $mid === '' || $tok === '') {
        return ['ok' => false];
    }
    q_run(
        $pdo,
        'DELETE FROM match_edit_locks WHERE season_id = ? AND match_id = ? AND token = ?',
        [$sid, $mid, $tok]
    );
    return ['ok' => true];
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

function sync_display_password(PDO $pdo)
{
    $rows = q_all($pdo, 'SELECT value FROM settings WHERE name = ? LIMIT 1', ['display_password']);
    $fromDb = $rows[0]['value'] ?? '';
    if (is_string($fromDb) && trim($fromDb) !== '') {
        set_display_password(trim($fromDb));
        return trim($fromDb);
    }
    set_display_password('');
    return '';
}

/** Admin: nastavi ali zbriši geslo za TV prikaz. */
function set_display_password_setting(PDO $pdo, $password)
{
    $pw = trim((string) $password);
    if ($pw === '') {
        q_run($pdo, 'DELETE FROM settings WHERE name = ?', ['display_password']);
        set_display_password('');
        return ['ok' => true, 'hasDisplayPassword' => false];
    }
    q_run(
        $pdo,
        'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        ['display_password', $pw]
    );
    set_display_password($pw);
    return ['ok' => true, 'hasDisplayPassword' => true];
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

/** True, če je strežnikova sezona novejša od klientove baze. */
function is_season_base_stale($serverUpdatedAt, $baseUpdatedAt)
{
    if ($baseUpdatedAt === null || $baseUpdatedAt === '') {
        return false;
    }
    $serverMs = strtotime((string) $serverUpdatedAt);
    $baseMs = strtotime((string) $baseUpdatedAt);
    if ($serverMs === false || $baseMs === false) {
        return false;
    }
    return $serverMs > $baseMs + 0; // strtotime je v sekundah; +750ms ≈ ista sekunda OK
}

/**
 * Celoten zapis sezone z zavrnitvijo starejše baze.
 * @return array{ok:bool,conflict?:bool,season?:array|null}
 */
function save_season_if_fresh(PDO $pdo, $id, $data, $opts = [])
{
    $started = !$pdo->inTransaction();
    try {
        $current = begin_season_lock($pdo, $id);
        if (!$current) {
            if ($started && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return ['ok' => false];
        }
        if (is_season_base_stale($current['updatedAt'] ?? null, $opts['baseUpdatedAt'] ?? null)) {
            if ($started && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return ['ok' => false, 'conflict' => true, 'season' => $current];
        }
        $payload = preserve_secrets(as_state($data), $current['data'] ?? null, $opts);
        q_run(
            $pdo,
            'UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL',
            [dump_state($payload), $current['id']]
        );
        if ($started && $pdo->inTransaction()) {
            $pdo->commit();
        }
        return ['ok' => true, 'season' => get_season($pdo, $current['id'])];
    } catch (Exception $e) {
        if ($started && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Zaklene vrstico sezone, da dva hkratna vpisa ne prepišeta drug drugega. */
function begin_season_lock(PDO $pdo, $seasonId)
{
    if (!$pdo->inTransaction()) {
        $pdo->beginTransaction();
    }
    if ($seasonId) {
        $rows = q_all($pdo, 'SELECT * FROM seasons WHERE id = ? AND archived_at IS NULL FOR UPDATE', [$seasonId]);
    } else {
        $rows = q_all(
            $pdo,
            'SELECT * FROM seasons WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE'
        );
    }
    if (!$rows) {
        return null;
    }
    return as_season($rows[0]);
}

function finish_season_write(PDO $pdo, $started, $ok, $seasonId)
{
    if ($started && $pdo->inTransaction()) {
        if ($ok) {
            $pdo->commit();
        } else {
            $pdo->rollBack();
        }
    }
    return $ok ? get_season($pdo, $seasonId) : null;
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

function liga_same_id_list($a, $b)
{
    $left = is_array($a) ? array_map(static fn ($id) => (string) ($id ?? ''), $a) : [];
    $right = is_array($b) ? array_map(static fn ($id) => (string) ($id ?? ''), $b) : [];
    if (count($left) !== count($right)) {
        return false;
    }
    foreach ($left as $i => $id) {
        if ($id !== $right[$i]) {
            return false;
        }
    }
    return true;
}

function save_match_lineup(PDO $pdo, $teamId, $matchId, $side, $starters, $bench, $seasonId, $asAdmin = false, $opts = [])
{
    $started = !$pdo->inTransaction();
    try {
        $current = begin_season_lock($pdo, $seasonId);
        if (!$current || !empty($current['archived'])) {
            return finish_season_write($pdo, $started, false, $seasonId);
        }
        $matches = $current['data']['matches'] ?? [];
        $players = $current['data']['players'] ?? [];
        $found = false;
        foreach ($matches as $i => $match) {
            if (($match['id'] ?? '') !== $matchId) {
                continue;
            }
            $rosterTeamId = $teamId;
            if ($asAdmin) {
                $rosterTeamId = $side === 'home' ? ($match['homeTeamId'] ?? '') : ($match['awayTeamId'] ?? '');
            } else {
                $teamRow = null;
                foreach ($current['data']['teams'] ?? [] as $item) {
                    if (($item['id'] ?? '') === $teamId) {
                        $teamRow = $item;
                        break;
                    }
                }
                if (empty(liga_team_perms($teamRow)['lineup'])) {
                    return finish_season_write($pdo, $started, false, $current['id']);
                }
                $own = liga_team_match_side($match, $teamId);
                if ($own === null || $own !== $side) {
                    return finish_season_write($pdo, $started, false, $current['id']);
                }
            }
            if (liga_lineup_locked($match['rounds'] ?? [])) {
                return finish_season_write($pdo, $started, false, $current['id']);
            }
            if (array_key_exists('baseStarters', $opts) && is_array($opts['baseStarters'])) {
                $serverStarters = $side === 'home' ? ($match['homeStarters'] ?? []) : ($match['awayStarters'] ?? []);
                $serverBench = $side === 'home' ? ($match['homeBench'] ?? []) : ($match['awayBench'] ?? []);
                $baseBench = $opts['baseBench'] ?? [];
                if (!liga_same_id_list($serverStarters, $opts['baseStarters']) || !liga_same_id_list($serverBench, $baseBench)) {
                    if ($started && $pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    return ['conflict' => true, 'season' => $current];
                }
            }
            $allowed = [];
            foreach ($players as $player) {
                if (($player['teamId'] ?? '') === $rosterTeamId) {
                    $allowed[$player['id']] = true;
                }
            }
            [$cleanStarters, $cleanBench] = liga_sanitize_lineup($starters, $bench, $allowed);
            $matches[$i] = liga_apply_lineup($match, $side, $cleanStarters, $cleanBench);
            $found = true;
            break;
        }
        if (!$found) {
            return finish_season_write($pdo, $started, false, $current['id']);
        }
        $data = $current['data'];
        $data['matches'] = $matches;
        $ok = save_season($pdo, $current['id'], $data, ['lockPerms' => true]);
        return finish_season_write($pdo, $started, $ok, $current['id']);
    } catch (Exception $e) {
        if ($started && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function maybe_snapshot_after_match_save(PDO $pdo, $season, $matchId)
{
    if (!$season || empty($season['id']) || !empty($season['conflict'])) {
        return;
    }
    foreach ($season['data']['matches'] ?? [] as $match) {
        if (($match['id'] ?? '') !== $matchId) {
            continue;
        }
        if (($match['status'] ?? '') === 'done' || match_fully_filled($match)) {
            try {
                ensure_round_snapshot($pdo, $season['id'], $match['round'] ?? 0);
            } catch (Exception $e) {
                /* ignore */
            }
        }
        break;
    }
}

function save_match_game(PDO $pdo, $teamId, $patch, $seasonId, $asAdmin = false)
{
    $started = !$pdo->inTransaction();
    try {
        $result = save_match_game_locked($pdo, $teamId, $patch, $seasonId, $asAdmin, $started);
        maybe_snapshot_after_match_save($pdo, $result, $patch['matchId'] ?? '');
        return $result;
    } catch (Exception $e) {
        if ($started && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function save_match_game_locked(PDO $pdo, $teamId, $patch, $seasonId, $asAdmin, $started)
{
    $current = begin_season_lock($pdo, $seasonId);
    if (!$current || !empty($current['archived'])) {
        return finish_season_write($pdo, $started, false, $seasonId);
    }
    $teamRow = null;
    foreach ($current['data']['teams'] ?? [] as $item) {
        if (($item['id'] ?? '') === $teamId) {
            $teamRow = $item;
            break;
        }
    }
    if (!$asAdmin && !$teamRow) {
        return finish_season_write($pdo, $started, false, $current['id']);
    }
    $matches = $current['data']['matches'] ?? [];
    $found = false;
    foreach ($matches as $i => $match) {
        if (($match['id'] ?? '') !== ($patch['matchId'] ?? '')) {
            continue;
        }
        if (!$asAdmin && liga_team_match_side($match, $teamId) === null) {
            return finish_season_write($pdo, $started, false, $current['id']);
        }
        $ri = (int) ($patch['roundIndex'] ?? -1);
        $gi = (int) ($patch['gameIndex'] ?? -1);
        $side = $patch['side'] ?? '';
        $game = $match['rounds'][$ri]['games'][$gi] ?? null;
        if (!$game || ($side !== 'home' && $side !== 'away')) {
            return finish_season_write($pdo, $started, false, $current['id']);
        }
        if (array_key_exists('pins', $patch)) {
            $key = $side === 'home' ? 'homePins' : 'awayPins';
            $existing = $game[$key] ?? null;
            if (!$asAdmin && !liga_can_enter_pins($teamRow, $existing)) {
                return finish_season_write($pdo, $started, false, $current['id']);
            }
            $game[$key] = $patch['pins'];
        }
        if (array_key_exists('playerId', $patch)) {
            if (!$asAdmin && empty(liga_team_perms($teamRow)['lineup'])) {
                return finish_season_write($pdo, $started, false, $current['id']);
            }
            if (!$asAdmin && liga_team_match_side($match, $teamId) !== $side) {
                return finish_season_write($pdo, $started, false, $current['id']);
            }
            if ($ri === 0 && liga_lineup_locked($match['rounds'] ?? [])) {
                return finish_season_write($pdo, $started, false, $current['id']);
            }
            $pid = (string) ($patch['playerId'] ?? '');
            $starters = $side === 'home' ? ($match['homeStarters'] ?? []) : ($match['awayStarters'] ?? []);
            $bench = $side === 'home' ? ($match['homeBench'] ?? []) : ($match['awayBench'] ?? []);
            $allowed = array_flip(array_filter(array_merge($starters, $bench)));
            if ($pid !== '' && !isset($allowed[$pid])) {
                return finish_season_write($pdo, $started, false, $current['id']);
            }
            if (liga_player_on_other_lane($match['rounds'][$ri]['games'] ?? [], $side, $pid, $gi)) {
                return finish_season_write($pdo, $started, false, $current['id']);
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
        if ($filled) {
            unset($match['liveOnTv']);
        }
        $matches[$i] = $match;
        $found = true;
        break;
    }
    if (!$found) {
        return finish_season_write($pdo, $started, false, $current['id']);
    }
    $data = $current['data'];
    $data['matches'] = $matches;
    $ok = save_season($pdo, $current['id'], $data, ['lockPerms' => true]);
    return finish_season_write($pdo, $started, $ok, $current['id']);
}

/** Admin: ena tekma (sestava + keglji). Ostale tekme in ekipe ostanejo. */
function save_admin_match(PDO $pdo, $seasonId, $incoming, $opts = [])
{
    $started = !$pdo->inTransaction();
    try {
        $current = begin_season_lock($pdo, $seasonId);
        if (!$current || !empty($current['archived']) || !is_array($incoming)) {
            return finish_season_write($pdo, $started, false, $seasonId);
        }
        if (is_season_base_stale($current['updatedAt'] ?? null, $opts['baseUpdatedAt'] ?? null)) {
            if ($started && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return ['conflict' => true, 'season' => $current];
        }
        $matchId = (string) ($incoming['id'] ?? '');
        $matches = $current['data']['matches'] ?? [];
        $players = $current['data']['players'] ?? [];
        $found = false;
        foreach ($matches as $i => $match) {
            if (($match['id'] ?? '') !== $matchId) {
                continue;
            }
            $homeAllowed = [];
            $awayAllowed = [];
            foreach ($players as $player) {
                $pid = $player['id'] ?? '';
                if (($player['teamId'] ?? '') === ($match['homeTeamId'] ?? '')) {
                    $homeAllowed[$pid] = true;
                }
                if (($player['teamId'] ?? '') === ($match['awayTeamId'] ?? '')) {
                    $awayAllowed[$pid] = true;
                }
            }
            [$homeStarters, $homeBench] = liga_sanitize_lineup(
                $incoming['homeStarters'] ?? [],
                $incoming['homeBench'] ?? [],
                $homeAllowed
            );
            [$awayStarters, $awayBench] = liga_sanitize_lineup(
                $incoming['awayStarters'] ?? [],
                $incoming['awayBench'] ?? [],
                $awayAllowed
            );
            $next = liga_apply_lineup($match, 'home', $homeStarters, $homeBench);
            $next = liga_apply_lineup($next, 'away', $awayStarters, $awayBench);
            $inRounds = $incoming['rounds'] ?? [];
            foreach ($next['rounds'] as $ri => $round) {
                foreach ($round['games'] as $gi => $game) {
                    $cell = $inRounds[$ri]['games'][$gi] ?? null;
                    if (!is_array($cell)) {
                        continue;
                    }
                    if (array_key_exists('homePins', $cell)) {
                        $next['rounds'][$ri]['games'][$gi]['homePins'] = $cell['homePins'];
                    }
                    if (array_key_exists('awayPins', $cell)) {
                        $next['rounds'][$ri]['games'][$gi]['awayPins'] = $cell['awayPins'];
                    }
                }
            }
            $filled = true;
            foreach ($next['rounds'] as $round) {
                foreach ($round['games'] ?? [] as $game) {
                    if (!array_key_exists('homePins', $game) || $game['homePins'] === null || !array_key_exists('awayPins', $game) || $game['awayPins'] === null) {
                        $filled = false;
                        break 2;
                    }
                }
            }
            $next['status'] = $filled ? 'done' : 'scheduled';
            $matches[$i] = $next;
            $found = true;
            break;
        }
        if (!$found) {
            return finish_season_write($pdo, $started, false, $current['id']);
        }
        $data = $current['data'];
        $data['matches'] = $matches;
        $ok = save_season($pdo, $current['id'], $data, ['lockPerms' => true]);
        $result = finish_season_write($pdo, $started, $ok, $current['id']);
        maybe_snapshot_after_match_save($pdo, $result, $matchId);
        return $result;
    } catch (Exception $e) {
        if ($started && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function save_team_roster(PDO $pdo, $teamId, $roster, $seasonId, $opts = [])
{
    $admin = !empty($opts['admin']);
    $started = !$pdo->inTransaction();
    try {
        $current = begin_season_lock($pdo, $seasonId);
        if (!$current || !empty($current['archived'])) {
            if ($started && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return null;
        }
        if (is_season_base_stale($current['updatedAt'] ?? null, $opts['baseUpdatedAt'] ?? null)) {
            if ($started && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return ['conflict' => true, 'season' => $current];
        }
        $teamRow = null;
        foreach ($current['data']['teams'] ?? [] as $item) {
            if (($item['id'] ?? '') === $teamId) {
                $teamRow = $item;
                break;
            }
        }
        if (!$teamRow) {
            if ($started && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return null;
        }
        if (!$admin) {
            if (empty(liga_team_perms($teamRow)['roster']) || !liga_roster_window_open($current['data']['matches'] ?? [])) {
                if ($started && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                return null;
            }
        }
        $cleaned = [];
        foreach (is_array($roster) ? $roster : [] as $player) {
            $id = (string) ($player['id'] ?? '');
            $firstName = trim((string) ($player['firstName'] ?? ''));
            $surname = trim((string) ($player['surname'] ?? ''));
            $legacy = trim((string) ($player['name'] ?? ''));
            if ($firstName === '' && $surname === '' && $legacy !== '') {
                $parts = preg_split('/\s+/u', $legacy, -1, PREG_SPLIT_NO_EMPTY) ?: [];
                if (count($parts) === 1) {
                    $firstName = $parts[0];
                } elseif (count($parts) > 1) {
                    $surname = array_pop($parts);
                    $firstName = implode(' ', $parts);
                }
            }
            $name = trim(implode(' ', array_filter([$surname, $firstName], static fn ($p) => $p !== '')));
            if ($name === '') {
                $name = $legacy;
            }
            if ($name === '' || $id === '') {
                continue;
            }
            $cleaned[] = [
                'id' => $id,
                'teamId' => $teamId,
                'firstName' => $firstName,
                'surname' => $surname,
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
        $payload = preserve_secrets(as_state($data), $current['data'], ['lockPerms' => !$admin]);
        q_run(
            $pdo,
            'UPDATE seasons SET data = ?, updated_at = NOW() WHERE id = ? AND archived_at IS NULL',
            [dump_state($payload), $current['id']]
        );
        if ($started && $pdo->inTransaction()) {
            $pdo->commit();
        }
        return get_season($pdo, $current['id']);
    } catch (Exception $e) {
        if ($started && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
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
            unset($team['inviteHash'], $team['inviteExpires']);
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

function create_team_invite(PDO $pdo, $teamId, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return null;
    }
    $found = false;
    $token = new_invite_token();
    $expiresAt = invite_expiry_iso();
    $teams = [];
    foreach ($current['data']['teams'] ?? [] as $team) {
        if (($team['id'] ?? null) === $teamId) {
            $found = true;
            $team['inviteHash'] = hash_invite_token($token);
            $team['inviteExpires'] = $expiresAt;
        }
        $teams[] = $team;
    }
    if (!$found) {
        return null;
    }
    $data = $current['data'];
    $data['teams'] = $teams;
    $ok = save_season($pdo, $current['id'], $data);
    if (!$ok) {
        return null;
    }
    $saved = get_season($pdo, $current['id']);
    return $saved ? ['token' => $token, 'expiresAt' => $expiresAt, 'current' => $saved] : null;
}

function preview_team_invite(PDO $pdo, $token, $seasonId)
{
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current) {
        return ['ok' => false, 'error' => 'invalid'];
    }
    $team = find_invite_team($current['data']['teams'] ?? [], $token);
    if (!$team) {
        return ['ok' => false, 'error' => 'invalid'];
    }
    if (!invite_still_open($team)) {
        return ['ok' => false, 'error' => 'expired'];
    }
    return ['ok' => true, 'teamName' => $team['name'] ?? '', 'expiresAt' => $team['inviteExpires'] ?? null];
}

function claim_team_invite(PDO $pdo, $token, $password, $seasonId)
{
    $trimmed = trim((string) $password);
    if (strlen($trimmed) < 4) {
        return ['ok' => false, 'error' => 'short'];
    }
    $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
    if (!$current || !empty($current['archived'])) {
        return ['ok' => false, 'error' => 'invalid'];
    }
    $team = find_invite_team($current['data']['teams'] ?? [], $token);
    if (!$team) {
        return ['ok' => false, 'error' => 'invalid'];
    }
    if (!invite_still_open($team)) {
        return ['ok' => false, 'error' => 'expired'];
    }
    $teams = [];
    foreach ($current['data']['teams'] ?? [] as $item) {
        if (($item['id'] ?? null) === ($team['id'] ?? null)) {
            $item['passwordHash'] = hash_password_liga($trimmed);
            unset($item['inviteHash'], $item['inviteExpires']);
        }
        $teams[] = $item;
    }
    $data = $current['data'];
    $data['teams'] = $teams;
    $ok = save_season($pdo, $current['id'], $data);
    if (!$ok) {
        return ['ok' => false, 'error' => 'conflict'];
    }
    return ['ok' => true, 'teamName' => $team['name'] ?? ''];
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
