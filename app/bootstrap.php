<?php
/**
 * Dynamic Documents – bootstrap (config, DB, session, auth, helpers).
 * Compatible with PHP 7.4+.
 */
if (!defined('APP_ROOT')) {
    define('APP_ROOT', dirname(__DIR__));
}
define('STORAGE', APP_ROOT . '/storage');
define('APP_VERSION', trim((string)@file_get_contents(APP_ROOT . '/VERSION')) ?: '1.0.0');

mb_internal_encoding('UTF-8');
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
if (is_dir(STORAGE) && is_writable(STORAGE)) {
    ini_set('error_log', STORAGE . '/error.log');
}

/* ---------- helpers ---------- */
function e($s)
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function base_url()
{
    static $base = null;
    if ($base !== null) {
        return $base;
    }
    $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? ''));
    $file = str_replace('\\', '/', (string)realpath($_SERVER['SCRIPT_FILENAME'] ?? ''));
    $root = str_replace('\\', '/', (string)realpath(APP_ROOT));
    $rel = ($root !== '' && strpos($file, $root) === 0) ? substr($file, strlen($root)) : '/' . basename($script);
    if ($rel !== '' && substr($script, -strlen($rel)) === $rel) {
        $base = substr($script, 0, -strlen($rel));
    } else {
        $base = rtrim(dirname($script), '/');
    }
    return $base;
}

function url($path = '')
{
    return base_url() . '/' . ltrim($path, '/');
}

function redirect($to)
{
    header('Location: ' . $to);
    exit;
}

function json_out($data, $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_for_script($data)
{
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
}

/* ---------- config ---------- */
function cfg($key = null, $default = null)
{
    static $c = null;
    if ($c === null) {
        $f = STORAGE . '/config.php';
        $c = is_file($f) ? (array)(require $f) : [];
    }
    if ($key === null) {
        return $c;
    }
    return array_key_exists($key, $c) ? $c[$key] : $default;
}

function is_installed()
{
    return is_file(STORAGE . '/config.php') && is_file(STORAGE . '/installed.lock');
}

if (!defined('DD_INSTALLER') && !is_installed()) {
    if (PHP_SAPI !== 'cli') {
        redirect(url('install/'));
    }
}

/* ---------- session ---------- */
if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_NONE) {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('ddsess');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => base_url() === '' ? '/' : base_url() . '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    @session_start();
}

/* ---------- database ---------- */
function db()
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $c = cfg('db', []);
    if (($c['type'] ?? '') === 'mysql') {
        $dsn = 'mysql:host=' . $c['host'] . ';port=' . ($c['port'] ?? 3306) . ';dbname=' . $c['name'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $c['user'], $c['pass']);
    } else {
        $pdo = new PDO('sqlite:' . STORAGE . '/' . $c['file']);
        $pdo->exec('PRAGMA foreign_keys = ON');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

function setting($key, $default = null)
{
    static $all = null;
    if ($all === null) {
        $all = [];
        try {
            foreach (db()->query('SELECT k, v FROM settings') as $r) {
                $all[$r['k']] = $r['v'];
            }
        } catch (Exception $ex) {
        }
    }
    return array_key_exists($key, $all) ? $all[$key] : $default;
}

function set_setting($key, $value)
{
    $st = db()->prepare('DELETE FROM settings WHERE k = ?');
    $st->execute([$key]);
    $st = db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?)');
    $st->execute([$key, (string)$value]);
}

/* ---------- csrf & auth ---------- */
function csrf_token()
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function csrf_ok()
{
    $t = $_POST['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    return is_string($t) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t);
}

function csrf_require()
{
    if (!csrf_ok()) {
        if (strpos($_SERVER['SCRIPT_NAME'] ?? '', 'api.php') !== false) {
            json_out(['error' => 'Invalid or expired security token. Reload the page.'], 419);
        }
        http_response_code(419);
        exit('Invalid or expired security token. Go back, reload the page and try again.');
    }
}

function current_user()
{
    return $_SESSION['user'] ?? null;
}

function is_admin()
{
    $u = current_user();
    return $u && $u['role'] === 'admin';
}

function attempt_login($username, $password)
{
    $st = db()->prepare('SELECT * FROM users WHERE username = ?');
    $st->execute([trim($username)]);
    $u = $st->fetch();
    if ($u && password_verify($password, $u['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => (int)$u['id'], 'username' => $u['username'], 'name' => $u['name'], 'role' => $u['role']];
        return true;
    }
    return false;
}

function require_user()
{
    if (!current_user()) {
        redirect(url('login.php') . '?next=' . rawurlencode($_SERVER['REQUEST_URI'] ?? ''));
    }
}

function require_admin()
{
    if (!is_admin()) {
        redirect(url('login.php') . '?next=' . rawurlencode($_SERVER['REQUEST_URI'] ?? ''));
    }
}

function gate_public()
{
    if (setting('require_login', '0') === '1') {
        require_user();
    }
}

function safe_next($next)
{
    $next = (string)$next;
    if ($next === '' || $next[0] !== '/' || strpos($next, '//') === 0 || strpos($next, '\\') !== false) {
        return url('');
    }
    return $next;
}

function site_title()
{
    return setting('site_title', 'Dynamic Documents');
}
