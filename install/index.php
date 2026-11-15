<?php
define('DD_INSTALLER', true);
define('APP_ROOT', dirname(__DIR__));
require APP_ROOT . '/app/bootstrap.php';
require __DIR__ . '/lib.php';

$installed = is_installed();
$step = (int)($_GET['step'] ?? 1);
$errors = [];
$w = $_SESSION['wiz'] ?? ['db' => ['type' => 'sqlite', 'host' => 'localhost', 'port' => 3306, 'name' => '', 'user' => '', 'pass' => ''], 'site_title' => 'Dynamic Documents', 'require_login' => 0, 'admin_user' => 'admin', 'admin_name' => ''];

// After a successful install, only the "finish" page (for the same browser session) is available.
if ($installed && empty($_SESSION['wiz_done'])) {
    $step = 0;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$installed || ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_SESSION['wiz_done']))) {
    csrf_require();
    $act = $_POST['act'] ?? '';
    if ($act === 'delete_installer' && !empty($_SESSION['wiz_done'])) {
        inst_rrmdir(__DIR__);
        unset($_SESSION['wiz_done']);
        redirect(url(''));
    }
    if ($act === 'requirements') {
        redirect('?step=2');
    }
    if ($act === 'db') {
        $db = ['type' => ($_POST['type'] ?? '') === 'mysql' ? 'mysql' : 'sqlite', 'host' => trim($_POST['host'] ?? 'localhost'), 'port' => (int)($_POST['port'] ?? 3306), 'name' => trim($_POST['name'] ?? ''), 'user' => trim($_POST['user'] ?? ''), 'pass' => (string)($_POST['pass'] ?? '')];
        $w['db'] = $db;
        if ($db['type'] === 'sqlite') {
            if (!extension_loaded('pdo_sqlite')) {
                $errors[] = 'pdo_sqlite is not enabled on this server. Choose MySQL instead.';
            } else {
                $probe = $db + ['file' => 'probe_' . bin2hex(random_bytes(4)) . '.sqlite'];
                $e = inst_test_db($probe);
                @unlink(STORAGE . '/' . $probe['file']);
                if ($e) { $errors[] = $e; }
            }
        } else {
            if ($db['name'] === '' || $db['user'] === '') {
                $errors[] = 'Database name and user are required.';
            } elseif (!extension_loaded('pdo_mysql')) {
                $errors[] = 'pdo_mysql is not enabled on this server.';
            } else {
                $e = inst_test_db($db);
                if ($e) { $errors[] = 'Could not connect: ' . $e; }
            }
        }
        $_SESSION['wiz'] = $w;
        if (!$errors) {
            redirect('?step=3');
        }
        $step = 2;
    }
    if ($act === 'install') {
        $w['site_title'] = trim($_POST['site_title'] ?? '') ?: 'Dynamic Documents';
        $w['require_login'] = !empty($_POST['require_login']) ? 1 : 0;
        $w['admin_user'] = trim($_POST['admin_user'] ?? '');
        $w['admin_name'] = trim($_POST['admin_name'] ?? '');
        $_SESSION['wiz'] = $w;
        $p1 = (string)($_POST['admin_pass'] ?? '');
        if ($p1 !== (string)($_POST['admin_pass2'] ?? '')) {
            $errors[] = 'Passwords do not match.';
        } else {
            $err = inst_run($w + ['admin_pass' => $p1]);
            if ($err) {
                $errors[] = $err;
            } else {
                $_SESSION['wiz_done'] = true;
                unset($_SESSION['wiz']);
                redirect('?step=4');
            }
        }
        $step = 3;
    }
}
if ($installed && !empty($_SESSION['wiz_done'])) {
    $step = 4;
}
$reqs = inst_requirements();
$reqOk = inst_requirements_ok($reqs);
if ($step === 2 && !$reqOk) { $step = 1; }
if ($step === 3 && $_SERVER['REQUEST_METHOD'] !== 'POST' && empty($_SESSION['wiz'])) { $step = 2; }
$titles = [1 => 'Requirements', 2 => 'Database', 3 => 'Site & Admin', 4 => 'Done'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install · Dynamic Documents</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>body{background:#eef2f7}.wiz{max-width:720px}.steps .badge{width:2rem;height:2rem;line-height:1.5rem;border-radius:50%}.steps .on{background:#0d6efd}.steps .off{background:#adb5bd}</style>
</head>
<body>
<div class="container wiz py-5">
  <div class="text-center mb-4">
    <h1 class="h3 fw-bold"><i class="fas fa-file-signature text-primary"></i> Dynamic Documents</h1>
    <div class="text-muted">Setup wizard · v<?= e(APP_VERSION) ?></div>
  </div>

<?php if ($step === 0): ?>
  <div class="card shadow-sm"><div class="card-body text-center p-5">
    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
    <h2 class="h4">Already installed</h2>
    <p class="text-muted">To reinstall, delete <code>storage/installed.lock</code> and <code>storage/config.php</code> via File Manager, then reload this page.</p>
    <a class="btn btn-primary" href="<?= e(url('')) ?>">Open the app</a>
  </div></div>
<?php else: ?>
  <div class="steps d-flex justify-content-center gap-4 mb-4">
    <?php foreach ($titles as $n => $t): ?>
      <div class="text-center"><span class="badge <?= $n <= $step ? 'on' : 'off' ?>"><?= $n ?></span><div class="small mt-1 <?= $n === $step ? 'fw-bold' : 'text-muted' ?>"><?= e($t) ?></div></div>
    <?php endforeach; ?>
  </div>
  <?php foreach ($errors as $er): ?><div class="alert alert-danger"><?= e($er) ?></div><?php endforeach; ?>

  <?php if ($step === 1): ?>
  <div class="card shadow-sm"><div class="card-header fw-bold">1 · Server requirements</div>
    <ul class="list-group list-group-flush">
      <?php foreach ($reqs as $q): ?>
      <li class="list-group-item d-flex gap-3">
        <?php if ($q['ok']): ?><i class="fas fa-check-circle text-success mt-1"></i>
        <?php elseif ($q['fatal']): ?><i class="fas fa-times-circle text-danger mt-1"></i>
        <?php else: ?><i class="fas fa-minus-circle text-secondary mt-1"></i><?php endif; ?>
        <div><?= e($q['label']) ?><?php if (!$q['ok'] && $q['hint']): ?><div class="small text-muted"><?= e($q['hint']) ?></div><?php endif; ?></div>
      </li>
      <?php endforeach; ?>
    </ul>
    <div class="card-body text-end">
      <?php if ($reqOk): ?>
        <form method="post" action="?step=1"><input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="requirements">
          <button class="btn btn-primary">Continue <i class="fas fa-arrow-right"></i></button></form>
      <?php else: ?>
        <div class="text-danger small mb-2">Fix the red items, then reload this page.</div><a class="btn btn-outline-primary" href="?step=1">Re-check</a>
      <?php endif; ?>
    </div>
  </div>

  <?php elseif ($step === 2): $d = $w['db']; ?>
  <form method="post" action="?step=2" class="card shadow-sm">
    <div class="card-header fw-bold">2 · Database</div>
    <div class="card-body">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="db">
      <div class="form-check mb-2"><input class="form-check-input" type="radio" name="type" id="t1" value="sqlite" <?= $d['type'] !== 'mysql' ? 'checked' : '' ?> onchange="tg()">
        <label class="form-check-label" for="t1"><strong>SQLite</strong> <span class="badge bg-success">recommended</span><div class="small text-muted">Zero setup – the database is a single protected file inside <code>storage/</code>.</div></label></div>
      <div class="form-check mb-3"><input class="form-check-input" type="radio" name="type" id="t2" value="mysql" <?= $d['type'] === 'mysql' ? 'checked' : '' ?> onchange="tg()">
        <label class="form-check-label" for="t2"><strong>MySQL / MariaDB</strong><div class="small text-muted">Create a database and user first in cPanel → "MySQL® Database Wizard", then enter them below.</div></label></div>
      <div id="my" class="row g-3 border rounded p-3 bg-light">
        <div class="col-md-8"><label class="form-label">Host</label><input class="form-control" name="host" value="<?= e($d['host']) ?>"></div>
        <div class="col-md-4"><label class="form-label">Port</label><input class="form-control" name="port" value="<?= e($d['port']) ?>"></div>
        <div class="col-md-12"><label class="form-label">Database name</label><input class="form-control" name="name" value="<?= e($d['name']) ?>" placeholder="cpuser_docs"></div>
        <div class="col-md-6"><label class="form-label">User</label><input class="form-control" name="user" value="<?= e($d['user']) ?>" placeholder="cpuser_docs"></div>
        <div class="col-md-6"><label class="form-label">Password</label><input class="form-control" type="password" name="pass" autocomplete="new-password"></div>
      </div>
    </div>
    <div class="card-footer d-flex justify-content-between"><a class="btn btn-outline-secondary" href="?step=1"><i class="fas fa-arrow-left"></i> Back</a><button class="btn btn-primary">Test &amp; continue <i class="fas fa-arrow-right"></i></button></div>
  </form>
  <script>function tg(){document.getElementById('my').style.display=document.getElementById('t2').checked?'flex':'none'}tg()</script>

  <?php elseif ($step === 3): ?>
  <form method="post" action="?step=3" class="card shadow-sm">
    <div class="card-header fw-bold">3 · Site &amp; administrator</div>
    <div class="card-body row g-3">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="install">
      <div class="col-12"><label class="form-label">Site title</label><input class="form-control" name="site_title" value="<?= e($w['site_title']) ?>" required></div>
      <div class="col-md-6"><label class="form-label">Admin username</label><input class="form-control" name="admin_user" value="<?= e($w['admin_user']) ?>" required autocomplete="username"></div>
      <div class="col-md-6"><label class="form-label">Your name</label><input class="form-control" name="admin_name" value="<?= e($w['admin_name']) ?>"></div>
      <div class="col-md-6"><label class="form-label">Password <small class="text-muted">(min 8)</small></label><input class="form-control" type="password" name="admin_pass" minlength="8" required autocomplete="new-password"></div>
      <div class="col-md-6"><label class="form-label">Repeat password</label><input class="form-control" type="password" name="admin_pass2" minlength="8" required autocomplete="new-password"></div>
      <div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="require_login" id="rl" value="1" <?= $w['require_login'] ? 'checked' : '' ?>>
        <label class="form-check-label" for="rl">Require login to use the document generators<div class="small text-muted">Off = anyone with the link can generate documents (only the admin area and saved drafts need login).</div></label></div></div>
    </div>
    <div class="card-footer d-flex justify-content-between"><a class="btn btn-outline-secondary" href="?step=2"><i class="fas fa-arrow-left"></i> Back</a><button class="btn btn-success"><i class="fas fa-rocket"></i> Install</button></div>
  </form>

  <?php elseif ($step === 4): ?>
  <div class="card shadow-sm"><div class="card-body text-center p-5">
    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
    <h2 class="h4">Installation complete 🎉</h2>
    <p class="text-muted">For security, delete the installer now. (It already refuses to run again, but there's no reason to keep it.)</p>
    <form method="post" action="?step=4" class="d-inline"><input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="delete_installer">
      <button class="btn btn-danger"><i class="fas fa-trash"></i> Delete installer &amp; open app</button></form>
    <a class="btn btn-outline-primary" href="<?= e(url('login.php')) ?>">Log in first</a>
  </div></div>
  <?php endif; ?>
<?php endif; ?>
</div>
</body>
</html>
