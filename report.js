/* Report page: every number and chart comes from games.csv, calculated here. */
(function () {
  "use strict";
  var A = GrizzliesApp;

  A.loadGames().then(function (res) {
    var g = res.games;
    var h = A.headline(g);
    var home = A.headline(g.filter(function (r) { return r.venue === "Home"; }));
    var away = A.headline(g.filter(function (r) { return r.venue === "Away"; }));
    var all = A.summarize(g);

    function range(period) {
      var d = g.filter(function (r) { return r.period === period; }).map(function (r) { return r.date; }).sort();
      return A.fmtDate(d[0]) + " – " + A.fmtDate(d[d.length - 1]);
    }
    function abs(x) { return A.fmtNum(Math.abs(x), 1); }
    function share(s, total) { return Math.round(100 * s.n / total.n) + "%"; }

    var expected = h.before.winPct * h.after.n;
    var dates = g.map(function (r) { return r.date; }).sort();

    A.bindText({
      beforePct: A.fmtPct(h.before.winPct),
      afterPct: A.fmtPct(h.after.winPct),
      winChange: A.fmtSigned(h.winChange, 1),
      winChangeAbs: abs(h.winChange),
      marginChange: A.fmtSigned(h.marginChange, 1),
      marginChangeAbs: abs(h.marginChange),
      beforeRecord: A.fmtRecord(h.before),
      afterRecord: A.fmtRecord(h.after),
      beforeN: String(h.before.n),
      afterN: String(h.after.n),
      beforeRange: range("Before"),
      afterRange: range("After"),
      beforeMargin: A.fmtSigned(h.before.margin, 1),
      afterMargin: A.fmtSigned(h.after.margin, 1),
      beforePF: A.fmtNum(h.before.pf, 1),
      afterPF: A.fmtNum(h.after.pf, 1),
      beforePA: A.fmtNum(h.before.pa, 1),
      afterPA: A.fmtNum(h.after.pa, 1),
      expectedWins: String(Math.round(expected)),
      actualWins: String(h.after.w),
      excessWins: String(Math.round(h.after.w - expected)),
      paceBefore: String(Math.round(h.before.winPct * 82)),
      paceAfter: String(Math.round(h.after.winPct * 82)),
      onePct: A.fmtNum(100 / h.after.n, 1),
      homeBeforePct: A.fmtPct(home.before.winPct),
      homeAfterPct: A.fmtPct(home.after.winPct),
      awayBeforePct: A.fmtPct(away.before.winPct),
      awayAfterPct: A.fmtPct(away.after.winPct),
      homeBeforeRec: A.fmtRecord(home.before),
      homeAfterRec: A.fmtRecord(home.after),
      awayBeforeRec: A.fmtRecord(away.before),
      awayAfterRec: A.fmtRecord(away.after),
      homeChangeAbs: abs(home.winChange),
      awayChangeAbs: abs(away.winChange),
      homeShareBefore: share(home.before, h.before),
      homeShareAfter: share(home.after, h.after),
      rowsRead: String(res.read),
      rowsUsed: String(g.length),
      rowsDropped: String(res.dropped),
      firstDate: A.fmtDate(dates[0]),
      lastDate: A.fmtDate(dates[dates.length - 1]),
      totalRecord: A.fmtRecord(all),
      totalPct: A.fmtPct(all.winPct)
    });

    var BEFORE = "var(--before)", AFTER = "var(--after)";
    function lab(s) { return A.fmtPct(s.winPct) + " (" + A.fmtRecord(s) + ")"; }

    /* Season at a glance */
    var firstAfter = g.filter(function (r) { return r.period === "After"; })[0];
    A.lineChart(document.getElementById("chart-season"), {
      points: A.runningPoints(g),
      xMin: 1, xMax: g[g.length - 1].game,
      markerX: firstAfter ? firstAfter.game - 0.5 : null,
      xTitle: "Game number (regular season)",
      yTitle: "Wins minus losses",
      ariaLabel: "Line chart of the Grizzlies' running wins minus losses across the 82-game season, with the Rudy Gay trade marked after game 44."
    });

    /* Finding 1 */
    A.barChart(document.getElementById("chart-win"), {
      categories: ["Before trade\n" + h.before.n + " games", "After trade\n" + h.after.n + " games"],
      series: [{ name: "Win %", color: BEFORE, colors: [BEFORE, AFTER], values: [h.before.winPct, h.after.winPct] }],
      labels: [[lab(h.before), lab(h.after)]],
      tickFmt: A.fmtPct0, min: 0, max: 1, yTitle: "Win percentage",
      ariaLabel: "Bar chart: win percentage " + A.fmtPct(h.before.winPct) + " before the trade and " + A.fmtPct(h.after.winPct) + " after."
    });

    /* Finding 2 */
    A.barChart(document.getElementById("chart-points"), {
      categories: ["Points scored per game", "Points allowed per game"],
      series: [
        { name: "Before trade (" + h.before.n + " games)", color: BEFORE, values: [h.before.pf, h.before.pa] },
        { name: "After trade (" + h.after.n + " games)", color: AFTER, values: [h.after.pf, h.after.pa] }
      ],
      labels: [
        [A.fmtNum(h.before.pf, 1), A.fmtNum(h.before.pa, 1)],
        [A.fmtNum(h.after.pf, 1), A.fmtNum(h.after.pa, 1)]
      ],
      min: 0, yTitle: "Points per game",
      ariaLabel: "Grouped bar chart of points scored and allowed per game, before and after the trade."
    });

    /* Finding 3 */
    A.barChart(document.getElementById("chart-venue"), {
      categories: ["Home games", "Road games"],
      series: [
        { name: "Before trade", color: BEFORE, values: [home.before.winPct, away.before.winPct] },
        { name: "After trade", color: AFTER, values: [home.after.winPct, away.after.winPct] }
      ],
      labels: [
        [lab(home.before), lab(away.before)],
        [lab(home.after), lab(away.after)]
      ],
      tickFmt: A.fmtPct0, min: 0, max: 1, yTitle: "Win percentage",
      ariaLabel: "Grouped bar chart of win percentage at home and on the road, before and after the trade."
    });
  }).catch(A.showError);
})();
