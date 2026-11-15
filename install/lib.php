<?php
/** Installer logic shared by the web wizard (index.php) and the CLI (cli.php). */

function inst_requirements()
{
    $r = [];
    $add = function ($label, $ok, $hint = '', $fatal = true) use (&$r) {
        $r[] = ['label' => $label, 'ok' => (bool)$ok, 'hint' => $hint, 'fatal' => $fatal];
    };
    $add('PHP 7.4 or newer (found ' . PHP_VERSION . ')', version_compare(PHP_VERSION, '7.4.0', '>='), 'cPanel → "MultiPHP Manager" → choose PHP 8.x for this domain.');
    $add('PDO extension', extension_loaded('pdo'), 'Enable "pdo" in cPanel → Select PHP Version → Extensions.');
    $add('PDO SQLite or PDO MySQL driver', extension_loaded('pdo_sqlite') || extension_loaded('pdo_mysql'), 'Enable pdo_sqlite or pdo_mysql in cPanel → Select PHP Version → Extensions.');
    $add('mbstring extension', extension_loaded('mbstring'), 'Enable "mbstring" in cPanel → Select PHP Version → Extensions.');
    $add('JSON extension', function_exists('json_encode'), 'Enable "json".');
    $add('Session support', function_exists('session_start'), 'Enable "session".');
    if (!is_dir(STORAGE)) {
        @mkdir(STORAGE, 0775, true);
    }
    $add('storage/ folder is writable', is_dir(STORAGE) && is_writable(STORAGE), 'Set the permission of the "storage" folder to 755 (or 775) in cPanel File Manager.');
    $add('SQLite available (zero-setup database)', extension_loaded('pdo_sqlite'), 'Optional: without it you must use MySQL.', false);
    $add('MySQL (PDO) available', extension_loaded('pdo_mysql'), 'Optional: only needed if you choose MySQL.', false);
    $add('ZipArchive (for future updates)', class_exists('ZipArchive'), 'Optional.', false);
    return $r;
}

function inst_requirements_ok($reqs)
{
    foreach ($reqs as $q) {
        if ($q['fatal'] && !$q['ok']) {
            return false;
        }
    }
    return true;
}

function inst_schema(PDO $pdo, $type)
{
    $mysql = ($type === 'mysql');
    $pk = $mysql ? 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $txt = $mysql ? 'LONGTEXT' : 'TEXT';
    $tail = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id $pk,
        username VARCHAR(60) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at VARCHAR(25) NOT NULL
    )$tail");
    $pdo->exec("CREATE TABLE IF NOT EXISTS drafts (
        id $pk,
        user_id INT NOT NULL,
        doc_id VARCHAR(60) NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '',
        data $txt NOT NULL,
        seed BIGINT NOT NULL DEFAULT 1,
        created_at VARCHAR(25) NOT NULL,
        updated_at VARCHAR(25) NOT NULL
    )$tail");
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        k VARCHAR(64) NOT NULL PRIMARY KEY,
        v $txt
    )$tail");
    if ($mysql) {
        try { $pdo->exec('CREATE INDEX idx_drafts_user ON drafts (user_id, updated_at)'); } catch (Exception $e) {}
    } else {
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts (user_id, updated_at)');
    }
}

/** Open a PDO for the given db options. Throws on failure. */
function inst_connect(array $db)
{
    if ($db['type'] === 'mysql') {
        $dsn = 'mysql:host=' . $db['host'] . ';port=' . ($db['port'] ?: 3306) . ';dbname=' . $db['name'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [PDO::ATTR_TIMEOUT => 8]);
    } else {
        $pdo = new PDO('sqlite:' . STORAGE . '/' . $db['file']);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $pdo;
}

function inst_test_db(array $db)
{
    try {
        inst_connect($db);
        return null;
    } catch (Exception $e) {
        return $e->getMessage();
    }
}

/**
 * $o = [db => [type,host,port,name,user,pass], site_title, require_login(0/1),
 *       admin_user, admin_name, admin_pass]
 * Returns null on success or an error string.
 */
function inst_run(array $o)
{
    if (is_file(STORAGE . '/installed.lock')) {
        return 'Already installed. Delete storage/installed.lock and storage/config.php to reinstall.';
    }
    $user = trim($o['admin_user'] ?? '');
    $pass = (string)($o['admin_pass'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_.@-]{3,60}$/', $user)) {
        return 'Admin username must be 3–60 characters: letters, numbers, . _ @ -';
    }
    if (strlen($pass) < 8) {
        return 'Admin password must be at least 8 characters.';
    }
    if (!is_dir(STORAGE) && !@mkdir(STORAGE, 0775, true)) {
        return 'Cannot create the storage folder.';
    }
    if (!is_writable(STORAGE)) {
        return 'The storage folder is not writable. Set its permission to 755/775.';
    }
    $db = $o['db'];
    if ($db['type'] === 'sqlite') {
        $db['file'] = 'dd_' . bin2hex(random_bytes(8)) . '.sqlite';
    }
    try {
        $pdo = inst_connect($db);
        inst_schema($pdo, $db['type']);
        $st = $pdo->prepare('INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?,?,?,?,?)');
        $st->execute([$user, trim($o['admin_name'] ?? '') ?: $user, password_hash($pass, PASSWORD_DEFAULT), 'admin', date('Y-m-d H:i:s')]);
        $set = $pdo->prepare('INSERT INTO settings (k, v) VALUES (?, ?)');
        $set->execute(['site_title', trim($o['site_title'] ?? '') ?: 'Dynamic Documents']);
        $set->execute(['require_login', !empty($o['require_login']) ? '1' : '0']);
        $set->execute(['installed_version', APP_VERSION]);
    } catch (Exception $e) {
        if ($db['type'] === 'sqlite' && !empty($db['file'])) {
            @unlink(STORAGE . '/' . $db['file']);
        }
        return 'Database error: ' . $e->getMessage();
    }
    $conf = [
        'db' => $db['type'] === 'mysql'
            ? ['type' => 'mysql', 'host' => $db['host'], 'port' => (int)($db['port'] ?: 3306), 'name' => $db['name'], 'user' => $db['user'], 'pass' => $db['pass']]
            : ['type' => 'sqlite', 'file' => $db['file']],
        'app_key' => bin2hex(random_bytes(16)),
        'installed_at' => date('c'),
    ];
    $php = "<?php\n// Generated by the installer. Do not share this file.\nreturn " . var_export($conf, true) . ";\n";
    if (@file_put_contents(STORAGE . '/config.php', $php, LOCK_EX) === false) {
        return 'Could not write storage/config.php.';
    }
    @chmod(STORAGE . '/config.php', 0640);
    @mkdir(STORAGE . '/definitions', 0775, true);
    @file_put_contents(STORAGE . '/installed.lock', date('c') . "\n" . APP_VERSION . "\n");
    return null;
}

function inst_rrmdir($dir)
{
    if (!is_dir($dir)) {
        return;
    }
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        $p = $dir . '/' . $f;
        is_dir($p) && !is_link($p) ? inst_rrmdir($p) : @unlink($p);
    }
    @rmdir($dir);
}
