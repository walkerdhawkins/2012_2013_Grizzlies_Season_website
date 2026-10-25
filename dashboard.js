/* Dashboard page: filters change the four numbers, the charts, and the table.
   Every number is calculated in the browser from games.csv. */
(function () {
  "use strict";
  var A = GrizzliesApp;
  var BEFORE = "var(--before)", AFTER = "var(--after)";

  var MEASURES = {
    winPct: {
      name: "Win %",
      value: function (s) { return s.winPct; },
      label: function (s) { return s.n ? A.fmtPct(s.winPct) + " (" + A.fmtRecord(s) + ")" : "n/a"; },
      tickFmt: A.fmtPct0, min: 0, max: 1
    },
    margin: {
      name: "Average point margin",
      value: function (s) { return s.margin; },
      label: function (s) { return s.n ? A.fmtSigned(s.margin, 1) : "n/a"; },
      tickFmt: function (v) { return A.fmtSigned(v, 0); }
    },
    pf: {
      name: "Points scored per game",
      value: function (s) { return s.pf; },
      label: function (s) { return s.n ? A.fmtNum(s.pf, 1) : "n/a"; },
      min: 0
    },
    pa: {
      name: "Points allowed per game",
      value: function (s) { return s.pa; },
      label: function (s) { return s.n ? A.fmtNum(s.pa, 1) : "n/a"; },
      min: 0
    }
  };

  var games = [], first = "", last = "", firstAfterGame = null;
  var $ = function (id) { return document.getElementById(id); };

  function inView() {
    var from = $("f-from").value, to = $("f-to").value;
    var venue = $("f-venue").value, opp = $("f-opp").value;
    return games.filter(function (g) {
      return (!from || g.date >= from) && (!to || g.date <= to) &&
        (venue === "All" || g.venue === venue) &&
        (opp === "All" || g.opponent === opp);
    });
  }

  function gamesText(n) { return n + (n === 1 ? " game" : " games"); }

  function render() {
    var rows = inView(), h = A.headline(rows), m = MEASURES[$("f-measure").value];
    var from = $("f-from").value, to = $("f-to").value;

    /* status line */
    var status = "Showing " + rows.length + " of " + games.length + " games.";
    if (from && to && from > to) status = "The From date is after the To date, so no games match. " + status;
    $("status").textContent = status;

    /* four summary numbers */
    $("s-before").textContent = A.fmtPct(h.before.winPct);
    $("s-before-sub").textContent = h.before.n ? A.fmtRecord(h.before) + " in " + gamesText(h.before.n) : "No games in view";
    $("s-after").textContent = A.fmtPct(h.after.winPct);
    $("s-after-sub").textContent = h.after.n ? A.fmtRecord(h.after) + " in " + gamesText(h.after.n) : "No games in view";
    $("s-change").textContent = h.winChange == null ? "n/a" : A.fmtSigned(h.winChange, 1) + " pts";
    $("s-margin").textContent = h.marginChange == null ? "n/a" : A.fmtSigned(h.marginChange, 1) + " pts";
    $("s-margin-sub").textContent = h.marginChange == null
      ? "Needs games before and after the trade"
      : "Per game, from " + A.fmtSigned(h.before.margin, 1) + " to " + A.fmtSigned(h.after.margin, 1);

    /* chart 1: before vs after on the chosen measure */
    $("t-period").textContent = m.name + ": before vs. after the trade";
    A.barChart($("chart-period"), {
      categories: ["Before trade\n" + gamesText(h.before.n), "After trade\n" + gamesText(h.after.n)],
      series: [{ name: m.name, color: BEFORE, colors: [BEFORE, AFTER], values: [m.value(h.before), m.value(h.after)] }],
      labels: [[m.label(h.before), m.label(h.after)]],
      tickFmt: m.tickFmt, min: m.min, max: m.max, yTitle: m.name,
      ariaLabel: "Bar chart of " + m.name + " before and after the trade for the games in view."
    });

    /* chart 2: home vs road, before and after */
    var home = A.headline(rows.filter(function (g) { return g.venue === "Home"; }));
    var away = A.headline(rows.filter(function (g) { return g.venue === "Away"; }));
    $("t-venue").textContent = m.name + ": home vs. road, before and after";
    A.barChart($("chart-venue"), {
      categories: [
        "Home games\n" + home.before.n + " before, " + home.after.n + " after",
        "Road games\n" + away.before.n + " before, " + away.after.n + " after"
      ],
      series: [
        { name: "Before trade", color: BEFORE, values: [m.value(home.before), m.value(away.before)] },
        { name: "After trade", color: AFTER, values: [m.value(home.after), m.value(away.after)] }
      ],
      labels: [
        [m.label(home.before), m.label(away.before)],
        [m.label(home.after), m.label(away.after)]
      ],
      tickFmt: m.tickFmt, min: m.min, max: m.max, yTitle: m.name,
      ariaLabel: "Grouped bar chart of " + m.name + " at home and on the road, before and after the trade."
    });

    /* chart 3: running wins minus losses */
    A.lineChart($("chart-line"), {
      points: A.runningPoints(rows),
      xMin: 1, xMax: games[games.length - 1].game,
      markerX: firstAfterGame != null ? firstAfterGame - 0.5 : null,
      xTitle: "Game number (regular season)",
      yTitle: "Wins minus losses",
      ariaLabel: "Line chart of running wins minus losses for the games in view, with the trade marked."
    });

    /* table */
    var body = document.querySelector("#games-table tbody");
    body.innerHTML = "";
    rows.forEach(function (g) {
      var tr = document.createElement("tr");
      if (g.period === "After") tr.className = "after";
      [
        [String(g.game), "num"],
        [A.fmtDate(g.date), ""],
        [g.venue, ""],
        [g.opponent, ""],
        [g.result, ""],
        [g.pts + "–" + g.oppPts, ""],
        [A.fmtSigned(g.margin, 0), "num"],
        [g.period, ""]
      ].forEach(function (c) {
        var td = document.createElement("td");
        td.textContent = c[0];
        if (c[1]) td.className = c[1];
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function reset() {
    $("f-from").value = first;
    $("f-to").value = last;
    $("f-venue").value = "All";
    $("f-opp").value = "All";
    $("f-measure").value = "winPct";
    render();
  }

  A.loadGames().then(function (res) {
    games = res.games;
    first = games.map(function (g) { return g.date; }).sort()[0];
    last = games.map(function (g) { return g.date; }).sort().slice(-1)[0];
    var fa = games.filter(function (g) { return g.period === "After"; })[0];
    firstAfterGame = fa ? fa.game : null;

    $("f-from").min = $("f-to").min = first;
    $("f-from").max = $("f-to").max = last;

    var opps = {};
    games.forEach(function (g) { opps[g.opponent] = true; });
    Object.keys(opps).sort().forEach(function (name) {
      var o = document.createElement("option");
      o.value = name; o.textContent = name;
      $("f-opp").appendChild(o);
    });

    ["f-from", "f-to", "f-venue", "f-opp", "f-measure"].forEach(function (id) {
      $(id).addEventListener("change", render);
    });
    $("reset").addEventListener("click", reset);
    reset();
  }).catch(A.showError);
})();
