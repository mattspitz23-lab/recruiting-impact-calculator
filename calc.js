/* Pure calculation + formatting logic. Shared by the browser app and the Node test script. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var INITIAL = {
    tasks: [
      { name: "Company research", unit: "Company", units: "8", manual: "20", human: "5" },
      {
        name: "Career-page monitoring",
        unit: "Company check",
        units: "40",
        manual: "5",
        human: "0.125",
        note: "20 companies checked twice weekly; 0.125 min per check = 5 min total per week."
      },
      { name: "Role filtering", unit: "Role", units: "30", manual: "2", human: "0" },
      { name: "Contact/email research", unit: "Contact", units: "20", manual: "10", human: "2" },
      { name: "Outreach preparation", unit: "Message", units: "30", manual: "10", human: "2" },
      { name: "Follow-ups", unit: "Follow-up", units: "10", manual: "3", human: "1" }
    ],
    maintenance: "60",
    linkedin: "2",
    setup: "5"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseField(raw, label) {
    var text = String(raw == null ? "" : raw).trim();
    if (text === "") return { ok: false, blank: true, message: label + " is required." };
    var value = Number(text);
    if (!isFinite(value)) return { ok: false, message: label + " must be a number." };
    if (value < 0) return { ok: false, message: label + " cannot be negative." };
    return { ok: true, value: value };
  }

  function fmtNumber(value, maxDecimals) {
    var decimals = maxDecimals == null ? 3 : maxDecimals;
    return Number(value.toFixed(decimals)).toLocaleString("en-US", { maximumFractionDigits: decimals });
  }

  function fmtHoursMinutes(minutes) {
    var negative = minutes < 0;
    var total = Math.round(Math.abs(minutes));
    var hours = Math.floor(total / 60);
    var mins = total - hours * 60;
    var text = hours + (hours === 1 ? " hour " : " hours ") + mins + (mins === 1 ? " minute" : " minutes");
    return (negative ? "-" : "") + text;
  }

  function compute(state) {
    var errors = [];
    var fieldErrors = {};
    var rows = [];
    var manualTotal = 0;
    var humanTaskTotal = 0;
    var tasksComplete = true;

    state.tasks.forEach(function (task, index) {
      var label = String(task.name || "").trim() === "" ? "Task " + (index + 1) : String(task.name).trim();
      var units = parseField(task.units, label + ": units per week");
      var manual = parseField(task.manual, label + ": manual minutes per unit");
      var human = parseField(task.human, label + ": human minutes per unit with bot");
      var row = {
        label: label,
        errors: {
          units: units.ok ? null : units.message,
          manual: manual.ok ? null : manual.message,
          human: human.ok ? null : human.message
        },
        manualWeekly: null,
        humanWeekly: null
      };
      [units, manual, human].forEach(function (result) {
        if (!result.ok) errors.push(result.message);
      });
      if (units.ok && manual.ok) {
        var manualWeekly = units.value * manual.value;
        if (isFinite(manualWeekly)) {
          row.manualWeekly = manualWeekly;
          manualTotal += manualWeekly;
        } else {
          row.errors.manual = label + ": manual minutes per week is too large to calculate.";
          errors.push(row.errors.manual);
        }
      }
      if (units.ok && human.ok) {
        var humanWeekly = units.value * human.value;
        if (isFinite(humanWeekly)) {
          row.humanWeekly = humanWeekly;
          humanTaskTotal += humanWeekly;
        } else {
          row.errors.human = label + ": human minutes per week is too large to calculate.";
          errors.push(row.errors.human);
        }
      }
      if (row.errors.units || row.errors.manual || row.errors.human) tasksComplete = false;
      rows.push(row);
    });

    var maintenance = parseField(state.maintenance, "Maintenance minutes per week");
    var linkedin = parseField(state.linkedin, "Additional LinkedIn minutes per week");
    var setup = parseField(state.setup, "One-time setup hours");
    [["maintenance", maintenance], ["linkedin", linkedin], ["setup", setup]].forEach(function (pair) {
      if (!pair[1].ok) {
        fieldErrors[pair[0]] = pair[1].message;
        errors.push(pair[1].message);
      }
    });

    var complete = tasksComplete && maintenance.ok && linkedin.ok && setup.ok &&
      isFinite(manualTotal) && isFinite(humanTaskTotal);
    if (!complete && tasksComplete && maintenance.ok && linkedin.ok && setup.ok) {
      errors.push("Weekly totals are too large to calculate.");
    }
    var model = {
      rows: rows,
      errors: errors,
      fieldErrors: fieldErrors,
      complete: complete,
      manualTotal: manualTotal,
      humanTaskTotal: humanTaskTotal,
      maintenance: maintenance.ok ? maintenance.value : null,
      linkedin: linkedin.ok ? linkedin.value : null,
      setup: setup.ok ? setup.value : null
    };

    if (complete && !isFinite(humanTaskTotal + maintenance.value + linkedin.value)) {
      complete = false;
      model.complete = false;
      errors.push("Weekly totals are too large to calculate.");
    }

    if (complete) {
      model.humanTotal = humanTaskTotal + maintenance.value + linkedin.value;
      model.savedMinutes = manualTotal - model.humanTotal;
      model.savedHours = model.savedMinutes / 60;
      model.percent = manualTotal === 0 ? null : (model.savedMinutes / manualTotal) * 100;
      if (model.savedMinutes <= 0) model.paybackWeeks = null;
      else if (setup.value === 0) model.paybackWeeks = 0;
      else model.paybackWeeks = setup.value / model.savedHours;
    }
    return model;
  }

  function buildSummary(state) {
    var model = compute(state);
    if (!model.complete) {
      return "Recruiting Bot Impact Calculator — summary unavailable: some inputs are blank or invalid.\n" +
        model.errors.join("\n");
    }
    var lines = [];
    lines.push("Recruiting Bot Impact Calculator — personal estimates (not yet measured)");
    lines.push("");
    lines.push("Manual weekly time (same workload by hand): " + fmtNumber(model.manualTotal) + " min (" + fmtHoursMinutes(model.manualTotal) + ")");
    lines.push("Current human weekly time with the bot: " + fmtNumber(model.humanTotal) + " min (" + fmtHoursMinutes(model.humanTotal) + ")");
    if (model.savedMinutes < 0) {
      lines.push("Net weekly change: " + fmtNumber(Math.abs(model.savedMinutes)) + " min MORE human time (" + fmtHoursMinutes(Math.abs(model.savedMinutes)) + ")");
    } else {
      lines.push("Net weekly time saved: " + fmtNumber(model.savedMinutes) + " min (" + fmtHoursMinutes(model.savedMinutes) + ")");
    }
    lines.push("Reduction in active human work: " + (model.percent == null ? "N/A (manual weekly time is zero)" : model.percent.toFixed(1) + "%"));
    lines.push("Included overhead — maintenance: " + fmtNumber(model.maintenance) + " min/week; additional LinkedIn research/sending: " + fmtNumber(model.linkedin) + " min/week (provisional assumption)");
    lines.push("One-time setup: " + fmtNumber(model.setup) + " hours");
    lines.push("Setup payback: " + (model.paybackWeeks == null ? "No payback at these inputs" : model.paybackWeeks.toFixed(2) + " weeks"));
    lines.push("");
    lines.push("Per task (weekly minutes, manual → human with bot):");
    model.rows.forEach(function (row) {
      lines.push("- " + row.label + ": " +
        (row.manualWeekly == null ? "—" : fmtNumber(row.manualWeekly)) + " min → " +
        (row.humanWeekly == null ? "—" : fmtNumber(row.humanWeekly)) + " min per week");
    });
    lines.push("");
    lines.push("These are personal estimates comparing the same weekly workload, not measured results. They count active human time (including review, correction, and maintenance), assume comparable output quality, and make no claim about interviews, offers, or hiring outcomes.");
    return lines.join("\n");
  }

  return {
    INITIAL: INITIAL,
    clone: clone,
    parseField: parseField,
    fmtNumber: fmtNumber,
    fmtHoursMinutes: fmtHoursMinutes,
    compute: compute,
    buildSummary: buildSummary
  };
});
