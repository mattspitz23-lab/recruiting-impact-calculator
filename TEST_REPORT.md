# Test report — Recruiting Bot Impact Calculator

## Automated calculation tests

`node --test test/calc.test.js` — 17 tests, all passing.

| Check | Expected | Result |
| --- | --- | --- |
| Manual work at initial estimates | 950 min/week | pass |
| Human task time before overhead | 155 min/week | pass |
| Current human time incl. overhead | 217 min/week | pass |
| Net savings | 733 min/week → "12 hours 13 minutes" | pass |
| Human effort reduction | 77.2% | pass |
| Setup payback | 0.41 weeks | pass |
| Career-page monitoring | 0.125 min/check preserved, 5 min/week displayed | pass |
| Zero human minutes allowed | Role filtering = 0 min/week, no error | pass |
| Blank required input | marked incomplete, not coerced to 0 | pass |
| Blank task cell | per-cell error message, results incomplete | pass |
| Negative input | rejected with "cannot be negative" | pass |
| Non-numeric input | rejected with "must be a number" | pass |
| Negative savings | preserved; summary says "MORE human time"; no payback | pass |
| Zero manual time | percentage shows N/A | pass |
| Zero savings | "No payback at these inputs" | pass |
| Zero setup, positive savings | 0.00 weeks | pass |
| Full precision, display-only rounding | 0.375 / 2.625 min retained | pass |
| Add / remove task | totals recompute (1010/227 and 790/177) | pass |
| Copy summary text | all required lines + disclaimer present | pass |
| Summary with incomplete inputs | refuses to report numbers | pass |

## Browser checks

Served with `python3 -m http.server 8000`.

- Initial load shows 12 hours 13 minutes, 77.2%, 0.41 weeks, task totals 950 / 155.
- Editing a cell updates row totals, results, and chart immediately.
- Add task / Remove task update the table, totals, and chart.
- Reset to initial estimates restores all six rows and the three overhead inputs.
- Copy summary places the plain-text summary on the clipboard.
- Inputs persist across a page refresh (localStorage) and reset clears back to defaults.
- Mobile width (375 px): results stack, only the task table scrolls horizontally
  (`document.documentElement.scrollWidth === clientWidth === 360`), controls remain reachable.
- Typing a non-numeric value (`e`) shows "must be a number" inline and in the banner; results show
  Incomplete.
- No console errors.

Two issues were found and fixed during browser testing: page-level horizontal overflow at 375 px
(caused by a visually-hidden `<span>` positioned against the initial containing block inside the
wide table) and clipped default task names in the name/unit inputs.

Not covered: a physical mobile device — mobile checks used Chrome viewport emulation.

Browser results were captured in the session recordings attached to the pull request.
