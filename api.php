<?php
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/definitions.php';

$a = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = [];
if ($method === 'POST') {
    csrf_require();
    $raw = file_get_contents('php://input');
    $body = json_decode((string)$raw, true);
    if (!is_array($body)) {
        $body = $_POST;
    }
}

function need_user()
{
    $u = current_user();
    if (!$u) {
        json_out(['error' => 'Login required.'], 401);
    }
    return $u;
}
function need_admin()
{
    $u = need_user();
    if ($u['role'] !== 'admin') {
        json_out(['error' => 'Admin only.'], 403);
    }
    return $u;
}
function public_gate()
{
    if (setting('require_login', '0') === '1' && !current_user()) {
        json_out(['error' => 'Login required.'], 401);
    }
}

try {
    switch ($a) {
        case 'list':
            public_gate();
            json_out(def_list());

        case 'def':
            public_gate();
            $d = def_load($_GET['id'] ?? '');
            if (!$d) {
                json_out(['error' => 'Not found.'], 404);
            }
            json_out($d);

        case 'export':
            need_admin();
            $d = def_load($_GET['id'] ?? '');
            if (!$d) {
                json_out(['error' => 'Not found.'], 404);
            }
            unset($d['_source'], $d['_overrides']);
            header('Content-Disposition: attachment; filename="' . $d['id'] . '.json"');
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            exit;

        case 'def_save':
            need_admin();
            if ($method !== 'POST') { json_out(['error' => 'POST required.'], 405); }
            $id = (string)($body['id'] ?? '');
            $err = def_save($id, $body['def'] ?? null);
            if ($err) {
                json_out(['error' => $err], 422);
            }
            json_out(['ok' => true, 'id' => $id]);

        case 'def_delete':
            need_admin();
            if ($method !== 'POST') { json_out(['error' => 'POST required.'], 405); }
            $ok = def_delete_custom((string)($body['id'] ?? ''));
            json_out(['ok' => $ok, 'still_exists' => (bool)def_load((string)($body['id'] ?? ''))]);

        case 'draft_list':
            $u = need_user();
            $st = db()->prepare('SELECT id, doc_id, title, updated_at FROM drafts WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 200');
            $st->execute([$u['id']]);
            json_out($st->fetchAll());

        case 'draft_get':
            $u = need_user();
            $st = db()->prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?');
            $st->execute([(int)($_GET['id'] ?? 0), $u['id']]);
            $r = $st->fetch();
            if (!$r) { json_out(['error' => 'Not found.'], 404); }
            $r['data'] = json_decode($r['data'], true);
            json_out($r);

        case 'draft_save':
            $u = need_user();
            if ($method !== 'POST') { json_out(['error' => 'POST required.'], 405); }
            $doc = (string)($body['doc'] ?? '');
            if (!def_load($doc)) { json_out(['error' => 'Unknown document.'], 422); }
            $data = $body['data'] ?? null;
            if (!is_array($data)) { json_out(['error' => 'Bad data.'], 422); }
            $json = json_encode($data, JSON_UNESCAPED_UNICODE);
            if (strlen($json) > 500000) { json_out(['error' => 'Draft too large.'], 413); }
            $title = mb_substr(trim((string)($body['title'] ?? '')), 0, 200);
            $seed = (int)($body['seed'] ?? 1);
            $now = date('Y-m-d H:i:s');
            $id = (int)($body['id'] ?? 0);
            if ($id) {
                $st = db()->prepare('UPDATE drafts SET title = ?, data = ?, seed = ?, updated_at = ? WHERE id = ? AND user_id = ?');
                $st->execute([$title, $json, $seed, $now, $id, $u['id']]);
                if (!$st->rowCount()) {
                    $chk = db()->prepare('SELECT id FROM drafts WHERE id = ? AND user_id = ?');
                    $chk->execute([$id, $u['id']]);
                    if (!$chk->fetch()) { json_out(['error' => 'Draft not found.'], 404); }
                }
            } else {
                $st = db()->prepare('INSERT INTO drafts (user_id, doc_id, title, data, seed, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
                $st->execute([$u['id'], $doc, $title, $json, $seed, $now, $now]);
                $id = (int)db()->lastInsertId();
            }
            json_out(['ok' => true, 'id' => $id, 'updated_at' => $now]);

        case 'draft_delete':
            $u = need_user();
            if ($method !== 'POST') { json_out(['error' => 'POST required.'], 405); }
            $st = db()->prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?');
            $st->execute([(int)($body['id'] ?? 0), $u['id']]);
            json_out(['ok' => true]);

        default:
            json_out(['error' => 'Unknown action.'], 404);
    }
} catch (Exception $ex) {
    error_log('api: ' . $ex->getMessage());
    json_out(['error' => 'Server error.'], 500);
}
