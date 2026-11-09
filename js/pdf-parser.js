/* TestRecall — PDF text extraction + MCQ text parser.
 *
 * Format handled (verified against the real MCQ PDFs):
 *  - Text-based PDF. Questions start a new line as "1. Question text?"
 *  - Options labelled "A. ... B. ... C. ... D. ..." — one per line, or two
 *    per line (A and B on one line, C and D on the next).
 *  - Answer key at the end under the heading "Answer Key", in rows of 10:
 *    a line of question numbers, then a line of correct letters.
 *
 * Works in the browser (window.TestRecallParser) and in Node for tests
 * (module.exports). No dependencies except pdf.js for extraction.
 */
(function (root) {
  'use strict';

  var PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  /* Extract the text of a PDF (ArrayBuffer) as one string, rebuilding the
   * visual lines from the text items' positions so the parser below sees
   * the same layout a reader sees. */
  async function extractPdfText(arrayBuffer) {
    var pdfjs = root.pdfjsLib;
    if (!pdfjs) {
      await loadPdfJs();
      pdfjs = root.pdfjsLib;
    }
    if (!pdfjs) throw new Error('PDF reader (pdf.js) could not be loaded. Check your connection and try again.');
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_CDN;
    }
    var doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    var out = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var page = await doc.getPage(p);
      var content = await page.getTextContent();
      out.push(pageLines(content.items).join('\n'));
    }
    return out.join('\n');
  }

  function loadPdfJs() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS_CDN;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load pdf.js from the CDN.')); };
      document.head.appendChild(s);
    });
  }

  /* Group text items into lines by their y position, then order the lines
   * top to bottom and the items in each line left to right. */
  function pageLines(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var y = it.transform[5];
      var x = it.transform[4];
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        if (Math.abs(rows[i].y - y) <= 3) { row = rows[i]; break; }
      }
      if (!row) { row = { y: y, parts: [] }; rows.push(row); }
      row.parts.push({ x: x, str: it.str });
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (row) {
      row.parts.sort(function (a, b) { return a.x - b.x; });
      return row.parts.map(function (p) { return p.str; }).join(' ').replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
  }

  /* Parse MCQ text into questions.
   * Returns { questions: [{n, q, options[4], answer}], warnings: [string] }.
   * answer is a letter 'A'–'D', or null when the key has no entry. */
  function parseMcqText(fullText) {
    var warnings = [];
    var answers = {};

    // Find the key section: the "Answer Key" heading after which key rows
    // actually appear (a mention in the intro does not count).
    var keyIdx = -1;
    var searchFrom = 0;
    while (true) {
      var idx = fullText.indexOf('Answer Key', searchFrom);
      if (idx < 0) break;
      var after = fullText.slice(idx, idx + 600);
      if (/^\d+(\s+\d+)*$/m.test(after) || /\b\d+\.\s*[A-D]\b/.test(after)) { keyIdx = idx; break; }
      searchFrom = idx + 1;
    }
    // Back up to the start of the heading's line: a page header such as
    // "Naming and Classification of Bacteria - MCQs Answer Key" shares its
    // line with the heading, and the part before it must not leak into the
    // last question's text.
    if (keyIdx >= 0) keyIdx = fullText.lastIndexOf('\n', keyIdx) + 1;
    var body = keyIdx >= 0 ? fullText.slice(0, keyIdx) : fullText;
    var keyPart = keyIdx >= 0 ? fullText.slice(keyIdx) : '';

    if (keyPart) {
      var lines = keyPart.split('\n').map(function (l) { return l.trim(); });
      for (var i = 0; i < lines.length; i++) {
        // Rows-of-10 style: a line of question numbers, then a line of letters.
        if (/^\d+(\s+\d+)*$/.test(lines[i])) {
          var nums = lines[i].split(/\s+/).map(Number);
          var j = i + 1;
          while (j < lines.length && !lines[j]) j++;
          if (j < lines.length && /^[A-D](\s+[A-D])*$/.test(lines[j])) {
            var lets = lines[j].split(/\s+/);
            if (nums.length === lets.length) {
              nums.forEach(function (n, k) { answers[n] = lets[k]; });
            }
            i = j;
          }
        }
      }
      // Inline style: "1. D 2. C 3. A ..." (used by some sets).
      var pairRe = /\b(\d+)\.\s*([A-D])\b/g;
      var pm;
      while ((pm = pairRe.exec(keyPart)) !== null) {
        if (!answers[pm[1]]) answers[pm[1]] = pm[2];
      }
    } else {
      warnings.push('No answer key section found. You can set the answers on the review screen.');
    }

    // Strip running headers/footers and section words from the body before
    // splitting: lone page numbers, header lines ("... - MCQs Questions
    // 11-20 of 122", "... — MCQs | Page 1/9"), and standalone all-caps
    // section words (SHAPE, ARRANGEMENT, ...) that sit between questions.
    // Without this, the last option on a page swallows the next page's header.
    body = body
      .split('\n')
      .filter(function (line) {
        var t = line.trim();
        if (!t) return true;
        if (/^\d+$/.test(t)) return false;
        if (/MCQs\s+(Questions|\||—)/.test(t)) return false;
        if (/^[A-Z][A-Z\s&'()\/-]{1,}$/.test(t)) return false;
        return true;
      })
      .join('\n');

    // Split the body into questions: a new question starts a line with digits + '. '
    var parts = body.split(/^(\d+)\.\s/m);
    var questions = [];
    for (var k = 1; k < parts.length; k += 2) {
      var n = parseInt(parts[k], 10);
      var block = parts[k + 1];
      // Option markers: a letter A–D followed by '. ', at a line start or after a space.
      var markerRe = /(?:^|\s)([A-D])\.\s/g;
      var markers = [];
      var m;
      while ((m = markerRe.exec(block)) !== null) {
        markers.push({ index: m.index, letter: m[1] });
      }
      if (markers.length !== 4) {
        warnings.push('Question ' + n + ': found ' + markers.length + ' options instead of 4, skipped.');
        continue;
      }
      var stem = block.slice(0, markers[0].index).replace(/\s+/g, ' ').trim();
      var options = markers.map(function (mk, idx) {
        var dot = block.indexOf('.', mk.index);
        var end = idx + 1 < markers.length ? markers[idx + 1].index : block.length;
        return block.slice(dot + 1, end).replace(/\s+/g, ' ').trim();
      });
      questions.push({ n: n, q: stem, options: options, answer: answers[n] || null });
    }
    questions.sort(function (a, b) { return a.n - b.n; });
    return { questions: questions, warnings: warnings };
  }

  var api = { extractPdfText: extractPdfText, parseMcqText: parseMcqText, pageLines: pageLines };
  root.TestRecallParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
