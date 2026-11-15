/* Dynamic Documents – direct PDF download (runs entirely in the browser)
 *
 * Every .doc-page is rendered by the browser itself (so Bangla shaping, fonts and
 * letterhead are exactly what you see) and placed on a real A4 / Legal / Letter PDF page.
 * Libraries (bundled, MIT): html2canvas 1.4.1, jsPDF 2.5.1.
 * Note: pages are embedded as high-resolution images – text is not selectable.
 * Use "Print → Save as PDF" if you need a text-searchable PDF.
 */
(function (root) {
  'use strict';
  var MM = { legal: [215.9, 355.6], a4: [210, 297], letter: [215.9, 279.4] };
  var loading = {};

  function loadScript(src) {
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res;
      s.onerror = function () { delete loading[src]; rej(new Error('Could not load ' + src.split('/').pop())); };
      document.head.appendChild(s);
    });
    return loading[src];
  }

  function ensureLibs(base) {
    var p = Promise.resolve();
    if (!root.html2canvas) p = p.then(function () { return loadScript(base + 'html2canvas.min.js'); });
    if (!(root.jspdf && root.jspdf.jsPDF)) p = p.then(function () { return loadScript(base + 'jspdf.umd.min.js'); });
    return p;
  }

  function fontsReady() {
    return (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  }

  /**
   * @param {HTMLElement} preview  the #preview element that holds .doc-page sections
   * @param {object} def           document definition (page size)
   * @param {string} filename      without extension
   * @param {string} base          URL of assets/vendor/
   * @param {string} title         document title stored in the PDF metadata (may be Bangla)
   */
  function download(preview, def, filename, base, title) {
    var size = ((def.page && def.page.size) || 'a4');
    var mm = MM[size] || MM.a4;
    var pages = Array.prototype.slice.call(preview.querySelectorAll('.doc-page'));
    if (!pages.length) return Promise.reject(new Error('Nothing to export'));
    var zoomHost = document.getElementById('preview-zoom');
    var oldZoom = zoomHost ? zoomHost.style.zoom : '';

    return ensureLibs(base || 'assets/vendor/').then(fontsReady).then(function () {
      if (zoomHost) zoomHost.style.zoom = 1;          // capture at true size
      preview.classList.add('pdf-capture');
      var jsPDF = root.jspdf.jsPDF;
      var pdf = new jsPDF({ unit: 'mm', format: mm, orientation: 'portrait', compress: true });
      pdf.setProperties({ title: title || filename, creator: 'Dynamic Documents' });
      var first = true, chain = Promise.resolve();

      pages.forEach(function (pg) {
        chain = chain.then(function () {
          return root.html2canvas(pg, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        }).then(function (canvas) {
          // millimetres per canvas pixel; slice if the section is taller than the paper
          var pxPerMm = canvas.width / mm[0];
          var sliceH = Math.round(mm[1] * pxPerMm);
          var y = 0;
          while (y < canvas.height - 2) {
            var h = Math.min(sliceH, canvas.height - y);
            var part = document.createElement('canvas');
            part.width = canvas.width; part.height = h;
            var ctx = part.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, part.width, part.height);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            if (!first) pdf.addPage(mm, 'portrait');
            first = false;
            pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, mm[0], h / pxPerMm, undefined, 'FAST');
            y += sliceH;
          }
        });
      });

      return chain.then(function () {
        // explicit anchor download so the file name (incl. Bangla) is always honoured
        var blob = pdf.output('blob');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + '.pdf';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      });
    }).then(function (r) {
      preview.classList.remove('pdf-capture');
      if (zoomHost) zoomHost.style.zoom = oldZoom;
      return r;
    }, function (e) {
      preview.classList.remove('pdf-capture');
      if (zoomHost) zoomHost.style.zoom = oldZoom;
      throw e;
    });
  }

  root.DDPdf = { download: download };
})(window);
