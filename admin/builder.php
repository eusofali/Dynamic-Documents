<?php
require dirname(__DIR__) . '/app/bootstrap.php';
require dirname(__DIR__) . '/app/definitions.php';
require dirname(__DIR__) . '/app/layout.php';
require_admin();

$isNew = isset($_GET['new']);
$copy = isset($_GET['copy']);
$id = (string)($_GET['id'] ?? '');
if ($isNew) {
    $def = [
        'title' => 'নতুন ডকুমেন্ট', 'title_en' => '', 'category' => 'Custom', 'icon' => 'fa-file-alt', 'description' => '',
        'page' => ['size' => 'a4', 'marginTop' => '1in', 'margin' => '1in', 'fontSize' => 16, 'lineHeight' => 1.5, 'font' => 'bn'],
        'digits' => 'bn',
        'groups' => [['id' => 'g1', 'title' => 'তথ্য', 'icon' => 'fa-info-circle']],
        'fields' => [
            ['name' => 'name', 'label' => 'নাম', 'type' => 'text', 'col' => 6, 'group' => 'g1', 'required' => true],
            ['name' => 'amount', 'label' => 'টাকার পরিমাণ', 'type' => 'amount', 'col' => 6, 'group' => 'g1'],
            ['name' => 'date', 'label' => 'তারিখ', 'type' => 'date', 'col' => 6, 'group' => 'g1'],
        ],
        'pages' => [['html' => "<h3 class=\"text-center mb-4\"><strong>শিরোনাম</strong></h3>\n<p>আমি <strong>{{name}}</strong>, {পরম করুণাময়ের নামে|সজ্ঞানে} {{amount}}/- ({{amount_words}}) টাকা গ্রহণ করিলাম।</p>\n<p><strong>তারিখ:</strong> {{date}} ইং।</p>"]],
    ];
    $id = '';
} else {
    $def = def_load($id);
    if (!$def) {
        http_response_code(404);
        exit('Document not found.');
    }
    unset($def['_source'], $def['_overrides']);
    if ($copy) {
        $def['title'] .= ' (copy)';
        $id = '';
        $isNew = true;
    }
}
unset($def['id']);
$boot = ['def' => $def, 'letterhead' => letterhead_settings(), 'id' => $id, 'isNew' => $isNew, 'api' => url('api.php'), 'adminUrl' => url('admin/')];
layout_head('Builder', ['nav' => true]);
?>
<div class="container-fluid py-3">
  <div class="row g-3">
    <div class="col-xl-7">
      <div class="d-flex align-items-center gap-2 mb-2">
        <a class="btn btn-sm btn-outline-secondary" href="<?= e(url('admin/')) ?>"><i class="fas fa-arrow-left"></i></a>
        <h1 class="h5 mb-0 flex-grow-1">Document builder</h1>
        <a id="open-live" class="btn btn-sm btn-outline-primary <?= $isNew ? 'disabled' : '' ?>" target="_blank" href="<?= e(url('doc.php?d=' . $id)) ?>"><i class="fas fa-external-link-alt"></i> Open form</a>
        <button id="btn-save" class="btn btn-success"><i class="fas fa-save"></i> Save</button>
      </div>
      <div id="msg"></div>
      <ul class="nav nav-tabs" id="tabs">
        <li class="nav-item"><button class="nav-link active" data-t="info">Info &amp; page</button></li>
        <li class="nav-item"><button class="nav-link" data-t="groups">Sections</button></li>
        <li class="nav-item"><button class="nav-link" data-t="fields">Fields</button></li>
        <li class="nav-item"><button class="nav-link" data-t="pages">Pages (template)</button></li>
        <li class="nav-item"><button class="nav-link" data-t="json">JSON</button></li>
      </ul>
      <div class="bg-white border border-top-0 rounded-bottom p-3" id="panes"></div>
    </div>
    <div class="col-xl-5">
      <div class="builder-preview">
        <div class="d-flex gap-2 mb-2 align-items-center">
          <strong class="small">Live preview (sample data)</strong>
          <button class="btn btn-sm btn-outline-dark ms-auto" id="respin"><i class="fas fa-dice"></i></button>
        </div>
        <div id="preview-zoom"><div id="preview" class="dd-doc"></div></div>
      </div>
    </div>
  </div>
</div>
<style id="page-style"></style><style id="def-style"></style>
<script>window.BD = <?= json_for_script($boot) ?>;</script>
<script src="<?= e(url('assets/js/engine.js')) ?>?v=<?= e(APP_VERSION) ?>"></script>
<script src="<?= e(url('assets/js/builder.js')) ?>?v=<?= e(APP_VERSION) ?>"></script>
<?php layout_foot();
