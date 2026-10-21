<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/passwords.php';

function json_out($status, $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function route_name()
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $path = $path ? $path : '';
    if (preg_match('#/api/([a-zA-Z0-9_-]+)#', $path, $m)) {
        return $m[1];
    }
    return '';
}

function boot_db()
{
    $pdo = get_pdo();
    if ($pdo) {
        ensure_schema($pdo);
    }
    return $pdo;
}

$route = route_name();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($route === 'setup') {
    if ($method === 'GET') {
        json_out(200, [
            'needed' => !is_configured(),
            'defaults' => ['host' => 'localhost', 'port' => 3306, 'database' => 'bowling_liga'],
        ]);
    }
    if ($method !== 'POST') {
        json_out(405, ['ok' => false]);
    }
    if (is_configured()) {
        json_out(409, ['ok' => false, 'error' => 'Namestitev je že opravljena.']);
    }
    $body = read_json_body();
    $host = trim((string) ($body['host'] ?? 'localhost'));
    $user = trim((string) ($body['user'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $database = trim((string) ($body['database'] ?? ''));
    $port = (int) ($body['port'] ?? 3306);
    $adminPassword = trim((string) ($body['adminPassword'] ?? ''));
    if ($host === '' || $user === '' || $database === '' || $adminPassword === '') {
        json_out(400, ['ok' => false, 'error' => 'Izpolni gostitelja, uporabnika, bazo in admin geslo.']);
    }
    try {
        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->query('SELECT 1');
        save_config(['mysql' => compact('host', 'user', 'password', 'database', 'port')]);
        ensure_schema($pdo, $adminPassword);
        json_out(200, ['ok' => true]);
    } catch (Exception $e) {
        json_out(400, [
            'ok' => false,
            'error' => 'MySQL povezava ni uspela. Preveri podatke in da baza v phpMyAdmin že obstaja.',
            'detail' => $e->getMessage(),
        ]);
    }
}

if ($route === 'logout') {
    clear_liga_cookie(is_secure_request());
    json_out(200, ['ok' => true]);
}

if ($route === 'login') {
    if ($method !== 'POST') {
        json_out(405, ['ok' => false]);
    }
    try {
        $password = read_json_body()['password'] ?? '';
        $secure = is_secure_request();
        $pdo = boot_db();
        if (password_ok($password)) {
            set_liga_cookie(sign_token(['a' => 1]), $secure);
            json_out(200, ['ok' => true, 'admin' => true]);
        }
        if ($pdo) {
            $current = get_current_season($pdo);
            foreach ($current['data']['teams'] ?? [] as $team) {
                if (!empty($team['passwordHash']) && verify_password_liga($password, $team['passwordHash'])) {
                    set_liga_cookie(sign_token(['t' => $team['id']]), $secure);
                    json_out(200, ['ok' => true, 'admin' => false, 'teamId' => $team['id'], 'teamName' => $team['name'] ?? '']);
                }
            }
        }
        json_out(401, ['ok' => false]);
    } catch (Exception $e) {
        json_out(400, ['ok' => false]);
    }
}

if ($route === 'me') {
    $pdo = null;
    try {
        $pdo = boot_db();
    } catch (Exception $e) {
        $pdo = null;
    }
    $session = viewer_of();
    $teamName = null;
    if (!empty($session['teamId']) && $pdo) {
        try {
            $current = get_current_season($pdo);
            foreach ($current['data']['teams'] ?? [] as $team) {
                if (($team['id'] ?? null) === $session['teamId']) {
                    $teamName = $team['name'] ?? null;
                    break;
                }
            }
        } catch (Exception $e) {
            $teamName = null;
        }
    }
    json_out(200, ['admin' => !empty($session['admin']), 'teamId' => $session['teamId'], 'teamName' => $teamName]);
}

if ($route === 'league') {
    $pdo = get_pdo();
    if (!$pdo) {
        json_out(200, ['storage' => 'local']);
    }
    try {
        ensure_schema($pdo);
        $viewer = viewer_of();
        $seasonId = $_GET['id'] ?? null;

        if ($method === 'GET') {
            $current = $seasonId ? get_season($pdo, $seasonId) : get_current_season($pdo);
            if (!empty($current['training']) && empty($viewer['admin'])) {
                $current = get_current_season($pdo);
            }
            if (!$current) {
                json_out(404, ['ok' => false]);
            }
            json_out(200, [
                'storage' => 'db',
                'current' => present_season($current, $viewer),
                'seasons' => list_seasons($pdo, !empty($viewer['admin'])),
            ]);
        }

        if ($method === 'PUT') {
            $body = read_json_body();
            $id = $body['id'] ?? get_current_season($pdo)['id'];
            if (empty($viewer['admin'])) {
                $current = get_season($pdo, $id);
                $teamRow = null;
                foreach ($current['data']['teams'] ?? [] as $item) {
                    if (($item['id'] ?? '') === ($viewer['teamId'] ?? '')) {
                        $teamRow = $item;
                        break;
                    }
                }
                if (empty(liga_team_perms($teamRow)['season'])) {
                    json_out(401, ['ok' => false]);
                }
            }
            $ok = save_season($pdo, $id, $body['data'] ?? [], ['lockPerms' => empty($viewer['admin'])]);
            json_out($ok ? 200 : 409, ['ok' => $ok]);
        }

        if ($method === 'POST') {
            $body = read_json_body();
            $action = $body['action'] ?? '';
            if ($action === 'previewInvite') {
                $result = preview_team_invite($pdo, $body['token'] ?? '', $body['id'] ?? null);
                json_out(!empty($result['ok']) ? 200 : 400, $result);
            }
            if ($action === 'claimInvite') {
                $result = claim_team_invite($pdo, $body['token'] ?? '', $body['password'] ?? '', $body['id'] ?? null);
                $code = !empty($result['ok']) ? 200 : (($result['error'] ?? '') === 'conflict' ? 409 : 400);
                json_out($code, $result);
            }
            if ($action === 'saveGame') {
                $asAdmin = !empty($viewer['admin']);
                $teamId = $viewer['teamId'] ?? null;
                if (!$asAdmin && !$teamId) {
                    json_out(401, ['ok' => false]);
                }
                $current = save_match_game($pdo, $teamId, $body, $body['id'] ?? null, $asAdmin);
                if (!$current) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'storage' => 'db',
                    'current' => present_season($current, $viewer),
                    'seasons' => list_seasons($pdo, !empty($viewer['admin'])),
                ]);
            }
            if ($action === 'saveRoster') {
                $teamId = $viewer['teamId'] ?? null;
                if (!$teamId) {
                    json_out(401, ['ok' => false]);
                }
                $current = save_team_roster($pdo, $teamId, $body['players'] ?? [], $body['id'] ?? null);
                if (!$current) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'storage' => 'db',
                    'current' => present_season($current, $viewer),
                    'seasons' => list_seasons($pdo, !empty($viewer['admin'])),
                ]);
            }
            if ($action === 'saveLineup') {
                $asAdmin = !empty($viewer['admin']);
                $teamId = $viewer['teamId'] ?? null;
                if (!$asAdmin && !$teamId) {
                    json_out(401, ['ok' => false]);
                }
                $side = ($body['side'] ?? '') === 'away' ? 'away' : (($body['side'] ?? '') === 'home' ? 'home' : null);
                if (!$side || empty($body['matchId'])) {
                    json_out(400, ['ok' => false]);
                }
                $current = save_match_lineup(
                    $pdo,
                    $teamId,
                    $body['matchId'],
                    $side,
                    $body['starters'] ?? [],
                    $body['bench'] ?? [],
                    $body['id'] ?? null,
                    $asAdmin
                );
                if (!$current) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'storage' => 'db',
                    'current' => present_season($current, $viewer),
                    'seasons' => list_seasons($pdo, !empty($viewer['admin'])),
                ]);
            }
            if ($action === 'saveMatch') {
                if (empty($viewer['admin'])) {
                    json_out(401, ['ok' => false]);
                }
                $current = save_admin_match($pdo, $body['id'] ?? null, $body['match'] ?? []);
                if (!$current) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'storage' => 'db',
                    'current' => present_season($current, $viewer),
                    'seasons' => list_seasons($pdo, true),
                ]);
            }
            if ($action === 'saveTraining') {
                $teamId = !empty($viewer['admin']) ? ($body['teamId'] ?? null) : ($viewer['teamId'] ?? null);
                if (!$teamId) {
                    json_out(401, ['ok' => false]);
                }
                $current = save_team_trainings($pdo, $teamId, $body['sessions'] ?? [], $body['id'] ?? null);
                if (!$current) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'storage' => 'db',
                    'current' => present_season($current, $viewer),
                    'seasons' => list_seasons($pdo, !empty($viewer['admin'])),
                ]);
            }
            if ($action === 'setTeamPassword') {
                if (empty($viewer['admin'])) {
                    json_out(401, ['ok' => false]);
                }
                $current = set_team_password($pdo, $body['teamId'] ?? '', $body['password'] ?? '', $body['id'] ?? null);
                if (!$current) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'storage' => 'db',
                    'current' => present_season($current, $viewer),
                    'seasons' => list_seasons($pdo, true),
                ]);
            }
            if ($action === 'createInvite') {
                if (empty($viewer['admin'])) {
                    json_out(401, ['ok' => false]);
                }
                $created = create_team_invite($pdo, $body['teamId'] ?? '', $body['id'] ?? null);
                if (!$created) {
                    json_out(409, ['ok' => false]);
                }
                json_out(200, [
                    'ok' => true,
                    'token' => $created['token'],
                    'expiresAt' => $created['expiresAt'],
                    'storage' => 'db',
                    'current' => present_season($created['current'], $viewer),
                    'seasons' => list_seasons($pdo, true),
                ]);
            }
            if (empty($viewer['admin'])) {
                json_out(401, ['ok' => false]);
            }
            if ($action === 'archive') {
                $current = archive_current($pdo, $body['id'] ?? null);
            } elseif ($action === 'reopen') {
                $current = reopen_season($pdo, $body['id'] ?? null);
            } elseif ($action === 'create') {
                $current = create_season($pdo, $body['label'] ?? 'Nova sezona', $body['data'] ?? []);
            } elseif ($action === 'replace') {
                $current = replace_season($pdo, $body['id'] ?? '', $body['data'] ?? [], $body['label'] ?? null);
                if (!$current) {
                    json_out(404, ['ok' => false]);
                }
            } elseif ($action === 'rename') {
                $current = rename_season($pdo, $body['id'] ?? '', $body['label'] ?? '');
                if (!$current) {
                    json_out(404, ['ok' => false]);
                }
            } elseif ($action === 'delete') {
                $current = delete_season($pdo, $body['id'] ?? '');
            } else {
                json_out(400, ['ok' => false]);
            }
            json_out(200, [
                'storage' => 'db',
                'current' => present_season($current, $viewer),
                'seasons' => list_seasons($pdo, true),
            ]);
        }

        json_out(405, ['ok' => false]);
    } catch (Exception $e) {
        json_out(500, ['ok' => false, 'error' => $e->getMessage()]);
    }
}

json_out(404, ['ok' => false]);
