<?php
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/definitions.php';
require __DIR__ . '/app/layout.php';
require_user();
$u = current_user();
$st = db()->prepare('SELECT id, doc_id, title, updated_at FROM drafts WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 200');
$st->execute([$u['id']]);
$rows = $st->fetchAll();
$titles = [];
foreach (def_list() as $d) { $titles[$d['id']] = $d['title']; }
layout_head('My drafts');
?>
<div class="container py-4">
  <h1 class="h4 mb-3"><i class="fas fa-folder-open text-primary"></i> My drafts</h1>
  <?php if (!$rows): ?><div class="alert alert-info">No saved drafts yet. Open a document and press <strong>Save</strong>.</div><?php endif; ?>
  <div class="list-group shadow-sm">
    <?php foreach ($rows as $r): ?>
    <div class="list-group-item d-flex align-items-center gap-3" id="d<?= (int)$r['id'] ?>">
      <div class="flex-grow-1">
        <a class="fw-bold text-decoration-none" href="<?= e(url('doc.php?d=' . $r['doc_id'] . '&draft=' . $r['id'])) ?>"><?= e($r['title'] ?: '(untitled)') ?></a>
        <div class="small text-muted"><?= e($titles[$r['doc_id']] ?? $r['doc_id']) ?> · <?= e($r['updated_at']) ?></div>
      </div>
      <button class="btn btn-sm btn-outline-danger" onclick="del(<?= (int)$r['id'] ?>)"><i class="fas fa-trash"></i></button>
    </div>
    <?php endforeach; ?>
  </div>
</div>
<script>
function del(id){
  if(!confirm('Delete this draft?'))return;
  fetch('<?= e(url('api.php?a=draft_delete')) ?>',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':document.querySelector('meta[name=csrf-token]').content},body:JSON.stringify({id:id})})
   .then(r=>r.json()).then(j=>{ if(j.ok) document.getElementById('d'+id).remove(); else alert(j.error||'Failed'); });
}
</script>
<?php layout_foot();
