# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A zero-dependency, single-file static math quiz (`index.html`) for advanced 2nd-grade kids. It is deployed on GitHub Pages at `https://pavanpalakshamurthy.github.io/math-session/`. There is no build step, no package manager, and no framework — everything lives in `index.html`.

## Development

Open `index.html` directly in a browser to test. No server needed.

To validate JavaScript syntax without a browser:
```bash
node --input-type=module -e "
import { readFileSync } from 'fs';
const html = readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
console.log('JS OK');
"
```

Deploy by pushing to `main` — GitHub Pages serves from the root of `main` automatically.

## Architecture

The entire app is a single `index.html` split into three sections:

**`<style>`** — All CSS using CSS custom properties (`:root` variables). Three difficulty colors: `--easy` (green), `--medium` (amber), `--hard` (red). The championship screen and fireworks canvas have their own isolated CSS blocks at the bottom of the style section.

**`const questions = [...]`** — The data layer. Each question object has:
```js
{
  level: 'easy' | 'medium' | 'hard',
  text: `...`,           // word problem
  hint: "...",           // shown below the question
  choices: [...],        // exactly 4 options
  answer: '...',         // primary correct answer string
  equivalents: [...],    // optional — other strings that are also correct (e.g. '1/4' for a question answered '2/8')
  explanation: `...`,    // HTML string with <span class="step"> elements for step-by-step walkthrough
}
```
30 questions total: 5 easy, 10 medium, 15 hard.

**JavaScript functions** — Pure DOM manipulation, no framework:
- `renderQuestion(idx)` — builds the card for question `idx`, shuffles choices randomly
- `handleChoice(btnIdx)` — core game logic: checks `answer` and `equivalents`, manages 2-attempt limit, updates score
- `showExplanation(el, html)` — injects the step-by-step explanation box after an answer
- `showFinalScreen()` — renders results; calls `launchFireworks()` when score ≥ 90%
- `launchFireworks()` — canvas-based particle system, self-cleaning after all bursts complete
- `restartQuiz()` — resets all state and re-renders from question 0

## Key behaviours to preserve

- **2-attempt limit**: first wrong attempt disables that choice; second wrong attempt ends the question, reveals the correct answer, and counts as wrong in the score.
- **Equivalent answers**: questions where multiple choices are mathematically equal (e.g. `2/8` and `1/4`) must list the non-primary ones in `equivalents`. Both `handleChoice` and `revealCorrect` must treat them identically to `answer`.
- **Choices are shuffled** on every `renderQuestion` call via `[...q.choices].sort(() => Math.random() - 0.5)`.
- **Championship threshold**: `pct >= 90` (27+ correct out of 30) triggers the trophy + fireworks screen.

## Adding or editing questions

1. Add an object to the `questions` array in the correct difficulty section.
2. Use backtick strings for `text` and `hint` so apostrophes don't break JS. Single-quoted `hint` strings with apostrophes (e.g. `that's`) will silently break the entire script.
3. If two choices are mathematically equivalent, set the preferred form as `answer` and list the other in `equivalents: [...]`.
4. Write `explanation` as an HTML string using `<span class="step">` for each step.
5. Run the syntax check above before committing.
