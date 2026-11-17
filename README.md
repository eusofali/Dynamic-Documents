# Dynamic Documents

A dynamic, **Bangla-first document builder** for shared hosting (cPanel, no root needed).
Pick a document, fill in only the fields it needs, watch the document update **live**, then print or save as PDF.

* **35 ready documents**
  * 8 affidavits (marriage, name-correction, name-change, lost-document, date-of-birth, citizenship/residence, parent consent, one-and-the-same-person, plus a free-text general declaration) and vehicle sale
  * contracts: land bainanama, loan (হাওলাত/কর্জ), shop rent – with **multi-person parties** (several sellers / buyers / borrowers / landlords; the wording switches to আমরা/আমাদের and every person gets a signature line)
  * **11 A4 application letters** (no stamp paper): leave (school / office), bank account closing, loan application, trade licence, utility connection, scholarship, complaint, certificate request, resignation, and a general free-text application
  * **প্রত্যয়ন পত্র (testimonials)** for ward councillors / chairmen – resident & character, name variant, new-voter recommendation, student, plus a free-text one – A4 with an adjustable **3 in top margin** (remembered) for pre-printed pads
  * **চরিত্রগত সার্টিফিকেট (character certificate)** from a mayor / chairman / ward councillor – full plain-A4 version, or values-only printing onto the pre-printed certificate (ক্রমিক নং is typed from your register, never auto-generated)
  * **Full trade licences on plain A4** (Union Parishad and Pourashava): complete layout – header, legal paragraph, all fields, fee tables, validity, signature spaces, 5 colour themes, photo box – no pre-printed paper needed. Text only: **no emblem/logo, seal, signature image, QR code or automatic licence numbering**; every page states "not valid without signature and seal"
  * **Trade-licence printing** onto genuine pre-printed Union Parishad and Pourashava licence paper (two paper types) – prints **values only** at measured positions; no emblem, seal, signature or QR is generated. Per-printer calibration (±mm, remembered) and a *Guide* button that shows a scan of your blank form behind the text on screen (never printed)
  * job application and three CV formats (modern, classic bio-data, and the standard one-page CV with photo upload)
* **Business letterhead** – set your shop/organisation name, tagline, address, phone, logo and colour once in Admin → Settings; letter-type documents print it at the top (toggle per document)
* **Direct PDF download** – one click, no server software needed (A4 / Legal pages, Bangla rendered exactly as on screen; bundled html2canvas + jsPDF, MIT). The PDF holds page images; use Print → Save as PDF if you need selectable text
* **Amounts in words are automatic** (`৩,০০,০০০` → "তিন লক্ষ"), dates and Bangla digits formatted for you, balances auto-calculated
* Wording variations (spintax) with a **Re-word** button
* **Admin document builder** – create/edit documents (fields, sections, templates) in the browser with live preview; no code needed
* Optional logins, saved drafts, import/export of document definitions
* Installs with a **setup wizard** (or one CLI command). SQLite by default (zero config) or MySQL
* PHP 7.4+ · no Composer · no build step · no root

## Install on cPanel (≈ 2 minutes)

1. Download `dynamic-documents-vX.Y.Z-cpanel.zip` from the **Releases** page (or `releases/` in this repo).
2. cPanel → **File Manager** → open `public_html` (or a sub-folder / sub-domain folder) → **Upload** the zip → **Extract**.
3. Make sure the domain uses **PHP 7.4 or newer** (cPanel → *MultiPHP Manager*; 8.x recommended).
4. Open your site in the browser. You are redirected to the **setup wizard**:
   1. requirements check (it tells you exactly what to enable if something is missing)
   2. database – choose **SQLite** (recommended) or MySQL (create the DB + user first in *MySQL® Database Wizard*)
   3. site title + administrator account
   4. done → click **Delete installer**
5. Log in at `/login.php`, open **Admin** to add/edit documents and users.

Works in a sub-folder too (e.g. `https://example.com/docs/`).

### Unattended install (SSH / scripts)

```bash
php install/cli.php --admin-user=admin --admin-pass='S3cret-pass' --title="My Documents"
# MySQL:
php install/cli.php --admin-user=admin --admin-pass='…' --db=mysql --db-host=localhost --db-name=cpuser_docs --db-user=cpuser_docs --db-pass='…'
```

### Updating

Upload the new zip over the existing folder and extract (overwrite). `storage/` – your config, database and any documents you created or edited – is **not** part of the zip, so it is never overwritten. Bundled documents live in `definitions/` (replaced on update); anything you edit in the builder is saved to `storage/definitions/` and wins over the bundled version. "Revert" in Admin removes your edit.

### Security notes

* `storage/`, `app/`, `definitions/` are blocked from the web by `.htaccess` (Apache/LiteSpeed – standard on cPanel). On **nginx** add equivalent `deny` rules for those folders.
* The SQLite file has a random name and lives in `storage/`.
* Passwords are hashed (`password_hash`), all forms/API calls use CSRF tokens, sessions are HttpOnly + SameSite.
* Delete the `install/` folder after setup (the wizard offers a button; it also refuses to run twice).
* Set *Require login* (Admin → Settings) if the generators must not be public.

## How a document is defined

Each document is one JSON file – see `definitions/*.json` for working examples:

```jsonc
{
  "title": "হাওলাত / কর্জ টাকার চুক্তিপত্র",
  "page":   { "size": "legal", "marginTop": "4.5in", "margin": "1in", "fontSize": 16 },
  "digits": "bn",
  "groups": [{ "id": "g1", "title": "১ম পক্ষ", "icon": "fa-user" }],
  "fields": [
    { "name": "p1_name", "label": "নাম",   "type": "text",   "group": "g1", "col": 6, "required": true },
    { "name": "amount",  "label": "টাকা",  "type": "amount", "group": "g1", "col": 6 },
    { "name": "due",     "label": "বাকি",  "type": "amount", "calc": "amount-paid", "show_if": "mode==partial" }
  ],
  "pages": [{ "html": "<p>{{p1_name}} … {{amount}}/- ({{amount_words}}) টাকা</p>" }]
}
```

| Field types | `text` `textarea` `number` `amount` `date` `select` `checkbox` `rows` (repeating table) `photo` (upload, auto-cropped to passport ratio) `party` (one or more people – see below) |
|---|---|
| Field options | `required` `default` `placeholder` `help` `col` (1–12) `group` `show_if` `calc` `options` `columns` `bn` `suggest` |

Template syntax inside `pages[].html`:

```
{{field}}                         escaped value   (amount → {{f}} and {{f_words}};  date → {{f}}, {{f_long}} "5 March, 2001" and {{f_dmy}} "05 March 2001")
{{#if a}}…{{else}}…{{/if}}        conditions: a | !a | a==x | a!=x | a&&b
{{#each rows}}{{col}}{{@n}}{{/each}}
{option A|option B}               wording variation (spintax, stable per draft until "Re-word")
```

**Parties (several people):** a `party` field lists people as cards (name, father, address …). For a field named `p1` the template gets `{{p1_list}}` (every person, numbered when more than one), `{{p1_names}}` ("A, B ও C"), `{{p1_i}}` / `{{p1_my}}` / `{{p1_you}}` (আমি→আমরা, আমার→আমাদের, আপনি→আপনারা), `{{p1_sig}}` (a signature line per person, using the field's `signLabel`), `{{p1_count}}` and `{{#if p1_multi}}…{{/if}}`. `format` controls how each person is written.

**Form overlay documents** (`"guide": true`, absolutely positioned `.o` items in mm on a margin-0 page, `sticky` calibration fields) print only values onto pre-printed paper. A field with `"sticky": true` keeps its value across Reset/new documents. `page.marginTopField` lets a number field drive the top margin. `calc` can sum many fields (`a+b+c+d`); amounts accept `decimals` and `plain`.

**Other helpers:** `"default": "today"` on date fields; `"calc": "to-from+1"` between two date fields gives the number of days (use `"unit": "দিন"` so the helper text says days, not taka); `"letterhead": true` on a document prints the business letterhead.

A page can carry `"if": "layout==3"` so it is only printed in some variants. `computed` entries build joined lists (see the correction affidavit).

**Spintax rule:** every option inside `{a|b}` must mean exactly the same - only the wording may differ (never a different fact, number, condition, party, time or yes/no). The builder shows a live *Spin check*, and `node tools/spin-audit.js` audits all documents (it also runs in CI). It flags empty or duplicate options, differing numbers, a negative option next to a positive one, and key legal terms (death, loan, bank, cheque, lawsuit, cash, instalment ...) present in only some options. `--list` prints every group for a human read-through.

User input is inserted **after** spintax is resolved, so typed text can never be altered by the spinner.

## Project layout

```
index.php  doc.php  drafts.php  login.php  api.php   public pages + JSON API
admin/     dashboard, settings, users, visual builder
install/   setup wizard (+ cli.php)
app/       bootstrap, definitions loader, layout (blocked from web)
assets/    engine.js (template engine), editor.js, builder.js, app.css
definitions/  bundled documents (JSON)
storage/   config, database, custom documents (blocked from web, never shipped)
tools/build-release.sh   builds the cPanel zip
```

## Build a release

```bash
./tools/build-release.sh          # → releases/dynamic-documents-vX.Y.Z-cpanel.zip
```

Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yml`, which lints the PHP, builds the zip and attaches it to the GitHub Release.

> **Legal notice:** the bundled texts are templates. Have them reviewed by a lawyer/notary for your jurisdiction before relying on them.
