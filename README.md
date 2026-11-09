# TestRecall

MCQ practice for pharmacy exams — minus the paper. Pick a set, tap your answers, get graded at the end.

![TestRecall logo](icons/icon-512.png)

## What it does

- **Two starter sets baked in** — Naming and Classification of Bacteria (122 questions) and Systematic Classification of Bacteria (60 questions), from Dr Mrs Oboh's PHM 201 lecture notes.
- **Tap to answer** — one question at a time, with a timer, progress bar, flag-for-later and a jump-to-question grid.
- **Shuffled every attempt** — questions and options are shuffled each time, so you're answering, not memorising positions.
- **Auto-graded** — submit (with a confirm step) and get your score plus a review of only the questions you missed, showing your answer vs the correct one. You can also re-practise just the missed ones.
- **Add your own sets** — upload an MCQ PDF and the app reads the questions, options and answer key out of it, then shows you a review screen to check everything (and fix any wrong key) before saving. Or paste questions as text instead.
- **Offline-first PWA** — after the first visit, a service worker caches the app and the PDF reader, so it works with no connection. Your sets and scores live in your browser's local storage; there is no server and no account.

## How to use it

1. Open the app and pick a set.
2. Tap an option to answer, use **Next** / **Previous** to move around, **☆ Flag** to mark one for later, **Grid** to jump to any question.
3. Tap **Submit answers**, confirm, and see your score and the review of what you missed.
4. To add a set: **+ Add a set** → choose a PDF (or paste text) → check the review screen → **Save set**.

## The PDF format (for bots that make your MCQs)

The app can only read **text-based** PDFs (not photos/scans). The format:

- Each question starts a new line as `1. Question text?`, then `2.`, `3.` … in order.
- Four options per question, labelled `A.` `B.` `C.` `D.` — one per line, or two per line (A and B on one line, C and D on the next).
- Exactly one correct answer per question.
- Answer key at the very end under the heading `Answer Key`, in rows of 10: a line of question numbers, then a line of correct letters underneath.
- Don't write `A.` / `B.` / `C.` / `D.` inside question or option text.

A ready-to-send spec with a worked example is in [docs/mcq-pdf-template.pdf](docs/mcq-pdf-template.pdf) — give that file to any bot that makes your MCQ PDFs and tell it to follow the structure exactly.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repo (e.g. `TestRecall`).
2. Repo → **Settings → Pages** → under "Build and deployment", set **Source** to **Deploy from a branch**, branch `main`, folder `/ (root)` → **Save**.
3. Open `https://<your-username>.github.io/TestRecall/` — that's the live app. Send the link to anyone; each person gets their own sets and scores on their own device.

No build step: the files are served as they are from the repo root.

## Files

| File | What it is |
|---|---|
| `index.html` | The app shell — home, quiz, results, add-a-set and review screens |
| `css/style.css` | Dark green + cream styling, mobile-first |
| `js/app.js` | Quiz engine, grading, review, localStorage saving, service worker registration |
| `js/pdf-parser.js` | PDF text extraction (pdf.js) + MCQ text parser |
| `data/naming-classification-bacteria.json` | Starter set, 122 questions |
| `data/systematic-classification-bacteria.json` | Starter set, 60 questions |
| `icons/icon-192.png`, `icons/icon-512.png` | PWA icons (cream question mark + graduation cap on deep green) |
| `manifest.json` | PWA manifest (name TestRecall, deep green theme) |
| `sw.js` | Service worker — caches the app shell and pdf.js for offline use |
| `docs/mcq-pdf-template.pdf` | The PDF format spec to send to bots that make MCQ PDFs |

## Notes on the content

- The Systematic Classification set keeps the lecturer's key for the kidney-shaped question (fusiform). The review screen flags it: strictly, kidney-shaped is **reniform**; fusiform means spindle-shaped.
- Later idea: Cloudflare Worker sync, so sets and scores follow you across devices.
