# TestRecall

MCQ practice for pharmacy exams — minus the paper. Pick a set to start. Questions and options shuffle every attempt, so you learn the answers, not the order.

![TestRecall logo](icons/icon.svg)

## What it does

- **Two starter sets baked in** — Naming and Classification of Bacteria (122 questions) and Systematic Classification of Bacteria (60 questions), from Dr Mrs Oboh's PHM 201 lecture notes. Both live under **PHM 201**, and either can be deleted from its card (they hide on your device only — bring them back from Settings → Restore starter sets).
- **Course folders** — the home screen shows your courses, each card with its full name ("PHM 201 · Microbiology"); tap one to see its sets. Only courses with a set show up — empty ones stay hidden, and the circular (+) at the top right adds a course (code + optional full name). Uploading a set asks which course it belongs to, and you can type a new course name.
- **Review everything missed** — a blue card on the home screen and on each course screen gathers the missed questions from your latest attempt of every set in scope into one mixed session. Tap the × on the card to dismiss it for now; it comes back on its own when your missed count changes after a quiz.
- **Day streak** — a small flame chip on the home screen ("N-day streak · keep it going") counts the days in a row you've submitted a quiz.
- **Search** — find a set by name, on the home screen or inside a course.
- **Tap to answer** — one question at a time, with an optional timer, progress bar, flag-for-later and a jump-to-question grid. Before each set you pick a timer (custom minutes or Untimed) and a mode — Exam simulation, or Instant marking, which marks each tap green/red, reveals the correct answer and locks the question.
- **Shuffled every attempt** — questions and options are shuffled each time, so you're answering, not memorising positions.
- **Auto-graded** — submit (with a confirm step) and get your score plus a review of every question: a colour heatmap (green = correct, red = missed, amber outline = flagged), filter tabs for All / Failed / Correct / Flagged, and pages of 20 questions at a time. You can also re-practise just the missed ones.
- **Add your own sets** — tap the floating (+) button to open the add-a-set modal, upload an MCQ PDF and the app reads the questions, options and answer key out of it, then shows you a review screen to check everything (and fix any wrong key) before saving. Or paste questions as text instead.
- **Autosave + resume** — an in-progress quiz saves on every answer, flag or move, so if you leave and come back it offers to resume at the same question with the same time left.
- **Edit and manage sets** — tap the pen on a set card to rename it, change any answer, or remove a question. Uploaded sets can be deleted; starter sets hide per device and can be restored in Settings. Search sets from home or inside a course.
- **Offline-first PWA** — after the first visit, a service worker caches the app and the PDF reader, so it works with no connection. Your sets and scores live in your browser's local storage; there is no server and no account. Install it from the banner or the menu for an app icon on your home screen, and a toast tells you when you're offline.
- **Settings** — switch light/dark theme from the header or Settings, see the PDFs you've uploaded, grouped by day, restore hidden starter sets, and check the app version in Settings → About.

## How to use it

1. Open the app and pick a course, then a set. Or search for a set by name.
2. Before it starts, a popup asks how you want to practise — **Exam simulation** or **Instant marking** — and whether you want a timer. Tap an option to answer, use **Next** / **Previous** to move around, **☆ Flag** to mark one for later, **Grid** to jump to any question.
3. Tap **Submit answers**, confirm, and see your score, the heatmap, and the review. Use the tabs to look at only the ones you failed or flagged.
4. To add a set: tap the floating **(+)** button → choose a PDF (or paste text) → check the review screen → **Save set**.

## The PDF format (for bots that make your MCQs)

The app can only read **text-based** PDFs (not photos/scans). The format:

- Each question starts a new line as `1. Question text?`, then `2.`, `3.` … in order.
- Four options per question, labelled `A.` `B.` `C.` `D.` — one per line, or two per line (A and B on one line, C and D on the next).
- Exactly one correct answer per question.
- Answer key at the very end under the heading `Answer Key`, in rows of 10: a line of question numbers, then a line of correct letters underneath.
- Don't write `A.` / `B.` / `C.` / `D.` inside question or option text.

A ready-to-send spec with a worked example is in [docs/mcq-format-guide.md](docs/mcq-format-guide.md) — give that file to any bot that makes your MCQ PDFs and tell it to follow the structure exactly.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repo (e.g. `TestRecall`).
2. Repo → **Settings → Pages** → under "Build and deployment", set **Source** to **Deploy from a branch**, branch `main`, folder `/ (root)` → **Save**.
3. Open `https://<your-username>.github.io/TestRecall/` — that's the live app. Send the link to anyone; each person gets their own sets and scores on their own device.

No build step: the files are served as they are from the repo root.

## Files

| File | What it is |
|---|---|
| `index.html` | The app shell — home, quiz, results and settings screens, plus an add-a-set modal |
| `css/style.css` | Ocean Blue styling (Plus Jakarta Sans throughout), mobile-first |
| `js/app.js` | Quiz engine, grading, heatmap + filter tabs + pagination, install prompt, offline toast, localStorage saving, autosave + resume, edit-set, instant marking, service worker registration |
| `js/pdf-parser.js` | PDF text extraction (pdf.js) + MCQ text parser |
| `data/naming-classification-bacteria.json` | Starter set, 122 questions |
| `data/systematic-classification-bacteria.json` | Starter set, 60 questions |
| `icons/icon.svg` | PWA icon (bold question mark on a blue gradient) |
| `manifest.json` | PWA manifest (name TestRecall, theme #EAF1F9) |
| `sw.js` | Service worker — network-first for the app shell so new versions reach you, cache-first for pdf.js, for offline use |
| `docs/mcq-format-guide.md` | The PDF format spec to send to bots that make MCQ PDFs |

## Notes on the content

- The Systematic Classification set keeps the lecturer's key for the kidney-shaped question (fusiform). The review screen flags it: strictly, kidney-shaped is **reniform**; fusiform means spindle-shaped.
- Later idea: Cloudflare Worker sync, so sets and scores follow you across devices.
