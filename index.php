<?php
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/definitions.php';
require __DIR__ . '/app/layout.php';
gate_public();

$docs = def_list();
$cats = [];
foreach ($docs as $d) {
    $cats[$d['category']][] = $d;
}
layout_head('Documents');
?>
<div class="container py-4">
  <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
    <div><h1 class="h3 mb-0">কী ডকুমেন্ট তৈরি করবেন?</h1><div class="text-muted">একটি ডকুমেন্ট বেছে নিন – শুধু প্রয়োজনীয় তথ্য লিখুন, বাকি কাজ স্বয়ংক্রিয়।</div></div>
    <div class="ms-auto" style="min-width:260px"><input id="q" class="form-control" type="search" placeholder="Search documents…"></div>
  </div>
  <?php if (!$docs): ?><div class="alert alert-warning">No documents yet.<?= is_admin() ? ' <a href="' . e(url('admin/')) . '">Add one in Admin</a>.' : '' ?></div><?php endif; ?>
  <?php foreach ($cats as $cat => $list): ?>
    <h2 class="h6 text-uppercase text-muted fw-bold mt-4 mb-3 cat"><?= e($cat) ?></h2>
    <div class="row g-3 cat-row">
      <?php foreach ($list as $d): ?>
      <div class="col-md-6 col-lg-4 doc-card" data-t="<?= e(mb_strtolower($d['title'] . ' ' . $d['title_en'] . ' ' . $d['description'] . ' ' . $cat)) ?>">
        <a class="card h-100 shadow-sm text-decoration-none dd-card" href="<?= e(url('doc.php?d=' . $d['id'])) ?>">
          <div class="card-body d-flex gap-3">
            <div class="dd-ico"><i class="fas <?= e($d['icon']) ?>"></i></div>
            <div><div class="fw-bold text-body"><?= e($d['title']) ?></div>
              <?php if ($d['title_en']): ?><div class="small text-primary"><?= e($d['title_en']) ?></div><?php endif; ?>
              <div class="small text-muted mt-1"><?= e($d['description']) ?></div></div>
          </div>
        </a>
      </div>
      <?php endforeach; ?>
    </div>
  <?php endforeach; ?>
</div>
<script>
document.getElementById('q').addEventListener('input', function () {
  var q = this.value.trim().toLowerCase();
  document.querySelectorAll('.doc-card').forEach(function (c) { c.style.display = c.dataset.t.indexOf(q) > -1 ? '' : 'none'; });
  document.querySelectorAll('.cat-row').forEach(function (r) {
    var any = Array.prototype.some.call(r.children, function (c) { return c.style.display !== 'none'; });
    r.style.display = any ? '' : 'none'; r.previousElementSibling.style.display = any ? '' : 'none';
  });
});
</script>
<?php layout_foot();
