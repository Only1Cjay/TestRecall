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
      course: 'PHM 201',
    },
    {
      id: 'systematic-classification',
      title: 'Systematic Classification of Bacteria',
      file: 'data/systematic-classification-bacteria.json',
      desc: '60 questions · PHM 201',
      course: 'PHM 201',
    },
  ];

  /* Courses mirror the PRACTICE QUESTIONS folder in Drive. A set's course
     is stored on the set; sets uploaded before courses existed default
     to PHM 201. */
  var COURSES = ['PHM 201', 'PCG', 'PCH 201', 'PCT', 'PIO'];

  /* ---------- storage ---------- */
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (s && typeof s === 'object') return { sets: s.sets || {}, attempts: s.attempts || {}, uploads: s.uploads || [], hiddenStarters: s.hiddenStarters || [] };
    } catch (e) { /* corrupted storage: start fresh */ }
    return { sets: {}, attempts: {}, uploads: [], hiddenStarters: [] };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }
  var state = loadState();

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  /* Wire a listener only if the element exists, so an older cached page
     running newer code degrades instead of dying in init. */
  function on(id, ev, fn) {
    var n = $(id);
    if (n) n.addEventListener(ev, fn);
  }
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
  var screens = ['home', 'course', 'quiz', 'results', 'settings'];
  var currentCourse = null; // course open on the course screen, if any
  var homeQuery = '';
  var courseQuery = '';
  var addCourse = null; // course preselected when the add modal was opened
  function show(name) {
    screens.forEach(function (s) { $('screen-' + s).classList.toggle('hidden', s !== name); });
    var fab = $('btn-add-fab');
    if (fab) fab.classList.toggle('hidden', name !== 'home');
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
    var hidden = state.hiddenStarters || [];
    var list = BUILTIN.filter(function (meta) { return hidden.indexOf(meta.id) === -1; }).map(function (meta) {
      return {
        id: meta.id, title: meta.title, desc: meta.desc, course: meta.course,
        questions: builtinData[meta.id] || null, builtin: true,
      };
    });
    Object.keys(state.sets).forEach(function (id) {
      var s = state.sets[id];
      list.push({ id: id, title: s.title, desc: s.questions.length + ' questions · added ' + fmtDate(s.createdAt), course: s.course || 'PHM 201', questions: s.questions, builtin: false });
    });
    return list;
  }
  function allCourses() {
    var list = COURSES.slice();
    allSets().forEach(function (s) {
      if (s.course && list.indexOf(s.course) === -1) list.push(s.course);
    });
    return list;
  }
  function courseStats(course) {
    var sets = allSets().filter(function (s) { return s.course === course && s.questions; });
    var qs = 0;
    sets.forEach(function (s) { qs += s.questions.length; });
    return { sets: sets.length, questions: qs };
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

  /* ---------- day streak: submitting a quiz on a day counts ---------- */
  var STREAK_KEY = 'testrecall.streak';
  function loadStreak() {
    try {
      var s = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');
      if (s && typeof s.count === 'number') return s;
    } catch (e) {}
    return { lastDate: null, count: 0 };
  }
  function localDayString(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function recordStreak() {
    var s = loadStreak();
    var today = localDayString(new Date());
    if (s.lastDate === today) return s;
    var y = new Date(); y.setDate(y.getDate() - 1);
    s.count = (s.lastDate === localDayString(y)) ? s.count + 1 : 1;
    s.lastDate = today;
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function renderStreak() {
    var s = loadStreak();
    var chip = $('streak-chip');
    if (!chip) return;
    if (s.count >= 1) {
      chip.classList.remove('hidden');
      $('streak-text').textContent = s.count + '-day streak';
    } else {
      chip.classList.add('hidden');
    }
  }

  /* ---------- missed questions, across a whole course ----------
     The pool is the missed questions of the most recent attempt of each
     set in scope — the same definition "Practise missed only" uses for
     one set (wrong or unanswered). Attempts recorded before this was
     added carry no per-question data, so they contribute nothing. */
  function missedPool(courseName) {
    var pool = [];
    allSets().forEach(function (set) {
      if (!set.questions) return;
      if (courseName && set.course !== courseName) return;
      var atts = attemptsFor(set.id);
      if (!atts.length) return;
      var last = atts[atts.length - 1];
      if (!last.missed || !last.missed.length) return;
      var byN = {};
      set.questions.forEach(function (q) { byN[q.n] = q; });
      last.missed.forEach(function (n) {
        var q = byN[n];
        if (q) pool.push({ n: q.n, q: q.q, options: q.options.slice(), answer: q.answer, setId: set.id });
      });
    });
    return pool;
  }
  function missedCount(courseName) { return missedPool(courseName).length; }

  /* ---------- theme: light-first, toggle saved in localStorage ---------- */
  var THEME_KEY = 'testrecall.theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0D1526' : '#EAF1F9');
    var sl = $('settings-theme-label');
    if (sl) sl.textContent = t === 'dark' ? 'Light' : 'Dark';
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  /* ---------- offline toast ---------- */
  var toastTimer = null;
  function showToast(msg, sticky) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (!sticky) toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3500);
  }

  /* ---------- generic confirm (submit, delete, leave) ---------- */
  var confirmCallback = null;
  function askConfirm(opts) {
    $('confirm-title').textContent = opts.title || 'Are you sure?';
    $('confirm-text').textContent = opts.text || '';
    $('confirm-cancel').textContent = opts.cancelLabel || 'Cancel';
    $('confirm-submit').textContent = opts.confirmLabel || 'Confirm';
    confirmCallback = opts.onConfirm || null;
    $('confirm-modal').classList.remove('hidden');
  }
  function closeConfirm() {
    $('confirm-modal').classList.add('hidden');
    confirmCallback = null;
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
    var banner = $('install-banner');
    if (banner) banner.classList.remove('hidden');
    var fab = $('btn-add-fab');
    if (fab) fab.classList.add('fab-raised');
  }
  function hideInstallBanner() {
    var banner = $('install-banner');
    if (banner) banner.classList.add('hidden');
    var fab = $('btn-add-fab');
    if (fab) fab.classList.remove('fab-raised');
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
    var restore = $('restore-starters-card');
    if (restore) restore.classList.toggle('hidden', !(state.hiddenStarters && state.hiddenStarters.length));
    var list = $('uploads-list');
    if (!list) return;
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

  /* ---------- home: course folders, search, missed review ---------- */
  function missedCardEl(courseName) {
    var count = missedCount(courseName);
    var card = el('div', 'set-card missed-card');
    card.appendChild(el('div', 'set-title', 'Review everything I missed'));
    if (count > 0) {
      card.appendChild(el('div', 'set-desc', count + ' missed question' + (count === 1 ? '' : 's') +
        (courseName ? ' in ' + courseName : ' across your courses') + ', from your latest attempts.'));
      var btn = el('button', 'btn primary', 'Start missed review');
      btn.addEventListener('click', function () { askStartMissed(courseName); });
      card.appendChild(btn);
    } else {
      card.appendChild(el('div', 'set-desc', 'No missed questions yet — finish a quiz and the ones you miss will gather here.'));
    }
    return card;
  }

  function setCard(set, showCourse) {
    var card = el('div', 'set-card');
    var head = el('div', 'set-head');
    head.appendChild(el('div', 'set-title', set.title));
    var del = el('button', 'icon-btn', '✕');
    del.title = 'Delete this set';
    del.setAttribute('aria-label', 'Delete ' + set.title);
    del.addEventListener('click', function (ev) {
      ev.stopPropagation();
      askConfirm({
        title: 'Delete this set?',
        text: 'Delete "' + set.title + '"? Your scores for it go too.',
        cancelLabel: 'Keep it',
        confirmLabel: 'Delete',
        onConfirm: function () { deleteSet(set.id); },
      });
    });
    head.appendChild(del);
    card.appendChild(head);
    card.appendChild(el('div', 'set-desc', set.desc));
    var stats = el('div', 'set-stats');
    if (showCourse) stats.appendChild(el('span', 'pill', set.course));
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
      if (!set.questions) {
        loadBuiltin().then(function () { renderHome(); if (currentCourse) renderCourse(currentCourse); });
        return;
      }
      askStart(set.id, null);
    });
    card.appendChild(btn);
    return card;
  }

  function courseCard(course) {
    var st = courseStats(course);
    var card = el('div', 'set-card course-card');
    var head = el('div', 'set-head');
    head.appendChild(el('div', 'set-title', course));
    head.appendChild(el('span', 'course-chev', '›'));
    card.appendChild(head);
    card.appendChild(el('div', 'set-desc', st.sets + (st.sets === 1 ? ' set' : ' sets') + ' · ' + st.questions + ' questions'));
    card.addEventListener('click', function () { openCourse(course); });
    return card;
  }

  function deleteSet(id) {
    var set = getSet(id);
    if (!set) return;
    if (set.builtin) {
      // Baked-in sets only hide on this device; the files stay in the repo.
      state.hiddenStarters = state.hiddenStarters || [];
      if (state.hiddenStarters.indexOf(id) === -1) state.hiddenStarters.push(id);
    } else {
      delete state.sets[id];
    }
    delete state.attempts[id];
    saveState();
    renderHome();
    if (currentCourse) renderCourse(currentCourse);
  }

  function renderHome() {
    renderStreak();
    var missedBox = $('missed-card-home');
    if (missedBox) {
      missedBox.innerHTML = '';
      missedBox.appendChild(missedCardEl(null));
    }
    renderHomeList();
  }
  function renderHomeList() {
    var list = $('set-list');
    if (!list) return;
    list.innerHTML = '';
    var q = (homeQuery || '').trim().toLowerCase();
    if (q) {
      var matches = allSets().filter(function (s) { return s.title.toLowerCase().indexOf(q) !== -1; });
      if (!matches.length) {
        list.appendChild(el('p', 'sub', 'No sets match "' + homeQuery.trim() + '".'));
        return;
      }
      matches.forEach(function (s) { list.appendChild(setCard(s, true)); });
    } else {
      allCourses().forEach(function (c) { list.appendChild(courseCard(c)); });
    }
  }

  function openCourse(course) {
    currentCourse = course;
    courseQuery = '';
    var input = $('course-search');
    if (input) input.value = '';
    renderCourse(course);
    show('course');
  }
  function renderCourse(course) {
    currentCourse = course;
    var st = courseStats(course);
    $('course-title').textContent = course;
    $('course-sub').textContent = st.sets + (st.sets === 1 ? ' set' : ' sets') + ' · ' + st.questions + ' questions';
    var missedBox = $('missed-card-course');
    if (missedBox) {
      missedBox.innerHTML = '';
      missedBox.appendChild(missedCardEl(course));
    }
    renderCourseList();
  }
  function renderCourseList() {
    var list = $('course-set-list');
    if (!list || !currentCourse) return;
    list.innerHTML = '';
    var q = (courseQuery || '').trim().toLowerCase();
    var sets = allSets().filter(function (s) { return s.course === currentCourse; });
    if (q) sets = sets.filter(function (s) { return s.title.toLowerCase().indexOf(q) !== -1; });
    if (!sets.length) {
      list.appendChild(el('p', 'sub', q ? 'No sets in ' + currentCourse + ' match "' + courseQuery.trim() + '".' : 'No sets in this course yet — upload one below.'));
      return;
    }
    sets.forEach(function (s) { list.appendChild(setCard(s, false)); });
  }

  /* ---------- quiz ---------- */
  var quiz = null; // {setId, title, items, pos, picked{}, flagged:Set, startedAt, timerId, mode, isMissedReview, saveAttempt}

  function startQuiz(opts) {
    // opts: {setId, subset, timeLimit, mode, isMissedReview, title}
    var set = opts.isMissedReview ? null : getSet(opts.setId);
    if (!opts.isMissedReview && (!set || !set.questions)) return;
    var pool = opts.subset || (set && set.questions);
    if (!pool || !pool.length) return;
    var items = shuffle(pool.slice()).map(function (q) {
      var opts2 = shuffle(q.options.map(function (text, i) {
        return { text: text, letter: 'ABCD'[i] };
      }));
      return { n: q.n, q: q.q, options: opts2, answer: q.answer, setId: q.setId || (set && set.id) };
    });
    quiz = {
      setId: opts.setId || null, title: opts.title || (set && set.title), items: items, pos: 0,
      picked: {}, flagged: {}, startedAt: Date.now(), elapsed: 0, timerId: null,
      timeLimit: opts.timeLimit || null, mode: opts.mode || 'exam',
      isMissedReview: !!opts.isMissedReview, saveAttempt: !opts.isMissedReview,
    };
    $('quiz-title').textContent = quiz.title;
    var timerEl = $('quiz-timer');
    timerEl.classList.remove('timer-low');
    timerEl.textContent = quiz.timeLimit ? fmtTime(quiz.timeLimit) : '00:00';
    quiz.timerId = setInterval(function () {
      quiz.elapsed = Math.floor((Date.now() - quiz.startedAt) / 1000);
      if (quiz.timeLimit) {
        var left = quiz.timeLimit - quiz.elapsed;
        timerEl.textContent = fmtTime(Math.max(0, left));
        timerEl.classList.toggle('timer-low', left <= 60);
        if (left <= 0) { endOnTimeout(); return; }
      } else {
        timerEl.textContent = fmtTime(quiz.elapsed);
      }
    }, 1000);
    renderQuestion();
    show('quiz');
  }

  function endOnTimeout() {
    if (!quiz) return;
    clearInterval(quiz.timerId);
    $('grid-backdrop').classList.add('hidden');
    $('confirm-modal').classList.add('hidden');
    submitQuiz();
    showToast("Time's up — your answers were submitted.", false);
  }

  /* ---------- start choice: mode + timer, one popup before each session ---------- */
  var pendingQuiz = null; // {setId, subset, title, isMissedReview} waiting for the start choice
  var pendingMode = 'exam';
  function askStart(setId, subset) {
    var set = getSet(setId);
    if (!set) return;
    pendingQuiz = { setId: setId, subset: subset || null, title: set.title, isMissedReview: false };
    openStartModal();
  }
  function askStartMissed(courseName) {
    var pool = missedPool(courseName);
    if (!pool.length) return;
    pendingQuiz = {
      setId: null, subset: pool,
      title: courseName ? 'Missed questions — ' + courseName : 'Missed questions — all courses',
      isMissedReview: true,
    };
    openStartModal();
  }
  function setMode(mode) {
    pendingMode = mode;
    $('mode-exam').classList.toggle('selected', mode === 'exam');
    $('mode-instant').classList.toggle('selected', mode === 'instant');
  }
  function setUntimed(active) {
    var chip = $('start-untimed');
    if (chip) chip.classList.toggle('active', !!active);
  }
  function openStartModal() {
    $('start-modal-set').textContent = pendingQuiz.title;
    $('start-minutes').value = '';
    $('start-error').classList.add('hidden');
    setMode('exam');
    setUntimed(true);
    $('start-modal').classList.remove('hidden');
  }
  function closeStartModal() {
    $('start-modal').classList.add('hidden');
    pendingQuiz = null;
  }

  function answeredCount() { return Object.keys(quiz.picked).length; }

  function renderQuestion() {
    var item = quiz.items[quiz.pos];
    $('quiz-qnum').textContent = 'Question ' + (quiz.pos + 1) + ' of ' + quiz.items.length;
    var gl = $('quiz-grid-label');
    if (gl) gl.textContent = (quiz.pos + 1) + '/' + quiz.items.length;
    var an = $('quiz-answered');
    if (an) an.textContent = '• Answered ' + answeredCount();
    $('quiz-progress').style.width = Math.round((answeredCount() / quiz.items.length) * 100) + '%';
    $('quiz-qtext').textContent = item.q;
    var flagBtn = $('quiz-flag');
    var isFlagged = !!quiz.flagged[quiz.pos];
    flagBtn.classList.toggle('active', isFlagged);
    flagBtn.setAttribute('aria-label', isFlagged ? 'Flagged — tap to unflag' : 'Flag for later');
    flagBtn.setAttribute('title', isFlagged ? 'Flagged — tap to unflag' : 'Flag for later');

    var box = $('quiz-options');
    box.innerHTML = '';
    var pickedIdx = quiz.picked[quiz.pos];
    var marked = quiz.mode === 'instant' && pickedIdx != null;
    item.options.forEach(function (opt, i) {
      var b = el('button', 'option');
      var isPicked = pickedIdx === i;
      var isCorrectOpt = opt.letter === item.answer;
      if (marked) {
        if (isCorrectOpt) b.classList.add('correct');
        else if (isPicked) b.classList.add('wrong');
      } else if (isPicked) {
        b.classList.add('selected');
      }
      b.appendChild(el('span', 'opt-letter', 'ABCD'[i]));
      b.appendChild(el('span', 'opt-text', opt.text));
      if (marked && isCorrectOpt) b.appendChild(el('span', 'opt-check', '✓'));
      b.addEventListener('click', function () {
        if (marked) return; // instant marking locks the question once answered
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
    if (!grid) return;
    var st = grid.scrollTop;
    grid.innerHTML = '';
    quiz.items.forEach(function (_, i) {
      var b = el('button', 'grid-num');
      b.textContent = i + 1;
      if (i === quiz.pos) b.classList.add('current');
      if (quiz.picked[i] != null) b.classList.add('answered');
      if (quiz.flagged[i]) b.classList.add('flagged');
      b.addEventListener('click', function () {
        quiz.pos = i;
        $('grid-backdrop').classList.add('hidden');
        renderQuestion();
      });
      grid.appendChild(b);
    });
    grid.scrollTop = st;
  }

  function grade() {
    var score = 0;
    var missed = [];
    var all = [];
    quiz.items.forEach(function (item, i) {
      var pickedIdx = quiz.picked[i];
      var pickedLetter = pickedIdx != null ? item.options[pickedIdx].letter : null;
      var correct = pickedLetter === item.answer;
      if (correct) score++;
      else missed.push({ item: item, pickedLetter: pickedLetter });
      all.push({ item: item, pickedLetter: pickedLetter, correct: correct, flagged: !!quiz.flagged[i] });
    });
    return { score: score, total: quiz.items.length, missed: missed, all: all };
  }

  function submitQuiz() {
    var result = grade();
    clearInterval(quiz.timerId);
    var seconds = Math.floor((Date.now() - quiz.startedAt) / 1000);
    if (quiz.saveAttempt) {
      var attempt = { date: Date.now(), score: result.score, total: result.total, seconds: seconds, missed: result.missed.map(function (m) { return m.item.n; }) };
      if (!state.attempts[quiz.setId]) state.attempts[quiz.setId] = [];
      state.attempts[quiz.setId].push(attempt);
      saveState();
    }
    recordStreak();
    renderResults(result, seconds);
    show('results');
  }

  function askSubmit() {
    var unanswered = quiz.items.length - answeredCount();
    askConfirm({
      title: 'Submit your answers?',
      text: unanswered > 0
        ? 'You answered ' + answeredCount() + ' of ' + quiz.items.length + ' questions. ' + unanswered + ' still unanswered — submit anyway?'
        : 'You answered all ' + quiz.items.length + ' questions. Submit and see your score?',
      cancelLabel: 'Keep answering',
      confirmLabel: 'Submit',
      onConfirm: function () { submitQuiz(); },
    });
  }

  /* ---------- results ---------- */
  var lastResult = null;
  var resultsFilter = 'all';
  var HEAT_PER_PAGE = 25;
  var REVIEW_PER_PAGE = 20;
  var heatPage = 1;
  var reviewPage = 1;
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

    $('missed-title').textContent = 'Review';
    resultsFilter = 'all';
    heatPage = 1;
    reviewPage = 1;
    renderHeatmap(result);
    renderResultsList(result);
    updateFilterCounts(result);
    setReviewFilter('all');

    if (quiz.isMissedReview) {
      // A missed review spans several sets, so there is no single set to
      // retake or to practise missed-only from.
      $('btn-retry-missed').classList.add('hidden');
      $('btn-retake').classList.add('hidden');
    } else {
      $('btn-retry-missed').classList.toggle('hidden', result.missed.length === 0);
      $('btn-retake').classList.remove('hidden');
    }
  }

  function renderHeatmap(result) {
    var heat = $('results-heatmap');
    if (!heat) return;
    heat.innerHTML = '';
    var pages = Math.max(1, Math.ceil(result.all.length / HEAT_PER_PAGE));
    if (heatPage > pages) heatPage = pages;
    var start = (heatPage - 1) * HEAT_PER_PAGE;
    var end = Math.min(start + HEAT_PER_PAGE, result.all.length);
    for (var idx = start; idx < end; idx++) {
      (function (i) {
        var entry = result.all[i];
        var b = el('button', 'heat-num');
        b.textContent = i + 1;
        b.classList.add(entry.correct ? 'correct' : 'wrong');
        if (entry.flagged) b.classList.add('flagged');
        b.setAttribute('aria-label', 'Question ' + (i + 1) +
          (entry.correct ? ' — correct' : ' — missed') +
          (entry.flagged ? ' — flagged' : ''));
        b.addEventListener('click', function () {
          setReviewFilter('all');
          goToReviewPageFor(i);
          var card = $('review-card-' + i);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        heat.appendChild(b);
      })(idx);
    }
    updateHeatPager(result.all.length);
  }
  function updateHeatPager(total) {
    var pages = Math.max(1, Math.ceil(total / HEAT_PER_PAGE));
    var pager = $('heat-pager');
    if (pager) pager.classList.toggle('hidden', total <= HEAT_PER_PAGE);
    var label = $('heat-label');
    if (label) label.textContent = 'Page ' + heatPage + ' of ' + pages;
    var prev = $('heat-prev');
    if (prev) prev.disabled = heatPage <= 1;
    var next = $('heat-next');
    if (next) next.disabled = heatPage >= pages;
  }
  function goToReviewPageFor(idx) {
    reviewPage = Math.floor(idx / REVIEW_PER_PAGE) + 1;
    applyReviewFilter();
  }

  function renderResultsList(result) {
    var box = $('missed-list');
    if (!box) return;
    box.innerHTML = '';
    result.all.forEach(function (entry, idx) {
      var item = entry.item;
      var card = el('div', 'miss-card');
      card.id = 'review-card-' + idx;
      card.setAttribute('data-status', entry.correct ? 'correct' : 'failed');
      card.setAttribute('data-flagged', entry.flagged ? '1' : '0');
      var head = el('div', 'miss-head');
      head.appendChild(el('div', 'miss-q', (idx + 1) + '. ' + item.q));
      head.appendChild(el('span', 'miss-status ' + (entry.correct ? 'ok' : 'bad'),
        entry.correct ? 'Correct' : (entry.pickedLetter === null ? 'Unanswered' : 'Missed')));
      if (entry.flagged) head.appendChild(el('span', 'miss-status flagged', 'Flagged'));
      card.appendChild(head);
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
  }

  function updateFilterCounts(result) {
    var flagged = 0;
    result.all.forEach(function (e) { if (e.flagged) flagged++; });
    setTabLabel('all', 'All', result.total);
    setTabLabel('failed', 'Failed', result.missed.length);
    setTabLabel('correct', 'Correct', result.score);
    setTabLabel('flagged', 'Flagged', flagged);
  }
  function setTabLabel(filter, label, n) {
    var b = document.querySelector('#review-filter button[data-filter="' + filter + '"]');
    if (b) b.textContent = label + ' (' + n + ')';
  }
  function setReviewFilter(f) {
    resultsFilter = f;
    reviewPage = 1;
    document.querySelectorAll('#review-filter button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-filter') === f);
    });
    applyReviewFilter();
  }
  function applyReviewFilter() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('#missed-list .miss-card'));
    var shown = cards.filter(function (card) {
      return resultsFilter === 'all' ||
        (resultsFilter === 'failed' && card.getAttribute('data-status') === 'failed') ||
        (resultsFilter === 'correct' && card.getAttribute('data-status') === 'correct') ||
        (resultsFilter === 'flagged' && card.getAttribute('data-flagged') === '1');
    });
    var pages = Math.max(1, Math.ceil(shown.length / REVIEW_PER_PAGE));
    if (reviewPage > pages) reviewPage = pages;
    if (reviewPage < 1) reviewPage = 1;
    var start = (reviewPage - 1) * REVIEW_PER_PAGE;
    var end = Math.min(start + REVIEW_PER_PAGE, shown.length);
    cards.forEach(function (card) { card.classList.add('hidden'); });
    shown.slice(start, end).forEach(function (card) { card.classList.remove('hidden'); });
    var empty = $('review-empty');
    if (empty) empty.classList.toggle('hidden', shown.length !== 0);
    updateReviewPager(shown.length);
  }
  function updateReviewPager(total) {
    var pages = Math.max(1, Math.ceil(total / REVIEW_PER_PAGE));
    var pager = $('review-pager');
    if (pager) pager.classList.toggle('hidden', total <= REVIEW_PER_PAGE);
    var label = $('review-label');
    if (label) label.textContent = 'Page ' + reviewPage + ' of ' + pages;
    var prev = $('review-prev');
    if (prev) prev.disabled = reviewPage <= 1;
    var next = $('review-next');
    if (next) next.disabled = reviewPage >= pages;
  }

  /* ---------- add a set: PDF + paste ---------- */
  var pendingImport = null; // {title, questions, warnings}

  function openAddModal(course) {
    addCourse = course || null;
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
    addCourse = null;
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
  function populateCourseSelect() {
    var sel = $('review-course');
    if (!sel) return;
    sel.innerHTML = '';
    allCourses().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    var oNew = document.createElement('option');
    oNew.value = '__new'; oNew.textContent = 'New course…';
    sel.appendChild(oNew);
    var pre = addCourse || 'PHM 201';
    sel.value = allCourses().indexOf(pre) !== -1 ? pre : 'PHM 201';
    var nw = $('review-course-new');
    if (nw) { nw.classList.add('hidden'); nw.value = ''; }
  }
  function openReview(suggestedTitle, parsed, sourceFile) {
    pendingImport = {
      title: suggestedTitle,
      sourceFile: sourceFile || null,
      questions: parsed.questions.map(function (q) {
        return { n: q.n, q: q.q, options: q.options.slice(), answer: q.answer };
      }),
      warnings: parsed.warnings,
    };
    populateCourseSelect();
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
    var course = $('review-course').value;
    if (course === '__new') course = $('review-course-new').value.trim();
    if (!course) course = addCourse || 'PHM 201';
    var id = 'user-' + Date.now();
    state.sets[id] = { title: title, questions: pendingImport.questions, createdAt: Date.now(), course: course };
    if (pendingImport.sourceFile) {
      state.uploads = state.uploads || [];
      state.uploads.unshift({ name: pendingImport.sourceFile, title: title, at: Date.now() });
      if (state.uploads.length > 100) state.uploads.length = 100;
    }
    saveState();
    pendingImport = null;
    closeAddModal();
    renderHome();
    openCourse(course);
  }

  /* ---------- wire up ---------- */
  function init() {
    /* ---------- theme ---------- */
    var savedTheme = 'light';
    try { savedTheme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(savedTheme);
    on('theme-toggle', 'click', toggleTheme);
    on('settings-theme', 'click', toggleTheme);

    /* ---------- hamburger menu ---------- */
    var menu = $('menu-dropdown');
    var menuBtn = $('menu-btn');
    function closeMenu() {
      if (!menu) return;
      menu.classList.add('hidden');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    }
    on('menu-btn', 'click', function (ev) {
      ev.stopPropagation();
      if (!menu) return;
      var open = menu.classList.toggle('hidden');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', String(!open));
      if (!open) { var hint = $('menu-install-hint'); if (hint) hint.classList.add('hidden'); }
    });
    document.addEventListener('click', function (ev) {
      if (menu && !menu.classList.contains('hidden') && !menu.contains(ev.target) && ev.target !== menuBtn) closeMenu();
    });
    on('menu-settings', 'click', function () {
      closeMenu();
      renderSettings();
      show('settings');
    });
    on('menu-install', 'click', function () {
      if (promptInstall()) { closeMenu(); return; }
      $('menu-install-hint').classList.remove('hidden');
    });
    on('btn-settings-home', 'click', function () { renderHome(); show('home'); });

    /* ---------- install banner ---------- */
    on('install-accept', 'click', function () { promptInstall(); });
    on('install-dismiss', 'click', function () {
      hideInstallBanner();
      try { localStorage.setItem(INSTALL_KEY, '1'); } catch (e) {}
    });
    showInstallBanner();

    /* ---------- offline / online toast ---------- */
    window.addEventListener('offline', function () { showToast("You're offline — your saved sets still work.", true); });
    window.addEventListener('online', function () { showToast('Back online.', false); });
    if (!navigator.onLine) showToast("You're offline — your saved sets still work.", true);

    on('btn-add-fab', 'click', function () { openAddModal(null); });
    on('btn-close-add', 'click', closeAddModal);
    on('add-modal', 'click', function (ev) { if (ev.target === $('add-modal')) closeAddModal(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!$('add-modal').classList.contains('hidden')) closeAddModal();
      else if (!$('start-modal').classList.contains('hidden')) closeStartModal();
      else if (!$('grid-backdrop').classList.contains('hidden')) $('grid-backdrop').classList.add('hidden');
      else if (!$('confirm-modal').classList.contains('hidden')) closeConfirm();
    });
    on('tab-pdf', 'click', function () { setAddTab('pdf'); });
    on('tab-paste', 'click', function () { setAddTab('paste'); });
    on('pdf-input', 'change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) handlePdfFile(f);
      ev.target.value = '';
    });
    on('btn-parse-paste', 'click', handlePasteText);
    /* ---------- home search + course screen ---------- */
    on('home-search', 'input', function (ev) { homeQuery = ev.target.value; renderHomeList(); });
    on('course-search', 'input', function (ev) { courseQuery = ev.target.value; renderCourseList(); });
    on('btn-course-back', 'click', function () { currentCourse = null; renderHome(); show('home'); });
    on('course-upload', 'click', function () { openAddModal(currentCourse); });
    on('btn-restore-starters', 'click', function () {
      state.hiddenStarters = [];
      saveState();
      renderSettings();
      renderHome();
    });

    /* ---------- review course select ---------- */
    on('review-course', 'change', function () {
      $('review-course-new').classList.toggle('hidden', $('review-course').value !== '__new');
    });
    on('btn-review-cancel', 'click', showAddPanel);
    on('btn-review-save', 'click', saveImport);

    on('quiz-flag', 'click', function () {
      quiz.flagged[quiz.pos] = !quiz.flagged[quiz.pos];
      renderQuestion();
    });
    on('quiz-prev', 'click', function () {
      if (quiz.pos > 0) { quiz.pos--; renderQuestion(); }
    });
    on('quiz-next', 'click', function () {
      if (quiz.pos < quiz.items.length - 1) { quiz.pos++; renderQuestion(); }
      else askSubmit();
    });
    on('quiz-grid-btn', 'click', function () {
      renderGrid();
      var backdrop = $('grid-backdrop');
      backdrop.classList.toggle('hidden');
      if (!backdrop.classList.contains('hidden')) {
        var cur = backdrop.querySelector('.grid-num.current');
        var nums = $('quiz-grid');
        if (cur && nums && cur.offsetTop != null) {
          nums.scrollTop = Math.max(0, cur.offsetTop - nums.clientHeight / 2 + cur.offsetHeight / 2);
        }
      }
    });
    on('grid-close', 'click', function () { $('grid-backdrop').classList.add('hidden'); });
    on('grid-backdrop', 'click', function (ev) { if (ev.target === $('grid-backdrop')) $('grid-backdrop').classList.add('hidden'); });
    on('quiz-submit', 'click', askSubmit);
    on('quiz-exit', 'click', function () {
      askConfirm({
        title: 'Leave this attempt?',
        text: 'Your answers so far will not be saved.',
        cancelLabel: 'Stay',
        confirmLabel: 'Leave',
        onConfirm: function () {
          clearInterval(quiz.timerId);
          quiz = null;
          renderHome();
          show('home');
        },
      });
    });
    on('confirm-cancel', 'click', closeConfirm);
    on('confirm-submit', 'click', function () {
      var cb = confirmCallback;
      closeConfirm();
      if (cb) cb();
    });

    /* ---------- start choice modal (mode + timer) ---------- */
    on('mode-exam', 'click', function () { setMode('exam'); });
    on('mode-instant', 'click', function () { setMode('instant'); });
    on('start-minutes', 'input', function (ev) { setUntimed(ev.target.value.trim() === ''); });
    on('start-untimed', 'click', function () {
      $('start-minutes').value = '';
      $('start-error').classList.add('hidden');
      setUntimed(true);
    });
    on('start-begin', 'click', function () {
      if (!pendingQuiz) return;
      var minsVal = $('start-minutes').value.trim();
      var timeLimit = null;
      if (minsVal !== '') {
        var mins = parseInt(minsVal, 10);
        if (isNaN(mins) || mins < 1 || mins > 600) {
          $('start-error').classList.remove('hidden');
          return;
        }
        timeLimit = mins * 60;
      }
      var pq = pendingQuiz;
      closeStartModal();
      startQuiz({
        setId: pq.setId, subset: pq.subset, timeLimit: timeLimit,
        mode: pendingMode, isMissedReview: pq.isMissedReview, title: pq.title,
      });
    });
    on('start-close', 'click', closeStartModal);
    on('start-modal', 'click', function (ev) { if (ev.target === $('start-modal')) closeStartModal(); });

    document.querySelectorAll('#review-filter button').forEach(function (b) {
      b.addEventListener('click', function () { setReviewFilter(b.getAttribute('data-filter')); });
    });
    on('heat-prev', 'click', function () { if (lastResult && heatPage > 1) { heatPage--; renderHeatmap(lastResult); } });
    on('heat-next', 'click', function () { if (lastResult && heatPage < Math.ceil(lastResult.all.length / HEAT_PER_PAGE)) { heatPage++; renderHeatmap(lastResult); } });
    on('review-prev', 'click', function () { if (reviewPage > 1) { reviewPage--; applyReviewFilter(); } });
    on('review-next', 'click', function () { reviewPage++; applyReviewFilter(); });
    on('btn-retake', 'click', function () { askStart(quiz.setId, null); });
    on('btn-retry-missed', 'click', function () {
      // Rebuild from the original set questions (original option order),
      // not the shuffled quiz items, so the answer letters still match.
      var set = getSet(quiz.setId);
      var missedNums = {};
      lastResult.missed.forEach(function (m) { missedNums[m.item.n] = true; });
      var missedQs = set.questions.filter(function (q) { return missedNums[q.n]; });
      askStart(quiz.setId, missedQs);
    });
    on('btn-results-home', 'click', function () { renderHome(); show('home'); });

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
