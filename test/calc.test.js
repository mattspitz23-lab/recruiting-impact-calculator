/* Calculation tests. Run with: node test/calc.test.js */
const assert = require("node:assert/strict");
const test = require("node:test");
const Calc = require("../calc.js");

function state(overrides) {
  return Object.assign(Calc.clone(Calc.INITIAL), overrides || {});
}

test("initial estimates match the expected baseline", () => {
  const m = Calc.compute(state());
  assert.equal(m.complete, true);
  assert.equal(m.errors.length, 0);
  assert.equal(m.manualTotal, 950);
  assert.equal(m.humanTaskTotal, 155);
  assert.equal(m.humanTotal, 217);
  assert.equal(m.savedMinutes, 733);
  assert.equal(Calc.fmtHoursMinutes(m.savedMinutes), "12 hours 13 minutes");
  assert.equal(m.percent.toFixed(1), "77.2");
  assert.equal(m.paybackWeeks.toFixed(2), "0.41");
});

test("career-page monitoring keeps 0.125 min/check and shows 5 min/week", () => {
  const m = Calc.compute(state());
  const row = m.rows.find((r) => r.label === "Career-page monitoring");
  assert.equal(row.humanWeekly, 5);
  assert.equal(row.manualWeekly, 200);
  assert.equal(Calc.INITIAL.tasks[1].human, "0.125");
});

test("zero human minutes is allowed (fully automated task)", () => {
  const m = Calc.compute(state());
  const row = m.rows.find((r) => r.label === "Role filtering");
  assert.equal(row.humanWeekly, 0);
  assert.equal(row.errors.human, null);
});

test("blank required inputs are incomplete, not zero", () => {
  const m = Calc.compute(state({ maintenance: "" }));
  assert.equal(m.complete, false);
  assert.equal(m.humanTotal, undefined);
  assert.match(m.errors.join(" "), /Maintenance minutes per week is required/);
  const s = state({ maintenance: "   " });
  assert.equal(Calc.compute(s).complete, false);
});

test("blank task cell is incomplete and reported per cell", () => {
  const s = state();
  s.tasks[0].units = "";
  const m = Calc.compute(s);
  assert.equal(m.complete, false);
  assert.match(m.rows[0].errors.units, /units per week is required/);
});

test("negative and non-numeric inputs are rejected with messages", () => {
  const neg = Calc.compute(state({ setup: "-1" }));
  assert.equal(neg.complete, false);
  assert.match(neg.fieldErrors.setup, /cannot be negative/);

  const s = state();
  s.tasks[0].manual = "abc";
  const bad = Calc.compute(s);
  assert.equal(bad.complete, false);
  assert.match(bad.rows[0].errors.manual, /must be a number/);
});

test("negative savings are preserved and payback unavailable", () => {
  const s = state({ maintenance: "5000" });
  const m = Calc.compute(s);
  assert.equal(m.savedMinutes, 950 - (155 + 5000 + 2));
  assert.ok(m.savedMinutes < 0);
  assert.equal(m.paybackWeeks, null);
  assert.ok(m.percent < 0);
  assert.match(Calc.buildSummary(s), /MORE human time/);
  assert.match(Calc.buildSummary(s), /No payback at these inputs/);
});

test("zero manual time yields N/A percentage", () => {
  const s = state({ maintenance: "0", linkedin: "0", setup: "0" });
  s.tasks = s.tasks.map((t) => Object.assign({}, t, { manual: "0", human: "0" }));
  const m = Calc.compute(s);
  assert.equal(m.manualTotal, 0);
  assert.equal(m.percent, null);
  assert.equal(m.savedMinutes, 0);
  assert.equal(m.paybackWeeks, null);
  assert.match(Calc.buildSummary(s), /N\/A \(manual weekly time is zero\)/);
});

test("zero setup with positive savings pays back in zero weeks", () => {
  const m = Calc.compute(state({ setup: "0" }));
  assert.equal(m.paybackWeeks, 0);
  assert.match(Calc.buildSummary(state({ setup: "0" })), /Setup payback: 0\.00 weeks/);
});

test("exactly zero savings has no payback", () => {
  const m = Calc.compute(state({ maintenance: "793", linkedin: "2" }));
  assert.equal(m.savedMinutes, 0);
  assert.equal(m.paybackWeeks, null);
});

test("full precision is preserved; rounding only at display", () => {
  const s = state();
  s.tasks = [{ name: "T", unit: "u", units: "3", manual: "1", human: "0.125" }];
  const m = Calc.compute(state({ maintenance: "0", linkedin: "0", setup: "0" }));
  assert.equal(m.humanTaskTotal, 155);
  const one = Calc.compute({ tasks: s.tasks, maintenance: "0", linkedin: "0", setup: "0" });
  assert.equal(one.humanTotal, 0.375);
  assert.equal(one.savedMinutes, 2.625);
  assert.equal(one.percent.toFixed(1), "87.5");
});

test("overflowing weekly products are rejected instead of producing Infinity", () => {
  const s = state();
  s.tasks[0].units = "1e308";
  s.tasks[0].manual = "1e308";
  const m = Calc.compute(s);
  assert.equal(m.complete, false);
  assert.equal(m.rows[0].manualWeekly, null);
  assert.match(m.rows[0].errors.manual, /too large to calculate/);
  assert.equal(m.savedMinutes, undefined);
  assert.match(Calc.buildSummary(s), /summary unavailable/);
});

test("overflowing weekly totals are rejected", () => {
  const s = {
    tasks: [
      { name: "A", unit: "u", units: "1", manual: "1e308", human: "0" },
      { name: "B", unit: "u", units: "1", manual: "1e308", human: "0" }
    ],
    maintenance: "0",
    linkedin: "0",
    setup: "0"
  };
  const m = Calc.compute(s);
  assert.equal(m.complete, false);
  assert.match(m.errors.join(" "), /Weekly totals are too large to calculate/);
});

test("adding and removing tasks changes totals", () => {
  const added = state();
  added.tasks.push({ name: "New task", unit: "Item", units: "10", manual: "6", human: "1" });
  const m1 = Calc.compute(added);
  assert.equal(m1.manualTotal, 1010);
  assert.equal(m1.humanTotal, 227);

  const removed = state();
  removed.tasks.splice(0, 1);
  const m2 = Calc.compute(removed);
  assert.equal(m2.manualTotal, 790);
  assert.equal(m2.humanTotal, 177);
});

test("summary contains the required lines and disclaimer", () => {
  const text = Calc.buildSummary(state());
  assert.match(text, /Manual weekly time \(same workload by hand\): 950 min/);
  assert.match(text, /Current human weekly time with the bot: 217 min/);
  assert.match(text, /Net weekly time saved: 733 min \(12 hours 13 minutes\)/);
  assert.match(text, /Reduction in active human work: 77\.2%/);
  assert.match(text, /maintenance: 60 min\/week/);
  assert.match(text, /additional LinkedIn research\/sending: 2 min\/week \(provisional assumption\)/);
  assert.match(text, /One-time setup: 5 hours/);
  assert.match(text, /Setup payback: 0\.41 weeks/);
  assert.match(text, /personal estimates comparing the same weekly workload, not measured results/);
});

test("summary refuses to report numbers when inputs are incomplete", () => {
  const text = Calc.buildSummary(state({ linkedin: "" }));
  assert.match(text, /summary unavailable/);
});

test("hours and minutes formatting", () => {
  assert.equal(Calc.fmtHoursMinutes(0), "0 hours 0 minutes");
  assert.equal(Calc.fmtHoursMinutes(61), "1 hour 1 minute");
  assert.equal(Calc.fmtHoursMinutes(733), "12 hours 13 minutes");
  assert.equal(Calc.fmtHoursMinutes(-90), "-1 hour 30 minutes");
});
