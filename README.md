# Recruiting Bot Impact Calculator

A single-page, static calculator that estimates how much **active human time per week** a personal
recruiting workflow (OpenAI, Notion, n8n, Gmail, Clay) saves compared with doing the same weekly
workload by hand.

**Personal estimates — not yet measured.** Nothing here is a measured result. See
[What this does and does not show](#what-this-does-and-does-not-show).

## Running it

No build step, no backend, no dependencies, no network calls.

- Open `index.html` directly in a browser, **or**
- serve the folder: `python3 -m http.server 8000` and visit `http://localhost:8000`.

Run the calculation tests (Node 18+):

```
node --test test/calc.test.js
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and copy |
| `styles.css` | Styling (responsive, no framework) |
| `calc.js` | Pure calculation, validation, formatting and summary text — shared by the page and the tests |
| `app.js` | DOM rendering, editing, chart, local storage, copy-to-clipboard |
| `test/calc.test.js` | Node test-runner tests for the calculations and edge cases |
| `TEST_REPORT.md` | Test report |

## How the calculation works

For each task row: `units/week × manual minutes/unit` and `units/week × human minutes/unit with bot`.
"Human minutes with bot" is the time you still spend — review, corrections, and remaining manual work.

```
manual weekly minutes   = Σ (units/week × manual minutes/unit)
current human minutes   = Σ (units/week × human minutes/unit with bot)
                          + maintenance minutes/week
                          + additional LinkedIn minutes/week
net weekly minutes saved= manual weekly minutes − current human minutes
net weekly hours saved  = net weekly minutes saved / 60
reduction %             = net weekly minutes saved / manual weekly minutes × 100
setup payback weeks     = setup hours / net weekly hours saved
```

Everything is computed at full precision; rounding happens only for display — time as hours and
minutes, percentage to one decimal place, payback to two decimals.

### Initial estimates

| Task | Unit | Units/week | Manual min/unit | Human min/unit with bot |
| --- | --- | ---: | ---: | ---: |
| Company research | Company | 8 | 20 | 5 |
| Career-page monitoring | Company check | 40 | 5 | 0.125 |
| Role filtering | Role | 30 | 2 | 0 |
| Contact/email research | Contact | 20 | 10 | 2 |
| Outreach preparation | Message | 30 | 10 | 2 |
| Follow-ups | Follow-up | 10 | 3 | 1 |

Plus 60 maintenance minutes/week, 2 additional LinkedIn minutes/week, and 5 one-time setup hours.

Career-page monitoring is 20 companies checked twice weekly (40 checks). The exact per-check value of
`0.125` minutes is preserved in the arithmetic and displays as a 5-minute weekly total.

The 2 additional LinkedIn minutes are a **provisional assumption**, labelled as such in the UI. Most
LinkedIn research and sending time is already inside the contact-research and outreach rows; this
input covers only additional time.

These inputs produce: 950 manual min/week, 155 human task min/week, 217 current human min/week
including overhead, 733 min saved (12 hours 13 minutes), 77.2% reduction, 0.41 weeks payback.

## Input handling

- Negative or non-numeric values are rejected with a specific message next to the field.
- Zero human minutes is valid (fully automated task).
- Blank required inputs are treated as **incomplete** — results show "Incomplete" rather than
  silently substituting zero.
- Negative savings are preserved and displayed when the bot costs more human time than it saves.
- Percentage shows `N/A` when manual weekly time is zero.
- Payback shows "No payback at these inputs" when savings are zero or negative, and `0.00 weeks`
  when setup time is zero and savings are positive.

## Saving

Inputs are stored in this browser's `localStorage` under `recruiting-bot-impact-calculator/v1`.
They do **not** sync to other devices and do **not** change what other visitors see. "Reset to
initial estimates" restores the table above.

## What this does and does not show

- The comparison estimates manual effort for the *same* weekly workload and assumes comparable
  output quality.
- It does not establish that this exact amount of time was previously spent, nor that output
  quality has been verified.
- Only active human time is counted — review, correction, maintenance — not unattended bot runtime,
  and without double counting.
- Results are estimates based on the entered assumptions, not verified productivity gains. No claim
  is made about interviews, offers, or hiring outcomes.
