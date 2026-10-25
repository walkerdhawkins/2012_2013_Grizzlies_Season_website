# Grizzlies 2012–13: Did the Rudy Gay trade help?

**Question:** How much did the Grizzlies’ win percentage improve after they traded Rudy Gay in January 2013?
**Reader:** A casual NBA fan who has heard the trade “saved” the season and wants to know if that’s true.
**Rows counted:** One row is one regular-season game (82 rows).
**Period:** October 31, 2012 to April 17, 2013. A game is “Before” if it was played before January 30, 2013 and “After” if it was played on or after that date (games 1–44 and 45–82).

A two-page website built for FINN 43303, Project B (Walton College, University of Arkansas).
Everything is plain HTML, CSS, and JavaScript. The pages load `games.csv` in the browser and do every calculation there.

## Files

| File | What it is |
|---|---|
| `index.html` | The report page: answer, four summary numbers, three findings with charts, and the data and method section. |
| `dashboard.html` | The dashboard page: quick period buttons, filters, the same four numbers, charts, a map, a team search with spotlight card, and a table of the games in view. |
| `app.js` | Shared code: CSV loader, the calculations, number formatting, SVG charts, and the count-up, scroll-reveal, and dark-mode helpers. |
| `report.js` | Fills in the report page’s numbers and draws its charts. |
| `dashboard.js` | Connects the dashboard’s filters, address-bar links, search, map, and spotlight to the numbers and charts. |
| `style.css` | The one look shared by both pages, in light and dark themes. |
| `games.csv` | The data: one row per regular-season game. |
| `teams.csv` | Where each opponent plays (city, latitude, longitude), used only to place the map circles. |
| `README.md` | This file. |

## Features

- **Four summary numbers** count up when the page loads (they always end on the exact calculated value), and each finding fades in as you scroll to it. Both are turned off for visitors who ask their device for reduced motion.
- **Quick period buttons** on the dashboard: whole season, before the trade, after the trade, first and last halves, and the last 20 games.
- **Team search** with autocomplete opens a spotlight card with that opponent’s record, win %, and average margin next to the season-long figures, plus a chart of each game’s margin against the season average.
- **Shareable links:** every filter, the chart measure, and the open spotlight are written to the address bar, so “Copy link to this view” sends exactly what you see.
- **Map** of the opponents’ cities, colored by the Grizzlies’ record against each team in the current view. Click a circle to open its spotlight.
- **Dark mode** switch in the navigation bar (remembers your choice; starts from your device’s setting).

None of these changes a number: the four summary numbers and their definitions are the same as in the report.

## The data files

`games.csv` has 82 rows and these columns:

| Column | Meaning |
|---|---|
| `game` | Game number in the regular season, 1–82 |
| `date` | Date played (YYYY-MM-DD) |
| `start_et` | Tip-off time, Eastern |
| `home_away` | `Home` or `Away` (the original file used `vs` and `at`) |
| `opponent` | Opposing team |
| `result` | `W` or `L` for the Grizzlies |
| `overtime` | `OT` if the game went to overtime, otherwise blank |
| `team_points` | Grizzlies points |
| `opponent_points` | Opponent points |
| `wins_to_date`, `losses_to_date` | Grizzlies record after the game |
| `streak` | Current streak after the game |
| `attendance` | Reported attendance (the opponent’s arena on away games) |
| `game_length` | Length of the game (hours:minutes:seconds) |

The site uses `game`, `date`, `home_away`, `opponent`, `result`, `team_points`, and `opponent_points`. The “Before/After” label and every statistic are calculated in the browser.

`teams.csv` has one row per team: `opponent`, `city`, `latitude`, `longitude` (the arena’s approximate location, plus a Memphis row for the home base). The Lakers and Clippers share an arena, so their circles are offset slightly to keep both visible.

## Where the data came from

The game log is the Memphis Grizzlies 2012–13 regular-season schedule and results from [Basketball-Reference.com](https://www.basketball-reference.com/), saved as a spreadsheet and converted to `games.csv` (dates written as YYYY-MM-DD, `vs`/`at` relabeled `Home`/`Away`, no rows removed or changed otherwise).
The trade date (January 30, 2013) comes from news reports of the three-team deal with Toronto and Detroit, for example [Sports Illustrated](https://www.si.com/nba/2013/01/30/rudy-gay-memphis-grizzlies-toronto-raptors-detroit-pistons).

## Outside libraries

The map uses [Leaflet](https://leafletjs.com/) (loaded from unpkg.com) and map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. If either cannot load, the map area shows a short message and the rest of the dashboard works normally. Nothing else is loaded from outside this repository.

## Running it locally

Browsers will not load `games.csv` from a page opened straight from a folder. From this folder run:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Author

Walker Hawkins
