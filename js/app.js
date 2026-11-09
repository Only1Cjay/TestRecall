/* TestRecall — MCQ practice app. Plain JS, no build step.
 * Sets and attempts are stored in localStorage; there is no server. */
(function () {
  'use strict';

  var LS_KEY = 'testrecall.v1';
  var PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

  var BUILTIN = [
    {
      id: 'naming-classification',
      title: 'Naming and Classification of Bacteria',
      file: 'data/naming-classification-bacteria.json',
      desc: '122 questions · Dr Mrs Oboh lecture, 27 Oct 2026',
    },
    {
      id: 'systematic-classification',
      title: 'Systematic Classification of Bacteria',
      file: 'data/systematic-classification-bacteria.json',
      desc: '60 questions · PHM 201',
    },
  ];

  /* ---------- storage ---------- */
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (s && typeof s === 'object') return { sets: s.sets || {}, attempts: s.attempts || {}, uploads: s.uploads || [] };
    } catch (e) { /* corrupted storage: start fresh */ }
    return { sets: {}, attempts: {}, uploads: [] };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }
  var state = loadState();

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  /* ---------- screens ---------- */
  var screens = ['home', 'quiz', 'results', 'settings'];
  function show(name) {
    screens.forEach(function (s) { $('screen-' + s).classList.toggle('hidden', s !== name); });
    $('btn-add-fab').classList.toggle('hidden', name !== 'home');
    window.scrollTo(0, 0);
  }

  /* ---------- sets ---------- */
  var builtinData = {}; // id -> questions array (fetched from data/*.json)

  async function loadBuiltin() {
    for (var i = 0; i < BUILTIN.length; i++) {
      var meta = BUILTIN[i];
      try {
        var res = await fetch(meta.file);
        var data = await res.json();
        builtinData[meta.id] = data.map(function (q) {
          return { n: q.n, q: q.q, options: q.options.slice(), answer: q.answer };
        });
      } catch (e) {
        console.warn('Could not load ' + meta.file, e);
      }
    }
  }

  function allSets() {
    var list = BUILTIN.map(function (meta) {
      return {
        id: meta.id, title: meta.title, desc: meta.desc,
        questions: builtinData[meta.id] || null, builtin: true,
      };
    });
    Object.keys(state.sets).forEach(function (id) {
      var s = state.sets[id];
      list.push({ id: id, title: s.title, desc: s.questions.length + ' questions · added ' + fmtDate(s.createdAt), questions: s.questions, builtin: false });
    });
    return list;
  }
  function getSet(id) {
    var found = null;
    allSets().forEach(function (s) { if (s.id === id) found = s; });
    return found;
  }
  function attemptsFor(setId) { return state.attempts[setId] || []; }
  function bestScore(setId) {
    var best = null;
    attemptsFor(setId).forEach(function (a) {
      var pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
      if (best === null || pct > best) best = pct;
    });
    return best;
  }

  /* ---------- theme: light-first, toggle saved in localStorage ---------- */
  var THEME_KEY = 'testrecall.theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0E1712' : '#EFF4F1');
    var sl = $('settings-theme-label');
    if (sl) sl.textContent = t === 'dark' ? 'Light' : 'Dark';
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  /* ---------- install prompt ---------- */
  var INSTALL_KEY = 'testrecall.installDismissed';
  var deferredPrompt = null;
  var isInstalled = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  function installDismissed() {
    try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch (e) { return false; }
  }
  function showInstallBanner() {
    if (isInstalled || installDismissed() || !deferredPrompt) return;
    $('install-banner').classList.remove('hidden');
    $('btn-add-fab').classList.add('fab-raised');
  }
  function hideInstallBanner() {
    $('install-banner').classList.add('hidden');
    $('btn-add-fab').classList.remove('fab-raised');
  }
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    deferredPrompt = ev;
    showInstallBanner();
  });
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    isInstalled = true;
    hideInstallBanner();
  });
  function promptInstall() {
    if (!deferredPrompt) return false;
    var p = deferredPrompt;
    deferredPrompt = null;
    hideInstallBanner();
    p.prompt();
    return true;
  }

  /* ---------- settings: uploaded PDFs, grouped by day ---------- */
  function dayLabel(ts) {
    var d = new Date(ts);
    var now = new Date();
    var startOf = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var diff = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtClock(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function renderSettings() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    var list = $('uploads-list');
    list.innerHTML = '';
    var uploads = state.uploads || [];
    if (!uploads.length) {
      list.appendChild(el('p', 'uploads-empty', 'No PDFs uploaded yet — files you upload will appear here, grouped by day.'));
      return;
    }
    var lastDay = null;
    uploads.forEach(function (u) {
      var day = dayLabel(u.at);
      if (day !== lastDay) {
        list.appendChild(el('div', 'upload-day', day));
        lastDay = day;
      }
      var row = el('div', 'upload-item');
      var name = el('div', 'upload-name', u.name);
      var stem = (u.name || '').replace(/\.pdf$/i, '');
      if (u.title && u.title !== stem) name.appendChild(el('span', 'upload-set', '→ ' + u.title));
      row.appendChild(name);
      row.appendChild(el('div', 'upload-time', fmtClock(u.at)));
      list.appendChild(row);
    });
  }

  /* ---------- home ---------- */
  function renderHome() {
    var list = $('set-list');
    list.innerHTML = '';
    allSets().forEach(function (set) {
      var card = el('div', 'set-card');
      var head = el('div', 'set-head');
      head.appendChild(el('div', 'set-title', set.title));
      if (!set.builtin) {
        var del = el('button', 'icon-btn', '✕');
        del.title = 'Delete this set';
        del.setAttribute('aria-label', 'Delete ' + set.title);
        del.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (confirm('Delete "' + set.title + '"? Its saved attempts will go too.')) {
            delete state.sets[set.id];
            delete state.attempts[set.id];
            saveState();
            renderHome();
          }
        });
        head.appendChild(del);
      }
      card.appendChild(head);
      card.appendChild(el('div', 'set-desc', set.desc));
      var stats = el('div', 'set-stats');
      if (set.questions) {
        stats.appendChild(el('span', 'pill', set.questions.length + ' questions'));
        var best = bestScore(set.id);
        stats.appendChild(el('span', 'pill', best === null ? 'Not tried yet' : 'Best: ' + best + '%'));
        stats.appendChild(el('span', 'pill', attemptsFor(set.id).length + ' attempt' + (attemptsFor(set.id).length === 1 ? '' : 's')));
      } else {
        stats.appendChild(el('span', 'pill warn', 'Could not load — check connection, then reopen'));
      }
      card.appendChild(stats);
      var btn = el('button', 'btn primary', set.questions ? 'Start practice' : 'Retry loading');
      btn.addEventListener('click', function () {
        if (!set.questions) { loadBuiltin().then(renderHome); return; }
        startQuiz(set.id, null);
      });
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  /* ---------- quiz ---------- */
  var quiz = null; // {setId, title, items, pos, picked{}, flagged:Set, startedAt, timerId}

  function startQuiz(setId, subset) {
    var set = getSet(setId);
    if (!set || !set.questions) return;
    var pool = subset || set.questions;
    var items = shuffle(pool.slice()).map(function (q) {
      var opts = shuffle(q.options.map(function (text, i) {
        return { text: text, letter: 'ABCD'[i] };
      }));
      return { n: q.n, q: q.q, options: opts, answer: q.answer, setId: set.id };
    });
    quiz = {
      setId: set.id, title: set.title, items: items, pos: 0,
      picked: {}, flagged: {}, startedAt: Date.now(), elapsed: 0, timerId: null,
    };
    $('quiz-title').textContent = set.title;
    $('quiz-total').textContent = items.length;
    quiz.timerId = setInterval(function () {
      quiz.elapsed = Math.floor((Date.now() - quiz.startedAt) / 1000);
      $('quiz-timer').textContent = fmtTime(quiz.elapsed);
    }, 1000);
    $('quiz-timer').textContent = '00:00';
    renderQuestion();
    show('quiz');
  }

  function answeredCount() { return Object.keys(quiz.picked).length; }

  function renderQuestion() {
    var item = quiz.items[quiz.pos];
    $('quiz-pos').textContent = (quiz.pos + 1) + ' / ' + quiz.items.length;
    $('quiz-progress').style.width = Math.round((answeredCount() / quiz.items.length) * 100) + '%';
    $('quiz-qnum').textContent = 'Question ' + (quiz.pos + 1);
    $('quiz-qtext').textContent = item.q;
    var flagBtn = $('quiz-flag');
    flagBtn.classList.toggle('active', !!quiz.flagged[quiz.pos]);
    flagBtn.textContent = quiz.flagged[quiz.pos] ? '★ Flagged — tap to unflag' : '☆ Flag for later';

    var box = $('quiz-options');
    box.innerHTML = '';
    item.options.forEach(function (opt, i) {
      var b = el('button', 'option');
      if (quiz.picked[quiz.pos] === i) b.classList.add('selected');
      var badge = el('span', 'opt-letter', 'ABCD'[i]);
      b.appendChild(badge);
      b.appendChild(el('span', 'opt-text', opt.text));
      b.addEventListener('click', function () {
        quiz.picked[quiz.pos] = i;
        renderQuestion();
      });
      box.appendChild(b);
    });

    $('quiz-prev').disabled = quiz.pos === 0;
    $('quiz-next').textContent = quiz.pos === quiz.items.length - 1 ? 'Finish' : 'Next →';
    renderGrid();
  }

  function renderGrid() {
    var grid = $('quiz-grid');
    grid.innerHTML = '';
    quiz.items.forEach(function (_, i) {
      var b = el('button', 'grid-num');
      b.textContent = i + 1;
      if (i === quiz.pos) b.classList.add('current');
      if (quiz.picked[i] != null) b.classList.add('answered');
      if (quiz.flagged[i]) b.classList.add('flagged');
      b.addEventListener('click', function () {
        quiz.pos = i;
        $('grid-panel').classList.add('hidden');
        renderQuestion();
      });
      grid.appendChild(b);
    });
  }

  function grade() {
    var score = 0;
    var missed = [];
    quiz.items.forEach(function (item, i) {
      var pickedIdx = quiz.picked[i];
      var pickedLetter = pickedIdx != null ? item.options[pickedIdx].letter : null;
      if (pickedLetter === item.answer) score++;
      else missed.push({ item: item, pickedLetter: pickedLetter });
    });
    return { score: score, total: quiz.items.length, missed: missed };
  }

  function submitQuiz() {
    var result = grade();
    clearInterval(quiz.timerId);
    var seconds = Math.floor((Date.now() - quiz.startedAt) / 1000);
    var attempt = { date: Date.now(), score: result.score, total: result.total, seconds: seconds };
    if (!state.attempts[quiz.setId]) state.attempts[quiz.setId] = [];
    state.attempts[quiz.setId].push(attempt);
    saveState();
    renderResults(result, seconds);
    show('results');
  }

  function askSubmit() {
    var unanswered = quiz.items.length - answeredCount();
    $('confirm-text').textContent = unanswered > 0
      ? 'You answered ' + answeredCount() + ' of ' + quiz.items.length + ' questions. ' + unanswered + ' still unanswered — submit anyway?'
      : 'You answered all ' + quiz.items.length + ' questions. Submit and see your score?';
    $('confirm-modal').classList.remove('hidden');
  }

  /* ---------- results ---------- */
  var lastResult = null;
  function renderResults(result, seconds) {
    lastResult = result;
    var pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    var ring = $('score-ring-fg');
    var CIRC = 2 * Math.PI * 54;
    ring.style.strokeDasharray = CIRC;
    ring.style.strokeDashoffset = CIRC * (1 - pct / 100);
    ring.style.stroke = pct >= 80 ? '#2fa36b' : pct >= 50 ? '#e8b34b' : '#e0655f';
    $('score-pct').textContent = pct + '%';
    $('score-line').textContent = result.score + ' of ' + result.total + ' correct · ' + fmtTime(seconds);
    $('score-msg').textContent =
      pct >= 80 ? 'You know this topic. Revisit in a few days.' :
      pct >= 50 ? 'Solid. Note every question you missed and retest only those.' :
      'Go back to the notes, rebuild the topic from memory, then retake this set.';

    var box = $('missed-list');
    box.innerHTML = '';
    $('missed-title').textContent = result.missed.length === 0
      ? 'Nothing missed — perfect score.'
      : 'Review — the ' + result.missed.length + ' you missed';
    result.missed.forEach(function (entry, idx) {
      var item = entry.item;
      var card = el('div', 'miss-card');
      card.appendChild(el('div', 'miss-q', (idx + 1) + '. ' + item.q));
      item.options.forEach(function (opt) {
        var line = el('div', 'miss-opt');
        var tag = '';
        if (opt.letter === item.answer) { line.classList.add('correct'); tag = 'Correct answer'; }
        else if (opt.letter === entry.pickedLetter) { line.classList.add('wrong'); tag = 'Your answer'; }
        line.appendChild(el('span', 'miss-tag', tag));
        line.appendChild(el('span', '', opt.letter + '. ' + opt.text));
        card.appendChild(line);
      });
      if (entry.pickedLetter === null) {
        card.appendChild(el('div', 'miss-note', 'You left this one unanswered.'));
      }
      // Lecturer-vs-textbook note, kept from the original notes.
      if (item.setId === 'systematic-classification' && /kidney-shaped/i.test(item.q)) {
        card.appendChild(el('div', 'miss-note',
          'Note: this question is keyed to your lecturer’s answer (fusiform). Strictly, kidney-shaped is reniform — spindle-shaped is fusiform.'));
      }
      box.appendChild(card);
    });

    $('btn-retry-missed').classList.toggle('hidden', result.missed.length === 0);
  }

  /* ---------- add a set: PDF + paste ---------- */
  var pendingImport = null; // {title, questions, warnings}

  function openAddModal() {
    setAddTab('pdf');
    $('modal-add-panel').classList.remove('hidden');
    $('modal-review-panel').classList.add('hidden');
    $('add-modal-title').textContent = 'Add a set';
    $('pdf-status').textContent = '';
    $('paste-status').textContent = '';
    $('add-modal').classList.remove('hidden');
  }
  function closeAddModal() {
    $('add-modal').classList.add('hidden');
    pendingImport = null;
  }
  function showReviewPanel() {
    $('modal-add-panel').classList.add('hidden');
    $('modal-review-panel').classList.remove('hidden');
    $('add-modal-title').textContent = 'Check this set';
  }
  function showAddPanel() {
    pendingImport = null;
    $('modal-review-panel').classList.add('hidden');
    $('modal-add-panel').classList.remove('hidden');
    $('add-modal-title').textContent = 'Add a set';
  }

  function setAddTab(tab) {
    $('tab-pdf').classList.toggle('active', tab === 'pdf');
    $('tab-paste').classList.toggle('active', tab === 'paste');
    $('panel-pdf').classList.toggle('hidden', tab !== 'pdf');
    $('panel-paste').classList.toggle('hidden', tab !== 'paste');
  }

  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS_CDN;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the PDF reader. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }

  async function handlePdfFile(file) {
    var status = $('pdf-status');
    status.textContent = 'Reading ' + file.name + '…';
    status.className = 'status';
    try {
      // Read the file bytes once, up front — holding a stale file reference
      // is what used to fail on some Android pickers.
      var buf = await file.arrayBuffer();
      await ensurePdfJs();
      var text = await window.TestRecallParser.extractPdfText(buf);
      var parsed = window.TestRecallParser.parseMcqText(text);
      if (parsed.questions.length === 0) {
        status.textContent = 'No questions found in this PDF. It may be a scanned/photo PDF — the app can only read text-based PDFs.';
        status.className = 'status error';
        return;
      }
      openReview(file.name.replace(/\.pdf$/i, ''), parsed, file.name);
      status.textContent = '';
    } catch (e) {
      console.error(e);
      status.textContent = 'That PDF could not be read: ' + (e && e.message ? e.message : e) +
        ' Try saving the PDF to your phone (e.g. Downloads) and picking it from there.';
      status.className = 'status error';
    }
  }

  function handlePasteText() {
    var text = $('paste-input').value.trim();
    var status = $('paste-status');
    if (!text) { status.textContent = 'Paste the questions first.'; status.className = 'status error'; return; }
    var parsed = window.TestRecallParser.parseMcqText(text);
    if (parsed.questions.length === 0) {
      status.textContent = 'No questions found. Questions must start with a number like "1. ...", options labelled A. B. C. D., and the answer key at the end.';
      status.className = 'status error';
      return;
    }
    openReview('Pasted set', parsed, null);
    status.textContent = '';
  }

  /* ---------- import review ---------- */
  function openReview(suggestedTitle, parsed, sourceFile) {
    pendingImport = {
      title: suggestedTitle,
      sourceFile: sourceFile || null,
      questions: parsed.questions.map(function (q) {
        return { n: q.n, q: q.q, options: q.options.slice(), answer: q.answer };
      }),
      warnings: parsed.warnings,
    };
    $('review-title').value = suggestedTitle;
    $('review-meta').textContent = pendingImport.questions.length + ' questions found' +
      (pendingImport.warnings.length ? ' · ' + pendingImport.warnings.length + ' warning(s) — check below' : '');
    var warnBox = $('review-warnings');
    warnBox.innerHTML = '';
    pendingImport.warnings.forEach(function (w) { warnBox.appendChild(el('div', 'warn-line', w)); });

    var samples = $('review-samples');
    samples.innerHTML = '';
    pendingImport.questions.slice(0, 3).forEach(function (q) {
      var d = el('div', 'sample');
      d.appendChild(el('div', 'sample-q', q.n + '. ' + q.q));
      d.appendChild(el('div', 'sample-a', 'Options: ' + q.options.join(' | ') + '  →  Answer: ' + (q.answer || 'not set')));
      samples.appendChild(d);
    });

    renderReviewList();
    showReviewPanel();
  }

  function renderReviewList() {
    var list = $('review-list');
    list.innerHTML = '';
    pendingImport.questions.forEach(function (q, idx) {
      var row = el('div', 'review-row');
      row.appendChild(el('div', 'review-row-q', q.n + '. ' + q.q));
      var opts = el('div', 'review-row-opts', q.options.map(function (o, i) { return 'ABCD'[i] + '. ' + o; }).join('  ·  '));
      row.appendChild(opts);
      var controls = el('div', 'review-controls');
      var label = el('label', '', 'Answer: ');
      var sel = document.createElement('select');
      ['A', 'B', 'C', 'D'].forEach(function (letter) {
        var o = document.createElement('option');
        o.value = letter; o.textContent = letter;
        if (q.answer === letter) o.selected = true;
        sel.appendChild(o);
      });
      if (!q.answer) {
        var o0 = document.createElement('option');
        o0.value = ''; o0.textContent = '— pick —'; o0.selected = true;
        sel.insertBefore(o0, sel.firstChild);
      }
      sel.addEventListener('change', function () { q.answer = sel.value || null; });
      label.appendChild(sel);
      controls.appendChild(label);
      var rm = el('button', 'icon-btn', '✕');
      rm.title = 'Remove this question';
      rm.addEventListener('click', function () {
        pendingImport.questions.splice(idx, 1);
        $('review-meta').textContent = pendingImport.questions.length + ' questions';
        renderReviewList();
      });
      controls.appendChild(rm);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  function saveImport() {
    var title = $('review-title').value.trim();
    if (!title) { alert('Give the set a title first.'); return; }
    var missing = pendingImport.questions.filter(function (q) { return !q.answer; });
    if (missing.length) {
      alert('Set an answer for every question first — ' + missing.length + ' still missing (question ' + missing[0].n + ').');
      return;
    }
    var id = 'user-' + Date.now();
    state.sets[id] = { title: title, questions: pendingImport.questions, createdAt: Date.now() };
    if (pendingImport.sourceFile) {
      state.uploads = state.uploads || [];
      state.uploads.unshift({ name: pendingImport.sourceFile, title: title, at: Date.now() });
      if (state.uploads.length > 100) state.uploads.length = 100;
    }
    saveState();
    pendingImport = null;
    closeAddModal();
    renderHome();
    show('home');
  }

  /* ---------- wire up ---------- */
  function init() {
    /* ---------- theme ---------- */
    var savedTheme = 'light';
    try { savedTheme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(savedTheme);
    $('theme-toggle').addEventListener('click', toggleTheme);
    $('settings-theme').addEventListener('click', toggleTheme);

    /* ---------- hamburger menu ---------- */
    var menu = $('menu-dropdown');
    var menuBtn = $('menu-btn');
    function closeMenu() {
      menu.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
    menuBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = menu.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', String(!open));
      if (!open) $('menu-install-hint').classList.add('hidden');
    });
    document.addEventListener('click', function (ev) {
      if (!menu.classList.contains('hidden') && !menu.contains(ev.target) && ev.target !== menuBtn) closeMenu();
    });
    $('menu-settings').addEventListener('click', function () {
      closeMenu();
      renderSettings();
      show('settings');
    });
    $('menu-install').addEventListener('click', function () {
      if (promptInstall()) { closeMenu(); return; }
      $('menu-install-hint').classList.remove('hidden');
    });
    $('btn-settings-home').addEventListener('click', function () { renderHome(); show('home'); });

    /* ---------- install banner ---------- */
    $('install-accept').addEventListener('click', function () { promptInstall(); });
    $('install-dismiss').addEventListener('click', function () {
      hideInstallBanner();
      try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) {}
    });
    showInstallBanner();

    $('btn-add-fab').addEventListener('click', openAddModal);
    $('btn-close-add').addEventListener('click', closeAddModal);
    $('add-modal').addEventListener('click', function (ev) { if (ev.target === $('add-modal')) closeAddModal(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('add-modal').classList.contains('hidden')) closeAddModal();
    });
    $('tab-pdf').addEventListener('click', function () { setAddTab('pdf'); });
    $('tab-paste').addEventListener('click', function () { setAddTab('paste'); });
    $('pdf-input').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) handlePdfFile(f);
      ev.target.value = '';
    });
    $('btn-parse-paste').addEventListener('click', handlePasteText);
    $('btn-review-cancel').addEventListener('click', showAddPanel);
    $('btn-review-save').addEventListener('click', saveImport);

    $('quiz-flag').addEventListener('click', function () {
      quiz.flagged[quiz.pos] = !quiz.flagged[quiz.pos];
      renderQuestion();
    });
    $('quiz-prev').addEventListener('click', function () {
      if (quiz.pos > 0) { quiz.pos--; renderQuestion(); }
    });
    $('quiz-next').addEventListener('click', function () {
      if (quiz.pos < quiz.items.length - 1) { quiz.pos++; renderQuestion(); }
      else askSubmit();
    });
    $('quiz-grid-btn').addEventListener('click', function () {
      renderGrid();
      $('grid-panel').classList.toggle('hidden');
    });
    $('grid-close').addEventListener('click', function () { $('grid-panel').classList.add('hidden'); });
    $('quiz-submit').addEventListener('click', askSubmit);
    $('quiz-exit').addEventListener('click', function () {
      if (confirm('Leave this attempt? Your answers so far will not be saved.')) {
        clearInterval(quiz.timerId);
        quiz = null;
        renderHome();
        show('home');
      }
    });
    $('confirm-cancel').addEventListener('click', function () { $('confirm-modal').classList.add('hidden'); });
    $('confirm-submit').addEventListener('click', function () {
      $('confirm-modal').classList.add('hidden');
      submitQuiz();
    });

    $('btn-retake').addEventListener('click', function () { startQuiz(quiz.setId, null); });
    $('btn-retry-missed').addEventListener('click', function () {
      // Rebuild from the original set questions (original option order),
      // not the shuffled quiz items, so the answer letters still match.
      var set = getSet(quiz.setId);
      var missedNums = {};
      lastResult.missed.forEach(function (m) { missedNums[m.item.n] = true; });
      var missedQs = set.questions.filter(function (q) { return missedNums[q.n]; });
      startQuiz(quiz.setId, missedQs);
    });
    $('btn-results-home').addEventListener('click', function () { renderHome(); show('home'); });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('Service worker registration failed:', e);
      });
    }

    loadBuiltin().then(renderHome);
    show('home');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
