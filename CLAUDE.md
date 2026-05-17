# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A zero-dependency static math quiz app for advanced 2nd-grade kids. Deployed on GitHub Pages at `https://pavanpalakshamurthy.github.io/math-session/`. No build step, no package manager, no framework.

## Development

Quiz pages use `fetch()` to load question data, so you need an HTTP server for local testing:
```bash
python3 -m http.server
# then open http://localhost:8000/quiz.html?subject=addition
```

`index.html` and `parents.html` open directly from `file://` without a server.

Deploy by pushing to `main` — GitHub Pages serves from the root automatically.

To validate JavaScript syntax:
```bash
node -e "require('fs').readdirSync('js').forEach(f => { new Function(require('fs').readFileSync('js/'+f,'utf8')); console.log('js/'+f+': OK'); })"
```

## File structure

```
/
├── index.html        Landing page — links to quiz.html?subject=<id>
├── quiz.html         Single quiz template for all 7 subjects
├── parents.html      Parent dashboard (PIN-protected)
├── css/
│   └── main.css      All shared styles
├── js/
│   ├── quiz.js       Quiz engine (fetch, render, score, timer, localStorage)
│   └── parents.js    Parent dashboard logic (PIN, Canvas charts, localStorage)
└── data/
    ├── subjects.json Subject metadata (cards on landing page)
    ├── addition.json
    ├── subtraction.json
    ├── multiplication.json
    ├── division.json
    ├── fractions.json
    ├── decimals.json
    └── percentages.json
```

## Architecture

**Quiz flow**: `quiz.html?subject=addition` → `quiz.js` reads `?subject=` param → fetches `data/addition.json` → applies theming via CSS custom properties → runs quiz engine.

**Per-subject theming**: `quiz.js` contains a `SUBJECT_META` object with `primaryColor`, `gradientEnd`, `storageKey`, and `label` for each subject. Colors are applied dynamically via `document.documentElement.style.setProperty('--primary', ...)` and inline style on `<header>`.

**Data format** — each `data/{subject}.json` is a JSON array:
```json
[
  {
    "level": "easy | medium | hard",
    "text": "Word problem text",
    "choices": ["A", "B", "C", "D"],
    "answer": "A",
    "equivalents": ["optional alternate correct answer"],
    "explanation": "<span class=\"step\">Step-by-step HTML</span>"
  }
]
```

**localStorage keys** per subject: `mathChampions_add`, `mathChampions_sub`, `mathChampions_mul`, `mathChampions_div`, `mathChampions` (fractions), `mathChampions_dec`, `mathChampions_pct`. Each stores `{ attempts: [...], questions: {}, streak: { current, best, lastDate } }`.

**CSS theming**: `css/main.css` uses `--primary`, `--easy` (#16a34a), `--medium` (#d97706), `--hard` (#dc2626). Header gradient is set inline by `quiz.js`.

## Key behaviours to preserve

- **Wrong answer**: immediately reveals correct answer and counts as missed — no second attempt.
- **Equivalent answers**: list in `equivalents` array; both `answer` and any equivalent are treated as correct.
- **Choices are shuffled** on every `renderQuestion` call.
- **Championship threshold**: `pct >= 90` triggers trophy screen + fireworks.
- **Timer is silent**: `timerSeconds` increments in background, never shown in UI, saved to localStorage per attempt.
- **Streak tracking**: streak increments only if `lastDate` was yesterday; resets otherwise.

## Adding or editing questions

1. Edit the relevant `data/{subject}.json` — add an object in the correct difficulty section.
2. Use escaped double quotes inside the JSON strings for HTML attributes: `\"step\"`.
3. If two choices are mathematically equivalent, set the preferred form as `answer` and list the other in `equivalents`.
4. Keep `explanation` as an HTML string using `<span class="step">` for each step.

## Adding a new subject

1. Add its metadata to `SUBJECT_META` in `js/quiz.js`.
2. Add its card to `index.html` and an entry to `data/subjects.json`.
3. Create `data/{subject}.json` with the question array.
4. Add CSS colour rules in `css/main.css` for `.quiz-card.{subject}`.
