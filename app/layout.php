<?php
/** Shared page chrome. */
function layout_head($title, $opts = [])
{
    $bodyClass = $opts['body'] ?? '';
    $extraHead = $opts['head'] ?? '';
    $nav = $opts['nav'] ?? true;
    $u = current_user();
    $lang = 'bn';
    ?>
<!DOCTYPE html>
<html lang="<?= $lang ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="<?= e(csrf_token()) ?>">
<title><?= e($title) ?> · <?= e(site_title()) ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/app.css')) ?>?v=<?= e(APP_VERSION) ?>">
<?= $extraHead ?>
</head>
<body class="<?= e($bodyClass) ?>">
<?php if ($nav): ?>
<nav class="navbar navbar-expand navbar-dark dd-nav no-print">
  <div class="container-fluid px-3">
    <a class="navbar-brand fw-bold" href="<?= e(url('')) ?>"><i class="fas fa-file-signature me-2"></i><?= e(site_title()) ?></a>
    <div class="navbar-nav ms-auto align-items-center gap-1">
      <a class="nav-link" href="<?= e(url('')) ?>"><i class="fas fa-th-large"></i> <span class="d-none d-md-inline">Documents</span></a>
      <?php if ($u): ?>
        <a class="nav-link" href="<?= e(url('drafts.php')) ?>"><i class="fas fa-folder-open"></i> <span class="d-none d-md-inline">My drafts</span></a>
        <?php if ($u['role'] === 'admin'): ?><a class="nav-link" href="<?= e(url('admin/')) ?>"><i class="fas fa-cog"></i> <span class="d-none d-md-inline">Admin</span></a><?php endif; ?>
        <a class="nav-link" href="<?= e(url('login.php?logout=1')) ?>"><i class="fas fa-sign-out-alt"></i> <span class="d-none d-md-inline"><?= e($u['name'] ?: $u['username']) ?></span></a>
      <?php else: ?>
        <a class="nav-link" href="<?= e(url('login.php')) ?>"><i class="fas fa-sign-in-alt"></i> <span class="d-none d-md-inline">Login</span></a>
      <?php endif; ?>
    </div>
  </div>
</nav>
<?php endif;
}

function layout_foot($extra = '')
{
    ?>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<?= $extra ?>
</body>
</html>
<?php
}
