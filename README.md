# The last hour on the U.S. grid

A Next.js site that asks the U.S. Energy Information Administration (EIA) where the Lower 48 states'
electricity came from in the most recent hour it has published. It draws that mix as a pie chart and
uses `emissions.csv` to estimate how much CO₂ went into each kilowatt-hour. A bar chart at the top
shows the estimate for each of the last 24 published hours; click a bar to see that hour instead.

## Running it

1. Get a free EIA API key at <https://www.eia.gov/opendata/register.php>. It's emailed to you right away.
2. Copy `.env.example` to `.env.local` and put your key in it:

   ```
   EIA_API_KEY=your-key-here
   ```

   Without a key the app falls back to EIA's shared `DEMO_KEY`. That works, but it
   only allows about 10 requests a day per IP address, and they're easy to use up.

3. Install and start:

   ```
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000>.

Run the unit tests with `npm test`.

## How it works

- `lib/eia.ts` asks EIA's API v2 for hourly net generation by energy source
  (`electricity/rto/fuel-type-data`, i.e. Form EIA-930), using EIA's own Lower 48 total (`US48`).
  One request returns the newest ~2,000 rows, about five days.
- `lib/data.ts` caches that request for an hour with `"use cache"`, and re-reads `emissions.csv`
  every minute or so, so edits to the CSV show up without restarting.
- `lib/sources.ts` maps EIA's energy source codes to sources and to rows of `emissions.csv`.
- `lib/grid.ts` does the estimate (see below) and lists the hours you can pick. `lib/pie.ts` turns
  an estimate into pie slices. `lib/time.ts` formats EIA's UTC hours.
- `app/page.tsx` renders the page. `components/HourPicker.tsx` draws the hour picker and
  `components/PieChart.tsx` the pie.

The chosen hour lives in the URL (`/?hour=2026-10-07T14`, EIA's UTC hour-ending format), so it can be
bookmarked or shared and the Back button works. Plain `/` always means the newest hour. A link to an
hour that has since dropped out of the last 24 falls back to the newest, with a note saying so.

## The estimate

**The hour.** EIA's national totals run behind real time, sometimes by more than a day, so the page
shows how old the newest hour was when it was retrieved. An hour counts as published once gas, coal,
nuclear, hydro, wind and solar have all been reported. The picker offers the newest such hour and the
23 before it, so "the last 24 hours" counts back from EIA's newest hour, not from now. Times are shown
in the reader's own time zone.

**Storage.** Every EIA category that isn't a specific generating fuel counts as battery storage:
battery (`BAT`), pumped storage (`PS`), other (`OTH`), other energy storage (`OES`), unknown energy
storage (`UES`) and unknown (`UNK`), plus any code EIA adds later. A positive value is storage
discharging (supply). A negative value is storage charging (demand), so it's left out of the hour's mix.
Solar and wind plants with batteries on site (`SNB`, `WNB`) count as solar and wind.

**What charged the storage.** The page looks back over the 24 hours before the hour shown, since grid
batteries mostly cycle once a day. It assumes the energy storage absorbed in each of those hours came
from that hour's generation mix, and weights each hour by how much storage absorbed. That blended mix
gives the emissions of a kWh going *into* storage. Following `METHODOLOGY.md`, a kWh coming back out
then costs

    (charging mix ÷ 0.85) + battery adder

where 0.85 is the round-trip efficiency, and the adder is 25 g/kWh lifecycle and 0 direct. If storage
didn't charge at all in that window, the plain average generation mix is used instead.

**The average kWh.** Each source's emission factor is weighted by its share of the hour's generation,
with storage priced as above. The page shows two results. The **lifecycle** figure (headline) includes
fuel extraction, methane leaks and plant construction. The **direct** figure counts only what the
plants burn.

**Factor choices.** Solar uses "Solar PV (Utility)" because EIA's hourly data covers only
utility-scale plants. Wind uses "Wind (Onshore)", since EIA doesn't split offshore out and U.S.
offshore wind is tiny. Natural gas uses the combined-cycle figure.

## Limitations

- EIA's "Other" category really covers biomass, waste and other fuels as well as storage. Counting it
  all as storage is this project's assumption, not EIA's definition.
- The charging mix uses the *national* mix for each hour. Batteries in solar-heavy regions such as
  California and Texas charge mostly from local solar, so the storage figure probably overstates their
  emissions. Fixing that would mean fetching each balancing authority separately: about 30,000 rows,
  or six requests per refresh, which `DEMO_KEY` can't sustain.
- Pumped storage is priced with the battery formula, including the battery-manufacturing adder.
