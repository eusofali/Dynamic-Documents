<?php
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    redirect(url('login.php'));
}
$error = '';
$next = safe_next($_GET['next'] ?? ($_POST['next'] ?? ''));
if (current_user() && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect($next);
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_require();
    $_SESSION['fails'] = (int)($_SESSION['fails'] ?? 0);
    if ($_SESSION['fails'] >= 5) {
        usleep(1500000);
    }
    if (attempt_login($_POST['username'] ?? '', (string)($_POST['password'] ?? ''))) {
        $_SESSION['fails'] = 0;
        redirect($next);
    }
    $_SESSION['fails']++;
    usleep(600000);
    $error = 'Wrong username or password.';
}
layout_head('Login');
?>
<div class="container py-5" style="max-width:420px">
  <div class="card shadow-sm"><div class="card-body p-4">
    <h1 class="h4 mb-3"><i class="fas fa-lock text-primary"></i> Login</h1>
    <?php if ($error): ?><div class="alert alert-danger py-2"><?= e($error) ?></div><?php endif; ?>
    <form method="post">
      <input type="hidden" name="_csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="next" value="<?= e($next) ?>">
      <div class="mb-3"><label class="form-label">Username</label><input class="form-control" name="username" autofocus required autocomplete="username"></div>
      <div class="mb-3"><label class="form-label">Password</label><input class="form-control" type="password" name="password" required autocomplete="current-password"></div>
      <button class="btn btn-primary w-100">Sign in</button>
    </form>
  </div></div>
</div>
<?php layout_foot();
