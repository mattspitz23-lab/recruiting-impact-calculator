/* Recruiting Bot Impact Calculator UI — static, no backend, no network calls. */
(function () {
  "use strict";

  var STORAGE_KEY = "recruiting-bot-impact-calculator/v1";
  var INITIAL = Calc.INITIAL;
  var clone = Calc.clone;
  var fmtNumber = Calc.fmtNumber;
  var fmtHoursMinutes = Calc.fmtHoursMinutes;

  var state = null;
  var badInput = {};

  function noteBadInput(key, input) {
    if (input.validity && input.validity.badInput) badInput[key] = true;
    else delete badInput[key];
  }

  function messageFor(key, fallback) {
    if (!badInput[key] || !fallback) return fallback;
    return fallback.replace(/ is required\.$/, " must be a number.");
  }

  function compute() {
    return Calc.compute(state);
  }

  function buildSummary() {
    return Calc.buildSummary(state);
  }

  /* ---------- persistence ---------- */

  function load() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return clone(INITIAL);
      var parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.tasks)) return clone(INITIAL);
      return {
        tasks: parsed.tasks.map(function (task) {
          return {
            name: String(task.name == null ? "" : task.name),
            unit: String(task.unit == null ? "" : task.unit),
            units: String(task.units == null ? "" : task.units),
            manual: String(task.manual == null ? "" : task.manual),
            human: String(task.human == null ? "" : task.human),
            note: task.note ? String(task.note) : undefined
          };
        }),
        maintenance: String(parsed.maintenance == null ? "" : parsed.maintenance),
        linkedin: String(parsed.linkedin == null ? "" : parsed.linkedin),
        setup: String(parsed.setup == null ? "" : parsed.setup)
      };
    } catch (err) {
      return clone(INITIAL);
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* storage unavailable (private mode, quota): calculator still works in-session */
    }
  }

  /* ---------- rendering ---------- */

  var el = {};

  function cacheEls() {
    ["taskBody", "addTask", "maintenance", "linkedin", "setup", "reset", "copy", "copyStatus",
      "savedValue", "savedSub", "pctValue", "pctSub", "paybackValue", "paybackSub",
      "totalManual", "totalHuman", "chart", "errorBanner"].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
  }

  function numberCell(task, key, index, errorText) {
    var td = document.createElement("td");
    td.className = "num";
    var input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.min = "0";
    input.inputMode = "decimal";
    input.value = task[key];
    input.setAttribute("aria-label", (task.name || "Task " + (index + 1)) + " " + key);
    if (errorText) input.classList.add("invalid");
    input.addEventListener("input", function () {
      noteBadInput(index + ":" + key, input);
      state.tasks[index][key] = input.value;
      save();
      render({ skipTable: true });
    });
    td.appendChild(input);
    var msg = document.createElement("span");
    msg.className = "cell-error";
    msg.textContent = errorText || "";
    msg.hidden = !errorText;
    td.appendChild(msg);
    return td;
  }

  function textCell(task, key, index) {
    var td = document.createElement("td");
    var input = document.createElement("input");
    input.type = "text";
    input.value = task[key];
    input.setAttribute("aria-label", key === "name" ? "Task name" : "Unit name");
    input.addEventListener("input", function () {
      state.tasks[index][key] = input.value;
      save();
      render({ skipTable: true });
    });
    td.appendChild(input);
    if (key === "name" && task.note) {
      var note = document.createElement("span");
      note.className = "cell-note";
      note.textContent = task.note;
      td.appendChild(note);
    }
    return td;
  }

  function renderTable(model) {
    el.taskBody.innerHTML = "";
    state.tasks.forEach(function (task, index) {
      var row = model.rows[index];
      var tr = document.createElement("tr");
      tr.appendChild(textCell(task, "name", index));
      tr.appendChild(textCell(task, "unit", index));
      tr.appendChild(numberCell(task, "units", index, row.errors.units));
      tr.appendChild(numberCell(task, "manual", index, row.errors.manual));
      tr.appendChild(numberCell(task, "human", index, row.errors.human));

      var manualTd = document.createElement("td");
      manualTd.className = "num";
      manualTd.textContent = row.manualWeekly == null ? "—" : fmtNumber(row.manualWeekly);
      tr.appendChild(manualTd);

      var humanTd = document.createElement("td");
      humanTd.className = "num";
      humanTd.textContent = row.humanWeekly == null ? "—" : fmtNumber(row.humanWeekly);
      tr.appendChild(humanTd);

      var actionTd = document.createElement("td");
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn-remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + (task.name || "task " + (index + 1)));
      remove.addEventListener("click", function () {
        badInput = {};
        state.tasks.splice(index, 1);
        save();
        render();
      });
      actionTd.appendChild(remove);
      tr.appendChild(actionTd);

      el.taskBody.appendChild(tr);
    });
  }

  function updateRow(tr, row, index) {
    [[2, messageFor(index + ":units", row.errors.units)],
      [3, messageFor(index + ":manual", row.errors.manual)],
      [4, messageFor(index + ":human", row.errors.human)]].forEach(function (pair) {
      var td = tr.children[pair[0]];
      var input = td.querySelector("input");
      var msg = td.querySelector(".cell-error");
      input.classList.toggle("invalid", Boolean(pair[1]));
      msg.textContent = pair[1] || "";
      msg.hidden = !pair[1];
    });
    tr.children[5].textContent = row.manualWeekly == null ? "\u2014" : fmtNumber(row.manualWeekly);
    tr.children[6].textContent = row.humanWeekly == null ? "\u2014" : fmtNumber(row.humanWeekly);
  }

  function renderChart(model) {
    el.chart.innerHTML = "";
    var entries = [];
    model.rows.forEach(function (row) {
      entries.push({ label: row.label, before: row.manualWeekly, after: row.humanWeekly, kind: "task" });
    });
    entries.push({ label: "Maintenance (overhead)", before: 0, after: model.maintenance, kind: "overhead" });
    entries.push({ label: "Additional LinkedIn research / sending (overhead)", before: 0, after: model.linkedin, kind: "overhead" });

    var max = 0;
    entries.forEach(function (entry) {
      if (entry.before != null) max = Math.max(max, entry.before);
      if (entry.after != null) max = Math.max(max, entry.after);
    });
    if (max <= 0) max = 1;

    entries.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "chart-row";

      var label = document.createElement("div");
      label.className = "chart-label";
      var name = document.createElement("span");
      name.textContent = entry.label;
      var vals = document.createElement("span");
      vals.className = "vals";
      var beforeText = entry.before == null ? "—" : fmtNumber(entry.before) + " min";
      var afterText = entry.after == null ? "—" : fmtNumber(entry.after) + " min";
      vals.textContent = entry.kind === "overhead"
        ? "current only: " + afterText
        : beforeText + " → " + afterText;
      label.appendChild(name);
      label.appendChild(vals);
      row.appendChild(label);

      [["before", entry.before], ["after", entry.after]].forEach(function (pair) {
        if (entry.kind === "overhead" && pair[0] === "before") return;
        var track = document.createElement("div");
        track.className = "bar-track";
        var bar = document.createElement("div");
        bar.className = "bar " + (entry.kind === "overhead" ? "overhead" : pair[0]);
        var value = pair[1] == null ? 0 : pair[1];
        bar.style.width = Math.max(0, (value / max) * 100) + "%";
        track.appendChild(bar);
        row.appendChild(track);
      });

      el.chart.appendChild(row);
    });
  }

  function renderResults(model) {
    el.totalManual.textContent = fmtNumber(model.manualTotal);
    el.totalHuman.textContent = fmtNumber(model.humanTaskTotal);

    if (!model.complete) {
      el.savedValue.textContent = "Incomplete";
      el.savedSub.textContent = "Fill in every required input to see results.";
      el.pctValue.textContent = "Incomplete";
      el.pctSub.textContent = "Fill in every required input to see results.";
      el.paybackValue.textContent = "Incomplete";
      el.paybackSub.textContent = "Fill in every required input to see results.";
      return;
    }

    el.savedValue.textContent = fmtHoursMinutes(model.savedMinutes);
    el.savedSub.textContent = model.savedMinutes < 0
      ? fmtNumber(Math.abs(model.savedMinutes)) + " extra minutes/week of human time"
      : fmtNumber(model.savedMinutes) + " minutes/week saved";

    if (model.percent == null) {
      el.pctValue.textContent = "N/A";
      el.pctSub.textContent = "Manual weekly time is zero.";
    } else {
      el.pctValue.textContent = model.percent.toFixed(1) + "%";
      el.pctSub.textContent = fmtNumber(model.manualTotal) + " manual → " + fmtNumber(model.humanTotal) + " human min/week";
    }

    if (model.paybackWeeks == null) {
      el.paybackValue.textContent = "No payback at these inputs";
      el.paybackSub.textContent = "Weekly savings are zero or negative.";
    } else {
      el.paybackValue.textContent = model.paybackWeeks.toFixed(2) + " weeks";
      el.paybackSub.textContent = fmtNumber(model.setup) + " setup hours ÷ " +
        model.savedHours.toFixed(2) + " hours saved/week";
    }
  }

  function visibleErrors(model) {
    var messages = [];
    model.rows.forEach(function (row, index) {
      ["units", "manual", "human"].forEach(function (key) {
        var message = messageFor(index + ":" + key, row.errors[key]);
        if (message) messages.push(message);
      });
    });
    ["maintenance", "linkedin", "setup"].forEach(function (key) {
      var message = messageFor(key, model.fieldErrors[key]);
      if (message) messages.push(message);
    });
    return messages;
  }

  function renderErrors(model) {
    model.errors = visibleErrors(model);
    if (model.errors.length === 0) {
      el.errorBanner.hidden = true;
      el.errorBanner.textContent = "";
    } else {
      el.errorBanner.hidden = false;
      el.errorBanner.textContent = model.errors.length === 1
        ? model.errors[0]
        : model.errors.length + " inputs need attention: " + model.errors.join(" ");
    }
    ["maintenance", "linkedin", "setup"].forEach(function (key) {
      var message = messageFor(key, model.fieldErrors[key]);
      var node = document.querySelector('[data-error-for="' + key + '"]');
      node.hidden = !message;
      node.textContent = message || "";
      el[key].classList.toggle("invalid", Boolean(message));
    });
  }

  function render(options) {
    var opts = options || {};
    var model = compute();
    if (!opts.skipTable) {
      renderTable(model);
    } else {
      model.rows.forEach(function (row, index) {
        var tr = el.taskBody.children[index];
        if (tr) updateRow(tr, row, index);
      });
    }
    renderResults(model);
    renderErrors(model);
    renderChart(model);
    return model;
  }

  function copySummary() {
    var text = buildSummary();
    function done(message) {
      el.copyStatus.textContent = message;
      window.setTimeout(function () { el.copyStatus.textContent = ""; }, 3000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Summary copied."); }, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(area);
    done(ok ? "Summary copied." : "Copy failed — select the text manually.");
  }

  /* ---------- wiring ---------- */

  function init() {
    cacheEls();
    state = load();

    ["maintenance", "linkedin", "setup"].forEach(function (key) {
      el[key].value = state[key];
      el[key].addEventListener("input", function () {
        noteBadInput(key, el[key]);
        state[key] = el[key].value;
        save();
        render({ skipTable: true });
      });
    });

    el.addTask.addEventListener("click", function () {
      badInput = {};
      state.tasks.push({ name: "New task", unit: "Item", units: "1", manual: "0", human: "0" });
      save();
      render();
      var inputs = el.taskBody.querySelectorAll("tr:last-child input");
      if (inputs.length) inputs[0].focus();
    });

    el.reset.addEventListener("click", function () {
      state = clone(INITIAL);
      badInput = {};
      save();
      ["maintenance", "linkedin", "setup"].forEach(function (key) { el[key].value = state[key]; });
      render();
    });

    el.copy.addEventListener("click", copySummary);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.__calc = { compute: compute, buildSummary: buildSummary, getState: function () { return state; }, INITIAL: INITIAL };
})();
