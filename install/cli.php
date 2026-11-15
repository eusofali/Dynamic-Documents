<?php
/**
 * Unattended installer for SSH / automation.
 *
 *   php install/cli.php --admin-user=admin --admin-pass='S3cret-pass' \
 *       [--title="My Documents"] [--require-login=0] \
 *       [--db=sqlite | --db=mysql --db-host=localhost --db-name=x --db-user=y --db-pass=z]
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
define('DD_INSTALLER', true);
define('APP_ROOT', dirname(__DIR__));
require APP_ROOT . '/app/bootstrap.php';
require __DIR__ . '/lib.php';

$o = [];
foreach (array_slice($argv, 1) as $a) {
    if (preg_match('/^--([a-z-]+)=(.*)$/s', $a, $m)) {
        $o[$m[1]] = $m[2];
    }
}
$type = ($o['db'] ?? 'sqlite') === 'mysql' ? 'mysql' : 'sqlite';
$err = inst_run([
    'db' => ['type' => $type, 'host' => $o['db-host'] ?? 'localhost', 'port' => (int)($o['db-port'] ?? 3306), 'name' => $o['db-name'] ?? '', 'user' => $o['db-user'] ?? '', 'pass' => $o['db-pass'] ?? ''],
    'site_title' => $o['title'] ?? 'Dynamic Documents',
    'require_login' => ($o['require-login'] ?? '0') === '1',
    'admin_user' => $o['admin-user'] ?? '',
    'admin_name' => $o['admin-name'] ?? '',
    'admin_pass' => $o['admin-pass'] ?? '',
]);
if ($err) {
    fwrite(STDERR, "Install failed: $err\n");
    exit(1);
}
echo "Installed Dynamic Documents " . APP_VERSION . " (" . $type . "). You can now delete the install/ folder.\n";
