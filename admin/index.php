<?php
require dirname(__DIR__) . '/app/bootstrap.php';
require dirname(__DIR__) . '/app/definitions.php';
require dirname(__DIR__) . '/app/layout.php';
require_admin();
$me = current_user();
$flash = ['ok' => [], 'err' => []];
$tab = $_GET['tab'] ?? 'docs';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_require();
    $act = $_POST['act'] ?? '';
    if ($act === 'settings') {
        set_setting('site_title', trim($_POST['site_title'] ?? '') ?: 'Dynamic Documents');
        set_setting('require_login', !empty($_POST['require_login']) ? '1' : '0');
        $flash['ok'][] = 'Settings saved.';
        $tab = 'settings';
    } elseif ($act === 'import') {
        $d = json_decode((string)($_POST['json'] ?? ''), true);
        $id = trim((string)($_POST['id'] ?? ''));
        if (!$id && is_array($d) && !empty($d['id'])) { $id = (string)$d['id']; }
        $err = def_save($id, $d);
        $err ? $flash['err'][] = $err : $flash['ok'][] = 'Imported "' . $id . '".';
        $tab = 'docs';
    } elseif ($act === 'add_user') {
        $un = trim($_POST['username'] ?? '');
        $pw = (string)($_POST['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_.@-]{3,60}$/', $un)) {
            $flash['err'][] = 'Username: 3–60 characters (letters, numbers, . _ @ -).';
        } elseif (strlen($pw) < 8) {
            $flash['err'][] = 'Password must be at least 8 characters.';
        } else {
            try {
                $st = db()->prepare('INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?,?,?,?,?)');
                $st->execute([$un, trim($_POST['name'] ?? '') ?: $un, password_hash($pw, PASSWORD_DEFAULT), ($_POST['role'] ?? '') === 'admin' ? 'admin' : 'user', date('Y-m-d H:i:s')]);
                $flash['ok'][] = 'User created.';
            } catch (Exception $ex) {
                $flash['err'][] = 'Could not create user (username may already exist).';
            }
        }
        $tab = 'users';
    } elseif ($act === 'del_user') {
        $uid = (int)($_POST['id'] ?? 0);
        if ($uid === $me['id']) {
            $flash['err'][] = 'You cannot delete your own account.';
        } else {
            db()->prepare('DELETE FROM drafts WHERE user_id = ?')->execute([$uid]);
            db()->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
            $flash['ok'][] = 'User deleted.';
        }
        $tab = 'users';
    } elseif ($act === 'passwd') {
        $pw = (string)($_POST['password'] ?? '');
        if (strlen($pw) < 8) {
            $flash['err'][] = 'Password must be at least 8 characters.';
        } else {
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), (int)($_POST['id'] ?? 0)]);
            $flash['ok'][] = 'Password updated.';
        }
        $tab = 'users';
    }
}

$docs = def_list();
$users = db()->query('SELECT id, username, name, role, created_at FROM users ORDER BY id')->fetchAll();
$dbType = cfg('db')['type'] ?? '?';
$sys = [
    'App version' => APP_VERSION,
    'PHP' => PHP_VERSION,
    'Database' => $dbType,
    'storage/ writable' => is_writable(STORAGE) ? 'yes' : 'NO – builder cannot save',
    'install/ folder' => is_dir(APP_ROOT . '/install') ? 'STILL PRESENT – delete it' : 'removed',
];
layout_head('Admin');
?>
<div class="container py-4">
  <h1 class="h4 mb-3"><i class="fas fa-cog text-primary"></i> Admin</h1>
  <?php foreach ($flash['ok'] as $m): ?><div class="alert alert-success py-2"><?= e($m) ?></div><?php endforeach; ?>
  <?php foreach ($flash['err'] as $m): ?><div class="alert alert-danger py-2"><?= e($m) ?></div><?php endforeach; ?>
  <?php if (is_dir(APP_ROOT . '/install')): ?><div class="alert alert-warning py-2"><i class="fas fa-exclamation-triangle"></i> The <code>install/</code> folder is still on the server. Delete it via File Manager.</div><?php endif; ?>

  <ul class="nav nav-tabs mb-3">
    <?php foreach (['docs' => 'Documents', 'settings' => 'Settings', 'users' => 'Users', 'system' => 'System'] as $k => $t): ?>
      <li class="nav-item"><a class="nav-link <?= $tab === $k ? 'active' : '' ?>" href="?tab=<?= $k ?>"><?= $t ?></a></li>
    <?php endforeach; ?>
  </ul>

  <?php if ($tab === 'docs'): ?>
  <div class="d-flex gap-2 mb-3">
    <a class="btn btn-primary" href="builder.php?new=1"><i class="fas fa-plus"></i> New document</a>
    <button class="btn btn-outline-secondary" data-bs-toggle="collapse" data-bs-target="#imp"><i class="fas fa-file-import"></i> Import JSON</button>
  </div>
  <div class="collapse mb-3" id="imp"><form method="post" class="card card-body">
    <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="import">
    <div class="row g-2"><div class="col-md-4"><input class="form-control" name="id" placeholder="id (optional if inside JSON)"></div></div>
    <textarea class="form-control mono mt-2" rows="8" name="json" placeholder='{"title":"…","fields":[…],"pages":[…]}' required></textarea>
    <div class="mt-2"><button class="btn btn-success">Import</button></div></form></div>
  <div class="table-responsive"><table class="table table-hover align-middle bg-white shadow-sm">
    <thead><tr><th>Document</th><th>Category</th><th>Source</th><th class="text-end">Actions</th></tr></thead><tbody>
    <?php foreach ($docs as $d): ?>
      <tr><td><i class="fas <?= e($d['icon']) ?> text-primary me-2"></i><strong><?= e($d['title']) ?></strong><div class="small text-muted"><?= e($d['id']) ?></div></td>
        <td><?= e($d['category']) ?></td>
        <td><?= $d['source'] === 'custom' ? '<span class="badge bg-info text-dark">' . ($d['overrides'] ? 'edited' : 'custom') . '</span>' : '<span class="badge bg-secondary">bundled</span>' ?></td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-primary" href="../doc.php?d=<?= e($d['id']) ?>" target="_blank" title="Open"><i class="fas fa-external-link-alt"></i></a>
          <a class="btn btn-sm btn-outline-secondary" href="../api.php?a=export&id=<?= e($d['id']) ?>" title="Export JSON"><i class="fas fa-download"></i></a>
          <a class="btn btn-sm btn-primary" href="builder.php?id=<?= e($d['id']) ?>"><i class="fas fa-pen"></i> Edit</a>
          <a class="btn btn-sm btn-outline-secondary" href="builder.php?id=<?= e($d['id']) ?>&copy=1" title="Duplicate"><i class="fas fa-copy"></i></a>
          <?php if ($d['source'] === 'custom'): ?><button class="btn btn-sm btn-outline-danger" onclick="delDoc('<?= e($d['id']) ?>', <?= $d['overrides'] ? 'true' : 'false' ?>)" title="<?= $d['overrides'] ? 'Revert to bundled' : 'Delete' ?>"><i class="fas fa-<?= $d['overrides'] ? 'undo' : 'trash' ?>"></i></button><?php endif; ?>
        </td></tr>
    <?php endforeach; ?></tbody></table></div>
  <script>
  function delDoc(id, reverts){
    if(!confirm(reverts?'Revert "'+id+'" to the bundled version? Your edits will be lost.':'Delete "'+id+'" permanently?'))return;
    fetch('../api.php?a=def_delete',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':document.querySelector('meta[name=csrf-token]').content},body:JSON.stringify({id:id})})
     .then(r=>r.json()).then(j=>{ j.ok?location.reload():alert(j.error||'Failed'); });
  }
  </script>

  <?php elseif ($tab === 'settings'): ?>
  <form method="post" class="card card-body" style="max-width:560px">
    <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="settings">
    <div class="mb-3"><label class="form-label">Site title</label><input class="form-control" name="site_title" value="<?= e(site_title()) ?>"></div>
    <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" name="require_login" id="rl" value="1" <?= setting('require_login', '0') === '1' ? 'checked' : '' ?>><label class="form-check-label" for="rl">Require login to use the generators</label></div>
    <button class="btn btn-primary align-self-start">Save</button>
  </form>

  <?php elseif ($tab === 'users'): ?>
  <div class="row g-3"><div class="col-lg-7"><div class="table-responsive"><table class="table align-middle bg-white shadow-sm">
    <thead><tr><th>User</th><th>Role</th><th class="text-end">Actions</th></tr></thead><tbody>
    <?php foreach ($users as $u): ?><tr>
      <td><strong><?= e($u['username']) ?></strong><div class="small text-muted"><?= e($u['name']) ?></div></td><td><?= e($u['role']) ?></td>
      <td class="text-end"><form method="post" class="d-inline-flex gap-1"><input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="id" value="<?= (int)$u['id'] ?>">
        <input type="password" name="password" class="form-control form-control-sm" style="width:130px" placeholder="new password" minlength="8">
        <button name="act" value="passwd" class="btn btn-sm btn-outline-primary">Set</button>
        <?php if ((int)$u['id'] !== $me['id']): ?><button name="act" value="del_user" class="btn btn-sm btn-outline-danger" onclick="return confirm('Delete this user and their drafts?')"><i class="fas fa-trash"></i></button><?php endif; ?></form></td></tr>
    <?php endforeach; ?></tbody></table></div></div>
    <div class="col-lg-5"><form method="post" class="card card-body"><h2 class="h6">Add user</h2>
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="add_user">
      <input class="form-control mb-2" name="username" placeholder="username" required><input class="form-control mb-2" name="name" placeholder="display name">
      <input class="form-control mb-2" type="password" name="password" placeholder="password (min 8)" minlength="8" required>
      <select class="form-select mb-2" name="role"><option value="user">User (can save drafts)</option><option value="admin">Admin</option></select>
      <button class="btn btn-success">Create</button></form></div></div>

  <?php else: ?>
  <table class="table bg-white shadow-sm" style="max-width:560px"><tbody>
    <?php foreach ($sys as $k => $v): ?><tr><th><?= e($k) ?></th><td><?= e($v) ?></td></tr><?php endforeach; ?></tbody></table>
  <p class="text-muted small">To update: upload the new release zip over the app folder (File Manager → Extract). <code>storage/</code> (database, config, your custom documents) is never overwritten by the release.</p>
  <?php endif; ?>
</div>
<?php layout_foot();
