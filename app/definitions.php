<?php
/**
 * Document definitions. Bundled ones live in /definitions (replaced on upgrade),
 * custom or edited ones live in /storage/definitions (survive upgrades and win on id clash).
 */
function def_dirs()
{
    return ['bundled' => APP_ROOT . '/definitions', 'custom' => STORAGE . '/definitions'];
}

function def_valid_id($id)
{
    return is_string($id) && preg_match('/^[a-z0-9][a-z0-9_-]{1,59}$/', $id) === 1;
}

function def_read_file($file)
{
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $d = json_decode($raw, true);
    return is_array($d) ? $d : null;
}

function def_load($id)
{
    if (!def_valid_id($id)) {
        return null;
    }
    $dirs = def_dirs();
    foreach (['custom', 'bundled'] as $k) {
        $f = $dirs[$k] . '/' . $id . '.json';
        if (is_file($f)) {
            $d = def_read_file($f);
            if ($d) {
                $d['id'] = $id;
                $d['_source'] = $k;
                $d['_overrides'] = ($k === 'custom' && is_file($dirs['bundled'] . '/' . $id . '.json'));
                return $d;
            }
        }
    }
    return null;
}

function def_list()
{
    $ids = [];
    foreach (def_dirs() as $dir) {
        foreach ((array)glob($dir . '/*.json') as $f) {
            $ids[basename($f, '.json')] = true;
        }
    }
    $out = [];
    foreach (array_keys($ids) as $id) {
        $d = def_load($id);
        if (!$d) {
            continue;
        }
        $out[] = [
            'id' => $id,
            'title' => $d['title'] ?? $id,
            'title_en' => $d['title_en'] ?? '',
            'category' => $d['category'] ?? 'Other',
            'icon' => $d['icon'] ?? 'fa-file-alt',
            'description' => $d['description'] ?? '',
            'source' => $d['_source'],
            'overrides' => $d['_overrides'],
        ];
    }
    usort($out, function ($a, $b) {
        return strcmp($a['category'] . $a['title'], $b['category'] . $b['title']);
    });
    return $out;
}

/** Validate + normalise a definition. Returns [array|null, error|null]. */
function def_validate($d)
{
    if (!is_array($d)) {
        return [null, 'Definition must be a JSON object.'];
    }
    if (trim((string)($d['title'] ?? '')) === '') {
        return [null, 'Title is required.'];
    }
    if (!isset($d['fields']) || !is_array($d['fields'])) {
        return [null, '"fields" must be a list.'];
    }
    if (!isset($d['pages']) || !is_array($d['pages']) || !count($d['pages'])) {
        return [null, 'At least one page is required.'];
    }
    $types = ['text', 'textarea', 'number', 'amount', 'date', 'select', 'checkbox', 'rows'];
    $seen = [];
    foreach ($d['fields'] as $i => $f) {
        $n = $f['name'] ?? '';
        if (!is_string($n) || !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $n)) {
            return [null, 'Field #' . ($i + 1) . ': name must be letters, digits and underscore (not starting with a digit).'];
        }
        if (isset($seen[$n])) {
            return [null, 'Duplicate field name: ' . $n];
        }
        $seen[$n] = true;
        if (!in_array($f['type'] ?? '', $types, true)) {
            return [null, 'Field "' . $n . '": unknown type.'];
        }
    }
    foreach ($d['pages'] as $i => $p) {
        if (!is_array($p) || !isset($p['html']) || !is_string($p['html'])) {
            return [null, 'Page #' . ($i + 1) . ' needs an "html" string.'];
        }
    }
    unset($d['_source'], $d['_overrides']);
    $d['version'] = (int)($d['version'] ?? 1);
    return [$d, null];
}

function def_save($id, $d)
{
    if (!def_valid_id($id)) {
        return 'Invalid id (use a-z, 0-9, _ or -).';
    }
    list($clean, $err) = def_validate($d);
    if ($err) {
        return $err;
    }
    $clean['id'] = $id;
    $dir = def_dirs()['custom'];
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
        return 'Cannot create storage/definitions (check folder permissions).';
    }
    $json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (@file_put_contents($dir . '/' . $id . '.json', $json . "\n", LOCK_EX) === false) {
        return 'Cannot write definition file (storage/definitions not writable).';
    }
    return null;
}

function def_delete_custom($id)
{
    if (!def_valid_id($id)) {
        return false;
    }
    $f = def_dirs()['custom'] . '/' . $id . '.json';
    return is_file($f) ? @unlink($f) : false;
}
