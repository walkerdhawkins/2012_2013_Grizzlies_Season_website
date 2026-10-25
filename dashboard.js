/* Dashboard page: filters change the four numbers, the charts, the map, and the table.
   Every number is calculated in the browser from games.csv. teams.csv only holds
   the places (city, latitude, longitude) used to position the map circles. */
(function () {
  "use strict";
  var A = GrizzliesApp;
  var BEFORE = "var(--before)", AFTER = "var(--after)";
  var HOME_BASE = "Memphis Grizzlies";

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

  var games = [], teams = {}, names = [];
  var first = "", last = "", firstAfterGame = null;
  var presets = [], spot = null, map = null, layer = null, firstRender = true;
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function gamesText(n) { return n + (n === 1 ? " game" : " games"); }

  /* ---------- Filters ---------- */

  function inView() {
    var from = $("f-from").value, to = $("f-to").value;
    var venue = $("f-venue").value, opp = $("f-opp").value;
    return games.filter(function (g) {
      return (!from || g.date >= from) && (!to || g.date <= to) &&
        (venue === "All" || g.venue === venue) &&
        (opp === "All" || g.opponent === opp);
    });
  }

  function setDefaults() {
    $("f-from").value = first;
    $("f-to").value = last;
    $("f-venue").value = "All";
    $("f-opp").value = "All";
    $("f-measure").value = "winPct";
  }

  /* ---------- Filters carried in the address bar ---------- */

  function readUrl() {
    var p = new URLSearchParams(window.location.search), v;
    var isDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || "") && s >= first && s <= last; };
    if (isDate(p.get("from"))) $("f-from").value = p.get("from");
    if (isDate(p.get("to"))) $("f-to").value = p.get("to");
    v = p.get("venue");
    if (v === "Home" || v === "Away") $("f-venue").value = v;
    v = p.get("opp");
    if (v && names.indexOf(v) !== -1) $("f-opp").value = v;
    v = p.get("measure");
    if (v && Object.prototype.hasOwnProperty.call(MEASURES, v)) $("f-measure").value = v;
    v = p.get("spot");
    return v && names.indexOf(v) !== -1 ? v : null;
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if ($("f-from").value && $("f-from").value !== first) p.set("from", $("f-from").value);
    if ($("f-to").value && $("f-to").value !== last) p.set("to", $("f-to").value);
    if ($("f-venue").value !== "All") p.set("venue", $("f-venue").value);
    if ($("f-opp").value !== "All") p.set("opp", $("f-opp").value);
    if ($("f-measure").value !== "winPct") p.set("measure", $("f-measure").value);
    if (spot) p.set("spot", spot);
    var qs = p.toString();
    try { window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "")); } catch (e) { /* ignore */ }
  }

  function copyLink() {
    var note = $("status"), url = window.location.href;
    function done() { note.textContent = "Link copied. Anyone who opens it sees this same view."; }
    function manual() { window.prompt("Copy this link:", url); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, manual);
    else manual();
  }

  /* ---------- Quick period buttons ---------- */

  function buildPresets() {
    var n = games.length, half = Math.floor(n / 2);
    var before = games.filter(function (g) { return g.period === "Before"; });
    var after = games.filter(function (g) { return g.period === "After"; });
    presets = [{ label: "Whole season", from: first, to: last }];
    if (before.length) presets.push({ label: "Before the trade", from: first, to: before[before.length - 1].date });
    if (after.length) presets.push({ label: "After the trade", from: after[0].date, to: last });
    presets.push({ label: "First " + half + " games", from: games[0].date, to: games[half - 1].date });
    presets.push({ label: "Last " + (n - half) + " games", from: games[half].date, to: last });
    presets.push({ label: "Last 20 games", from: games[n - 20].date, to: last });

    var box = $("quick");
    presets.forEach(function (ps, i) {
      var b = el("button", "chip", ps.label);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("data-preset", String(i));
      b.addEventListener("click", function () {
        $("f-from").value = ps.from;
        $("f-to").value = ps.to;
        render();
      });
      box.appendChild(b);
    });
  }

  function markPresets() {
    var from = $("f-from").value, to = $("f-to").value;
    var buttons = $("quick").querySelectorAll("button.chip"), i;
    for (i = 0; i < buttons.length; i++) {
      var ps = presets[Number(buttons[i].getAttribute("data-preset"))];
      buttons[i].setAttribute("aria-pressed", String(ps.from === from && ps.to === to));
    }
  }

  /* ---------- Map ---------- */

  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (k) { return parseInt(a.substr(k, 2), 16); });
    var pb = [1, 3, 5].map(function (k) { return parseInt(b.substr(k, 2), 16); });
    return "rgb(" + pa.map(function (x, k) { return Math.round(x + (pb[k] - x) * t); }).join(",") + ")";
  }
  function colorFor(winPct) {
    return winPct <= 0.5 ? mix("#d1603d", "#aab1bb", winPct / 0.5) : mix("#aab1bb", "#1f5fbf", (winPct - 0.5) / 0.5);
  }

  function initMap() {
    var note = $("map-note");
    if (!window.L || !Object.keys(teams).length) {
      $("map").hidden = true;
      $("map-key").hidden = true;
      note.textContent = "The map could not load here (it needs the Leaflet library and the teams.csv file). Everything else on this page still works, and the team search below covers the same information.";
      return;
    }
    map = L.map("map", { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 8,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    var pts = Object.keys(teams).map(function (k) { return [teams[k].lat, teams[k].lon]; });
    map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
  }

  function updateMap(rows) {
    if (!map) return;
    layer.clearLayers();
    var byTeam = {};
    rows.forEach(function (g) { (byTeam[g.opponent] = byTeam[g.opponent] || []).push(g); });
    names.forEach(function (name) {
      var t = teams[name];
      if (!t) return;
      var s = A.summarize(byTeam[name] || []), opts, tip;
      if (s.n) {
        opts = { radius: 9, color: "#1d2430", weight: 1, fillColor: colorFor(s.winPct), fillOpacity: 0.92 };
        tip = name + ": " + A.fmtRecord(s) + " in " + gamesText(s.n) + ", average margin " + A.fmtSigned(s.margin, 1);
      } else {
        opts = { radius: 6, color: "#6b7686", weight: 1.5, dashArray: "2 3", fillOpacity: 0 };
        tip = name + ": no games in view";
      }
      var m = L.circleMarker([t.lat, t.lon], opts).addTo(layer);
      m.bindTooltip(tip);
      m.on("click", function () { openSpotlight(name, true); });
    });
    var home = teams[HOME_BASE];
    if (home) {
      L.circleMarker([home.lat, home.lon], { radius: 8, color: "#12305a", weight: 3, fillColor: "#ffffff", fillOpacity: 1 })
        .addTo(layer).bindTooltip("Memphis (home base)");
    }
  }

  /* ---------- Team search and spotlight ---------- */

  function initSearch() {
    var input = $("team-search"), list = $("team-list"), matches = [], active = -1;

    function highlight(i) {
      var items = list.children, k;
      for (k = 0; k < items.length; k++) items[k].setAttribute("aria-selected", String(k === i));
      active = i;
      if (i >= 0) {
        input.setAttribute("aria-activedescendant", items[i].id);
        items[i].scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }
    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    }
    function choose(name) {
      input.value = name;
      close();
      openSpotlight(name, false);
    }
    function show() {
      var q = input.value.trim().toLowerCase();
      matches = names.filter(function (n) { return !q || n.toLowerCase().indexOf(q) !== -1; });
      list.innerHTML = "";
      matches.forEach(function (n, i) {
        var li = el("li", "", n);
        li.id = "team-opt-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.addEventListener("mousedown", function (ev) { ev.preventDefault(); choose(n); });
        list.appendChild(li);
      });
      list.hidden = !matches.length;
      input.setAttribute("aria-expanded", String(!list.hidden));
      active = -1;
      input.removeAttribute("aria-activedescendant");
    }

    input.addEventListener("input", show);
    input.addEventListener("focus", show);
    input.addEventListener("blur", close);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (list.hidden) show();
        if (matches.length) highlight((active + 1) % matches.length);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (matches.length) highlight(active <= 0 ? matches.length - 1 : active - 1);
      } else if (ev.key === "Enter") {
        if (active >= 0) { ev.preventDefault(); choose(matches[active]); }
        else if (matches.length === 1) { ev.preventDefault(); choose(matches[0]); }
      } else if (ev.key === "Escape") {
        close();
      }
    });
  }

  function closeSpotlight() {
    spot = null;
    $("spotlight").hidden = true;
    $("spotlight").innerHTML = "";
    $("team-search").value = "";
    writeUrl();
  }

  /* The card uses every game, whatever the filters say, so it is always the team's full history. */
  function openSpotlight(name, scroll) {
    var rows = games.filter(function (g) { return g.opponent === name; });
    if (!rows.length) return;
    spot = name;
    $("team-search").value = name;

    var s = A.summarize(rows), all = A.summarize(games);
    var vb = A.byPeriod(rows), ab = A.byPeriod(games);
    var homeN = rows.filter(function (g) { return g.venue === "Home"; }).length;
    var box = $("spotlight");
    box.hidden = false;
    box.innerHTML = "";

    box.appendChild(el("h3", "", name));
    var city = teams[name] ? teams[name].city + " · " : "";
    box.appendChild(el("p", "where", city + gamesText(s.n) + " this season (" + homeN + " home, " + (s.n - homeN) + " road)"));

    var cols = el("div", "cols"), left = el("div"), right = el("div");

    /* comparison table: this team vs. all games */
    var table = el("table", "compare"), thead = el("thead"), hr = el("tr");
    ["", "Vs. " + name, "All " + games.length + " games"].forEach(function (t) { hr.appendChild(el("th", "", t)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = el("tbody");
    function row(label, a, b) {
      var tr = el("tr");
      tr.appendChild(el("td", "", label));
      tr.appendChild(el("td", "", a));
      tr.appendChild(el("td", "", b));
      tb.appendChild(tr);
    }
    function rec(x) { return x.n ? A.fmtRecord(x) + " (" + A.fmtPct(x.winPct) + ")" : "no games"; }
    row("Record", A.fmtRecord(s), A.fmtRecord(all));
    row("Win %", A.fmtPct(s.winPct), A.fmtPct(all.winPct));
    row("Average point margin", A.fmtSigned(s.margin, 1), A.fmtSigned(all.margin, 1));
    row("Before the trade", rec(vb.Before), rec(ab.Before));
    row("After the trade", rec(vb.After), rec(ab.After));
    table.appendChild(tb);
    left.appendChild(table);

    var ul = el("ul", "games");
    rows.forEach(function (g) {
      ul.appendChild(el("li", "", A.fmtDate(g.date) + " · " + (g.venue === "Home" ? "home" : "road") + " · " +
        g.result + " " + g.pts + "–" + g.oppPts + " (" + A.fmtSigned(g.margin, 0) + ")"));
    });
    left.appendChild(ul);

    /* chart: this team's margin in each game against the season-long average margin */
    var chart = el("div", "chart");
    right.appendChild(chart);
    cols.appendChild(left);
    cols.appendChild(right);
    box.appendChild(cols);

    A.barChart(chart, {
      categories: rows.map(function (g) { return A.fmtDate(g.date) + "\n" + g.venue; }),
      series: [{
        name: "Point margin", color: BEFORE,
        colors: rows.map(function (g) { return g.period === "After" ? AFTER : BEFORE; }),
        values: rows.map(function (g) { return g.margin; })
      }],
      labels: [rows.map(function (g) { return A.fmtSigned(g.margin, 0); })],
      refLine: { value: all.margin, label: "All-games average " + A.fmtSigned(all.margin, 1) },
      legendItems: [{ name: "Game before the trade", color: BEFORE }, { name: "Game after the trade", color: AFTER }],
      tickFmt: function (v) { return A.fmtSigned(v, 0); },
      yTitle: "Point margin (Grizzlies minus " + name.split(" ").pop() + ")",
      ariaLabel: "Bar chart of the Grizzlies' point margin in each game against " + name + ", with a dashed line at the all-games average margin."
    });

    var actions = el("div", "actions");
    var show = el("button", "", "Show only these games in the dashboard");
    show.type = "button";
    show.addEventListener("click", function () { $("f-opp").value = name; render(); });
    var close = el("button", "secondary", "Close");
    close.type = "button";
    close.addEventListener("click", closeSpotlight);
    actions.appendChild(show);
    actions.appendChild(close);
    box.appendChild(actions);

    writeUrl();
    if (scroll) box.scrollIntoView({ behavior: A.reducedMotion() ? "auto" : "smooth", block: "nearest" });
  }

  /* ---------- Render ---------- */

  function render() {
    var rows = inView(), h = A.headline(rows), m = MEASURES[$("f-measure").value];
    var from = $("f-from").value, to = $("f-to").value;

    var status = "Showing " + rows.length + " of " + games.length + " games.";
    if (from && to && from > to) status = "The From date is after the To date, so no games match. " + status;
    $("status").textContent = status;

    /* the four summary numbers (definitions unchanged from the report) */
    A.setText($("s-before"), A.fmtPct(h.before.winPct));
    $("s-before-sub").textContent = h.before.n ? A.fmtRecord(h.before) + " in " + gamesText(h.before.n) : "No games in view";
    A.setText($("s-after"), A.fmtPct(h.after.winPct));
    $("s-after-sub").textContent = h.after.n ? A.fmtRecord(h.after) + " in " + gamesText(h.after.n) : "No games in view";
    A.setText($("s-change"), h.winChange == null ? "n/a" : A.fmtSigned(h.winChange, 1) + " pts");
    A.setText($("s-margin"), h.marginChange == null ? "n/a" : A.fmtSigned(h.marginChange, 1) + " pts");
    $("s-margin-sub").textContent = h.marginChange == null
      ? "Needs games before and after the trade"
      : "Per game, from " + A.fmtSigned(h.before.margin, 1) + " to " + A.fmtSigned(h.after.margin, 1);
    if (firstRender) {
      ["s-before", "s-after", "s-change", "s-margin"].forEach(function (id) { A.countUp($(id), 1000); });
      firstRender = false;
    }

    $("t-period").textContent = m.name + ": before vs. after the trade";
    A.barChart($("chart-period"), {
      categories: ["Before trade\n" + gamesText(h.before.n), "After trade\n" + gamesText(h.after.n)],
      series: [{ name: m.name, color: BEFORE, colors: [BEFORE, AFTER], values: [m.value(h.before), m.value(h.after)] }],
      labels: [[m.label(h.before), m.label(h.after)]],
      tickFmt: m.tickFmt, min: m.min, max: m.max, yTitle: m.name,
      ariaLabel: "Bar chart of " + m.name + " before and after the trade for the games in view."
    });

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

    A.lineChart($("chart-line"), {
      points: A.runningPoints(rows),
      xMin: 1, xMax: games[games.length - 1].game,
      markerX: firstAfterGame != null ? firstAfterGame - 0.5 : null,
      xTitle: "Game number (regular season)",
      yTitle: "Wins minus losses",
      ariaLabel: "Line chart of running wins minus losses for the games in view, with the trade marked."
    });

    updateMap(rows);

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

    markPresets();
    writeUrl();
  }

  /* ---------- Start ---------- */

  Promise.all([
    A.loadGames(),
    A.loadTeams().catch(function (err) { if (window.console) console.warn(err); return {}; })
  ]).then(function (results) {
    games = results[0].games;
    teams = results[1];
    var dates = games.map(function (g) { return g.date; }).sort();
    first = dates[0];
    last = dates[dates.length - 1];
    var fa = games.filter(function (g) { return g.period === "After"; })[0];
    firstAfterGame = fa ? fa.game : null;

    $("f-from").min = $("f-to").min = first;
    $("f-from").max = $("f-to").max = last;

    var seen = {};
    games.forEach(function (g) { seen[g.opponent] = true; });
    names = Object.keys(seen).sort();
    names.forEach(function (name) {
      var o = document.createElement("option");
      o.value = name; o.textContent = name;
      $("f-opp").appendChild(o);
    });

    buildPresets();
    initSearch();
    initMap();

    ["f-from", "f-to", "f-venue", "f-opp", "f-measure"].forEach(function (id) {
      $(id).addEventListener("change", render);
    });
    $("reset").addEventListener("click", function () { setDefaults(); render(); });
    $("copy-link").addEventListener("click", copyLink);

    setDefaults();
    var spotFromUrl = readUrl();
    render();
    if (spotFromUrl) openSpotlight(spotFromUrl, false);
  }).catch(A.showError);
})();
