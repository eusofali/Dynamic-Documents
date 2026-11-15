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
        // business letterhead
        $cut = function ($k, $n) { return mb_substr(trim((string)($_POST[$k] ?? '')), 0, $n); };
        set_setting('lh_name', $cut('lh_name', 120));
        set_setting('lh_tagline', $cut('lh_tagline', 160));
        set_setting('lh_address', $cut('lh_address', 220));
        set_setting('lh_phone', $cut('lh_phone', 80));
        set_setting('lh_email', $cut('lh_email', 120));
        $col = trim((string)($_POST['lh_color'] ?? ''));
        set_setting('lh_color', preg_match('/^#[0-9a-fA-F]{6}$/', $col) ? $col : '#1f3a5f');
        set_setting('lh_layout', ($_POST['lh_layout'] ?? '') === 'left' ? 'left' : 'center');
        $logo = (string)($_POST['lh_logo'] ?? '');
        if ($logo === '' || (strlen($logo) < 400000 && preg_match('#^data:image/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$#', $logo))) {
            set_setting('lh_logo', $logo);
        } else {
            $flash['err'][] = 'Logo was not a valid small image and was ignored.';
        }
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
  <form method="post" class="row g-3" id="settings-form">
    <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="act" value="settings">
    <div class="col-lg-6"><div class="card card-body h-100">
      <h2 class="h6">General</h2>
      <div class="mb-3"><label class="form-label">Site title</label><input class="form-control" name="site_title" value="<?= e(site_title()) ?>"></div>
      <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" name="require_login" id="rl" value="1" <?= setting('require_login', '0') === '1' ? 'checked' : '' ?>><label class="form-check-label" for="rl">Require login to use the generators</label></div>
    </div></div>
    <div class="col-lg-6"><div class="card card-body">
      <h2 class="h6"><i class="fas fa-heading text-primary"></i> Business letterhead <small class="text-muted fw-normal">(printed on application letters &amp; other documents that use it)</small></h2>
      <div class="row g-2">
        <div class="col-12"><label class="form-label small mb-0">Business / shop name</label><input class="form-control" name="lh_name" id="lh_name" value="<?= e(setting('lh_name', '')) ?>" placeholder="e.g. আল-আমিন দলিল লেখক ও কম্পিউটার কম্পোজ"></div>
        <div class="col-12"><label class="form-label small mb-0">Tagline</label><input class="form-control" name="lh_tagline" id="lh_tagline" value="<?= e(setting('lh_tagline', '')) ?>" placeholder="e.g. এফিডেভিট · দলিল · আবেদনপত্র · অনলাইন সেবা"></div>
        <div class="col-12"><label class="form-label small mb-0">Address</label><input class="form-control" name="lh_address" id="lh_address" value="<?= e(setting('lh_address', '')) ?>"></div>
        <div class="col-md-6"><label class="form-label small mb-0">Phone</label><input class="form-control" name="lh_phone" id="lh_phone" value="<?= e(setting('lh_phone', '')) ?>"></div>
        <div class="col-md-6"><label class="form-label small mb-0">Email</label><input class="form-control" name="lh_email" id="lh_email" value="<?= e(setting('lh_email', '')) ?>"></div>
        <div class="col-md-4"><label class="form-label small mb-0">Colour</label><input type="color" class="form-control form-control-color w-100" name="lh_color" id="lh_color" value="<?= e(setting('lh_color', '#1f3a5f')) ?>"></div>
        <div class="col-md-4"><label class="form-label small mb-0">Layout</label><select class="form-select" name="lh_layout" id="lh_layout"><option value="center" <?= setting('lh_layout', 'center') !== 'left' ? 'selected' : '' ?>>Centered</option><option value="left" <?= setting('lh_layout', 'center') === 'left' ? 'selected' : '' ?>>Logo left</option></select></div>
        <div class="col-md-4"><label class="form-label small mb-0">Logo (optional)</label><input type="file" accept="image/*" class="form-control" id="lh_file"></div>
        <input type="hidden" name="lh_logo" id="lh_logo" value="<?= e(setting('lh_logo', '')) ?>">
        <div class="col-12"><button type="button" class="btn btn-sm btn-outline-secondary" id="lh_clear_logo">Remove logo</button></div>
      </div>
      <div class="border rounded mt-3 p-3 bg-white dd-doc" id="lh_preview" style="width:auto;--fs:15px;--lh:1.4"></div>
    </div></div>
    <div class="col-12"><button class="btn btn-primary">Save settings</button></div>
  </form>
  <link rel="stylesheet" href="../assets/css/app.css?v=<?= e(APP_VERSION) ?>">
  <script src="../assets/js/engine.js?v=<?= e(APP_VERSION) ?>"></script>
  <script>
  (function () {
    var $ = function (id) { return document.getElementById(id); };
    function draw() {
      var html = DDEngine.letterheadHtml({ name: $('lh_name').value, tagline: $('lh_tagline').value, address: $('lh_address').value, phone: $('lh_phone').value, email: $('lh_email').value, color: $('lh_color').value, layout: $('lh_layout').value, logo: $('lh_logo').value });
      $('lh_preview').innerHTML = html || '<span class="text-muted small">Fill in the business name to see the letterhead preview.</span>';
    }
    ['lh_name', 'lh_tagline', 'lh_address', 'lh_phone', 'lh_email', 'lh_color', 'lh_layout'].forEach(function (id) { $(id).addEventListener('input', draw); $(id).addEventListener('change', draw); });
    $('lh_clear_logo').addEventListener('click', function () { $('lh_logo').value = ''; $('lh_file').value = ''; draw(); });
    $('lh_file').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var max = 160, r = Math.min(1, max / Math.max(im.width, im.height));
          var c = document.createElement('canvas'); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          $('lh_logo').value = c.toDataURL('image/png'); draw();
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    });
    draw();
  })();
  </script>

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
