<?php
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/definitions.php';
require __DIR__ . '/app/layout.php';
gate_public();

$def = def_load($_GET['d'] ?? '');
if (!$def) {
    http_response_code(404);
    layout_head('Not found');
    echo '<div class="container py-5"><div class="alert alert-warning">Document not found. <a href="' . e(url('')) . '">Back to list</a></div></div>';
    layout_foot();
    exit;
}
unset($def['_source'], $def['_overrides']);

$draft = null;
if (!empty($_GET['draft']) && current_user()) {
    $st = db()->prepare('SELECT id, title, data, seed FROM drafts WHERE id = ? AND user_id = ? AND doc_id = ?');
    $st->execute([(int)$_GET['draft'], current_user()['id'], $def['id']]);
    $r = $st->fetch();
    if ($r) {
        $draft = ['id' => (int)$r['id'], 'title' => $r['title'], 'data' => json_decode($r['data'], true), 'seed' => (int)$r['seed']];
    }
}
$boot = [
    'def' => $def,
    'draft' => $draft,
    'user' => current_user() ? true : false,
    'letterhead' => !empty($def['letterhead']) ? letterhead_settings() : null,
    'assets' => url('assets/vendor/'),
    'api' => url('api.php'),
    'home' => url(''),
    'login' => url('login.php') . '?next=' . rawurlencode($_SERVER['REQUEST_URI'] ?? ''),
];
layout_head($def['title'], ['body' => 'editor-page', 'nav' => false]);
?>
<div class="dd-topbar no-print">
  <a class="btn btn-sm btn-outline-light" href="<?= e(url('')) ?>" title="All documents"><i class="fas fa-arrow-left"></i></a>
  <div class="dd-title text-truncate"><i class="fas <?= e($def['icon'] ?? 'fa-file-alt') ?> me-2"></i><?= e($def['title']) ?></div>
  <div class="ms-auto d-flex gap-1 flex-wrap justify-content-end">
    <?php if (!empty($def['guide'])): ?><button class="btn btn-sm btn-outline-light" id="btn-guide" title="Show a scan of your pre-printed form behind the text to line things up (screen only)"><i class="fas fa-image"></i> <span class="d-none d-xl-inline">Guide</span></button><input type="file" id="guide-file" accept="image/*" hidden><?php endif; ?>
    <?php if (!empty($def['letterhead'])): ?><button class="btn btn-sm btn-outline-light" id="btn-lh" title="Print with your business letterhead"><i class="fas fa-heading"></i> <span class="d-none d-xl-inline">Letterhead</span></button><?php endif; ?>
    <button class="btn btn-sm btn-outline-light" id="btn-respin" title="Re-generate the wording variations"><i class="fas fa-dice"></i> <span class="d-none d-xl-inline">Re-word</span></button>
    <div class="btn-group btn-group-sm">
      <button class="btn btn-outline-light" id="btn-fs-dec" title="Smaller text">A−</button>
      <button class="btn btn-outline-light" id="btn-fs-inc" title="Larger text">A+</button>
    </div>
    <button class="btn btn-sm btn-outline-light" id="btn-reset" title="Clear the form"><i class="fas fa-eraser"></i> <span class="d-none d-xl-inline">Reset</span></button>
    <button class="btn btn-sm btn-info" id="btn-save"><i class="fas fa-save"></i> <span class="d-none d-md-inline">Save</span></button>
    <button class="btn btn-sm btn-primary" id="btn-pdf" title="Download as PDF"><i class="fas fa-file-pdf"></i> <span class="d-none d-md-inline">PDF</span></button>
    <button class="btn btn-sm btn-success" id="btn-print"><i class="fas fa-print"></i> Print</button>
  </div>
</div>
<div class="dd-tabs d-lg-none no-print">
  <button class="active" data-pane="form"><i class="fas fa-pen"></i> Fill</button>
  <button data-pane="preview"><i class="fas fa-eye"></i> Preview</button>
</div>
<div class="dd-split" data-pane="form">
  <aside class="dd-form no-print" id="form"></aside>
  <main class="dd-preview" id="preview-pane">
    <div class="dd-zoom-note no-print" id="zoom-note"></div>
    <div id="preview-zoom"><div id="preview" class="dd-doc"></div></div>
  </main>
</div>
<div id="toast" class="dd-toast no-print"></div>
<style id="page-style"></style>
<style id="def-style"></style>
<script>window.DD = <?= json_for_script($boot) ?>;</script>
<script src="<?= e(url('assets/js/engine.js')) ?>?v=<?= e(APP_VERSION) ?>"></script>
<script src="<?= e(url('assets/js/pdf.js')) ?>?v=<?= e(APP_VERSION) ?>"></script>
<script src="<?= e(url('assets/js/editor.js')) ?>?v=<?= e(APP_VERSION) ?>"></script>
<?php layout_foot();
