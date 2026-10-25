/* Shared code for both pages: loads games.csv in the browser, does every
   calculation here, and draws the charts as plain SVG. No libraries. */
(function (root) {
  "use strict";

  var TRADE_DATE = "2013-01-30"; // games on or after this date are "After"
  var DATA_FILE = "games.csv";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------- CSV ---------- */

  function parseCSV(text) {
    var rows = [], row = [], field = "", inQuotes = false, i, c;
    text = text.replace(/^﻿/, "");
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += c;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || r[0] !== ""; });
  }

  /* One row of the file = one regular-season game. A row is dropped only if it
     has no valid date, result (W/L), venue, opponent, or either score. */
  function toGames(text) {
    var table = parseCSV(text), header = table.shift(), read = table.length, games = [];
    table.forEach(function (r) {
      var o = {};
      header.forEach(function (h, i) { o[h] = r[i]; });
      var g = {
        game: Number(o.game),
        date: o.date,
        venue: o.home_away,
        opponent: o.opponent,
        result: o.result,
        overtime: o.overtime === "OT",
        pts: Number(o.team_points),
        oppPts: Number(o.opponent_points)
      };
      var ok = /^\d{4}-\d{2}-\d{2}$/.test(g.date || "") &&
        !!g.opponent &&
        (g.result === "W" || g.result === "L") &&
        (g.venue === "Home" || g.venue === "Away") &&
        o.team_points !== "" && o.opponent_points !== "" &&
        isFinite(g.pts) && isFinite(g.oppPts);
      if (!ok) return;
      g.win = g.result === "W" ? 1 : 0;
      g.margin = g.pts - g.oppPts;
      g.period = g.date >= TRADE_DATE ? "After" : "Before";
      games.push(g);
    });
    games.sort(function (a, b) { return a.game - b.game; });
    return { games: games, read: read, dropped: read - games.length };
  }

  function loadGames() {
    return fetch(DATA_FILE).then(function (res) {
      if (!res.ok) throw new Error("Could not load " + DATA_FILE + " (HTTP " + res.status + ").");
      return res.text();
    }).then(toGames);
  }

  function showError(err) {
    var box = document.getElementById("load-error");
    if (box) {
      box.hidden = false;
      box.textContent = "The data file did not load: " + (err && err.message ? err.message : err) +
        " If you opened this page straight from a folder, serve the folder over http (for example, python3 -m http.server) or use the published site.";
    }
    if (root.console) console.error(err);
  }

  /* ---------- Calculations ---------- */

  function summarize(rows) {
    var n = rows.length, w = 0, pf = 0, pa = 0, i;
    if (!n) return { n: 0, w: 0, l: 0, winPct: null, pf: null, pa: null, margin: null };
    for (i = 0; i < n; i++) { w += rows[i].win; pf += rows[i].pts; pa += rows[i].oppPts; }
    return { n: n, w: w, l: n - w, winPct: w / n, pf: pf / n, pa: pa / n, margin: (pf - pa) / n };
  }

  function byPeriod(rows) {
    return {
      Before: summarize(rows.filter(function (g) { return g.period === "Before"; })),
      After: summarize(rows.filter(function (g) { return g.period === "After"; }))
    };
  }

  /* The four summary numbers. Changes are "after minus before" and need both periods. */
  function headline(rows) {
    var p = byPeriod(rows), both = p.Before.n > 0 && p.After.n > 0;
    return {
      before: p.Before,
      after: p.After,
      winChange: both ? (p.After.winPct - p.Before.winPct) * 100 : null,
      marginChange: both ? p.After.margin - p.Before.margin : null
    };
  }

  /* ---------- Formatting ---------- */

  function fmtPct(x) { return x == null ? "n/a" : (x * 100).toFixed(1) + "%"; }
  function fmtPct0(x) { return x == null ? "n/a" : (x * 100).toFixed(0) + "%"; }
  function fmtNum(x, d) { return x == null ? "n/a" : x.toFixed(d == null ? 1 : d); }
  function fmtSigned(x, d) {
    if (x == null) return "n/a";
    d = d == null ? 1 : d;
    var v = Number(x.toFixed(d)), s = Math.abs(v).toFixed(d);
    return (v > 0 ? "+" : v < 0 ? "−" : "") + s;
  }
  function fmtRecord(s) { return s && s.n ? s.w + "–" + s.l : "n/a"; }
  function fmtDate(iso) {
    var p = iso.split("-");
    return MONTHS[Number(p[1]) - 1] + " " + Number(p[2]) + ", " + p[0];
  }

  /* ---------- Charts (plain SVG) ---------- */

  var NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs, text) {
    var e = document.createElementNS(NS, name), k;
    for (k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }

  function niceScale(lo, hi) {
    if (hi === lo) hi = lo + 1;
    var raw = (hi - lo) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    var a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, ticks = [], v;
    for (v = a; v <= b + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { lo: a, hi: b, ticks: ticks };
  }

  function emptyMessage(container) {
    var d = document.createElement("div");
    d.className = "empty";
    d.textContent = "No games match these filters.";
    container.appendChild(d);
  }

  function addLegend(container, items) {
    var box = document.createElement("div");
    box.className = "legend";
    items.forEach(function (it) {
      var s = document.createElement("span"), sw = document.createElement("span");
      sw.className = "sw";
      sw.setAttribute("style", "background:" + it.color);
      s.appendChild(sw);
      s.appendChild(document.createTextNode(it.name));
      box.appendChild(s);
    });
    container.appendChild(box);
  }

  /* o = { categories:[str with \n], series:[{name,color,colors?,values:[num|null]}],
           labels:[[str]], tickFmt, min, max, yTitle, ariaLabel } */
  function barChart(container, o) {
    container.innerHTML = "";
    var W = 640, H = 340, m = { l: 66, r: 16, t: 30, b: 70 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b, all = [];
    o.series.forEach(function (s) {
      s.values.forEach(function (v) { if (v != null) all.push(v); });
    });
    if (!all.length) { emptyMessage(container); return; }

    var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max(0, Math.max.apply(null, all));
    if (o.min != null) lo = o.min;
    if (o.max != null) hi = o.max;
    var sc = niceScale(lo, hi);
    function y(v) { return m.t + ph * (1 - (v - sc.lo) / (sc.hi - sc.lo)); }

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": o.ariaLabel || "Bar chart" });

    sc.ticks.forEach(function (t) {
      svg.appendChild(svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), "class": t === 0 ? "zero" : "grid" }));
      svg.appendChild(svgEl("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", "class": "tick" }, o.tickFmt ? o.tickFmt(t) : String(t)));
    });
    if (o.yTitle) {
      svg.appendChild(svgEl("text", { x: 14, y: m.t + ph / 2, "text-anchor": "middle", "class": "ytitle", transform: "rotate(-90 14 " + (m.t + ph / 2) + ")" }, o.yTitle));
    }

    var ncat = o.categories.length, nser = o.series.length, band = pw / ncat;
    var barW = Math.min((band * 0.72) / nser, 110), groupW = barW * nser;

    o.categories.forEach(function (cat, ci) {
      var gx = m.l + ci * band + (band - groupW) / 2;
      o.series.forEach(function (s, si) {
        var v = s.values[ci], x = gx + si * barW, cx = x + barW / 2, label;
        if (v == null) {
          svg.appendChild(svgEl("text", { x: cx, y: y(0) - 6, "text-anchor": "middle", "class": "val" }, "n/a"));
          return;
        }
        var fill = s.colors ? s.colors[ci] : s.color;
        var top = Math.min(y(v), y(0)), h = Math.max(Math.abs(y(v) - y(0)), v === 0 ? 0 : 1);
        svg.appendChild(svgEl("rect", { x: x + 2, y: top, width: Math.max(barW - 4, 1), height: h, style: "fill:" + fill }));
        label = o.labels ? o.labels[si][ci] : String(v);
        svg.appendChild(svgEl("text", { x: cx, y: v >= 0 ? y(v) - 6 : y(v) + 16, "text-anchor": "middle", "class": "val" }, label));
      });
      cat.split("\n").forEach(function (line, li) {
        svg.appendChild(svgEl("text", { x: m.l + ci * band + band / 2, y: H - m.b + 22 + li * 16, "text-anchor": "middle" }, line));
      });
    });

    container.appendChild(svg);
    if (nser > 1) addLegend(container, o.series.map(function (s) { return { name: s.name, color: s.color }; }));
  }

  /* o = { points:[{x,y,period,title}], xMin, xMax, markerX, yTitle, xTitle, ariaLabel } */
  function lineChart(container, o) {
    container.innerHTML = "";
    var W = 640, H = 340, m = { l: 66, r: 16, t: 30, b: 56 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    if (!o.points.length) { emptyMessage(container); return; }

    var ys = o.points.map(function (p) { return p.y; });
    var sc = niceScale(Math.min(0, Math.min.apply(null, ys)), Math.max(0, Math.max.apply(null, ys)));
    function y(v) { return m.t + ph * (1 - (v - sc.lo) / (sc.hi - sc.lo)); }
    function x(v) { return m.l + pw * (v - o.xMin) / (o.xMax - o.xMin); }

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": o.ariaLabel || "Line chart" });
    sc.ticks.forEach(function (t) {
      svg.appendChild(svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), "class": t === 0 ? "zero" : "grid" }));
      svg.appendChild(svgEl("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", "class": "tick" }, String(t)));
    });
    svg.appendChild(svgEl("text", { x: W - m.r - 4, y: y(0) + 16, "text-anchor": "end", "class": "tick" }, ".500 (wins = losses)"));
    svg.appendChild(svgEl("text", { x: 14, y: m.t + ph / 2, "text-anchor": "middle", "class": "ytitle", transform: "rotate(-90 14 " + (m.t + ph / 2) + ")" }, o.yTitle));

    var t;
    for (t = 10 * Math.ceil(o.xMin / 10); t <= o.xMax; t += 10) {
      svg.appendChild(svgEl("text", { x: x(t), y: H - m.b + 18, "text-anchor": "middle", "class": "tick" }, String(t)));
    }
    svg.appendChild(svgEl("text", { x: m.l + pw / 2, y: H - 8, "text-anchor": "middle", "class": "ytitle" }, o.xTitle));

    if (o.markerX != null && o.markerX >= o.xMin && o.markerX <= o.xMax) {
      svg.appendChild(svgEl("line", { x1: x(o.markerX), x2: x(o.markerX), y1: m.t, y2: m.t + ph, "class": "marker" }));
      svg.appendChild(svgEl("text", { x: x(o.markerX) + 6, y: m.t + 12, "class": "marker-label" }, "Gay trade (Jan 30)"));
    }

    var before = o.points.filter(function (p) { return p.period === "Before"; });
    var after = o.points.filter(function (p) { return p.period === "After"; });
    function path(pts, color) {
      if (pts.length < 2) return;
      svg.appendChild(svgEl("polyline", {
        points: pts.map(function (p) { return x(p.x) + "," + y(p.y); }).join(" "),
        fill: "none", "stroke-width": 2.5, "stroke-linejoin": "round", style: "stroke:" + color
      }));
    }
    path(before, "var(--before)");
    path(before.length ? [before[before.length - 1]].concat(after) : after, "var(--after)");

    o.points.forEach(function (p) {
      var c = svgEl("circle", { cx: x(p.x), cy: y(p.y), r: 3, style: "fill:" + (p.period === "After" ? "var(--after)" : "var(--before)") });
      if (p.title) c.appendChild(svgEl("title", {}, p.title));
      svg.appendChild(c);
    });

    container.appendChild(svg);
    addLegend(container, [
      { name: "Before trade", color: "var(--before)" },
      { name: "After trade", color: "var(--after)" }
    ]);
  }

  /* Running wins minus losses over the games in view, one point per game. */
  function runningPoints(rows) {
    var run = 0;
    return rows.map(function (g) {
      run += g.win ? 1 : -1;
      return {
        x: g.game, y: run, period: g.period,
        title: "Game " + g.game + " (" + fmtDate(g.date) + ") " + (g.venue === "Home" ? "vs " : "at ") +
          g.opponent + ": " + g.result + " " + g.pts + "–" + g.oppPts + ". Wins minus losses: " + fmtSigned(run, 0)
      };
    });
  }

  function bindText(map) {
    var nodes = document.querySelectorAll("[data-bind]"), i, key;
    for (i = 0; i < nodes.length; i++) {
      key = nodes[i].getAttribute("data-bind");
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        nodes[i].textContent = map[key];
      } else if (root.console) {
        console.warn("No value for data-bind=" + key);
      }
    }
  }

  var api = {
    TRADE_DATE: TRADE_DATE,
    parseCSV: parseCSV, toGames: toGames, loadGames: loadGames, showError: showError,
    summarize: summarize, byPeriod: byPeriod, headline: headline,
    fmtPct: fmtPct, fmtPct0: fmtPct0, fmtNum: fmtNum, fmtSigned: fmtSigned, fmtRecord: fmtRecord, fmtDate: fmtDate,
    barChart: barChart, lineChart: lineChart, runningPoints: runningPoints, bindText: bindText
  };

  root.GrizzliesApp = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
