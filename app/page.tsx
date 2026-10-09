import Link from "next/link";
import { Suspense } from "react";
import HourPicker from "@/components/HourPicker";
import { HourRange, Timestamp } from "@/components/LocalTime";
import PieChart from "@/components/PieChart";
import { getEmissionFactors, getHours } from "@/lib/data";
import { formatGrams, formatGwh, formatShare } from "@/lib/format";
import { analyze, LOOKBACK_HOURS, ROUND_TRIP_EFFICIENCY, selectablePeriods, type Analysis } from "@/lib/grid";
import { pieSlices } from "@/lib/pie";
import { LABELS, SOURCES } from "@/lib/sources";
import { hoursBetween, hoursOld } from "@/lib/time";
import styles from "./page.module.css";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Contiguous United States · EIA hourly grid data</p>
        <h1>The last hour on the U.S. grid</h1>
        <p className={styles.lede}>
          Which kinds of power plants supplied the Lower 48 states in the latest hour the U.S. Energy Information
          Administration has published, or any of the 23 before it, and roughly how much CO₂ went into each
          kilowatt-hour.
        </p>
      </header>

      <Suspense fallback={<p className={styles.notice}>Loading data from EIA…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Report({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [data, emissions, query] = await Promise.all([getHours(), getEmissionFactors(), searchParams]);
  if (!data.ok) return <ErrorMessage title="Couldn’t load EIA data" message={data.error} />;
  if (!emissions.ok) return <ErrorMessage title="Couldn’t read the emission factors" message={emissions.error} />;

  const periods = selectablePeriods(data.hours);
  if (periods.length === 0) {
    return <p className={styles.notice}>EIA didn’t return a fully reported hour of data. Try again later.</p>;
  }
  // Every selectable hour is fully reported, so each one can be analyzed.
  const analyses = periods.map((period) => analyze(data.hours, emissions.factors, period)!);
  const latest = periods[periods.length - 1];
  const requested = typeof query.hour === "string" ? query.hour : undefined;
  const analysis = analyses.find((a) => a.hour.period === requested) ?? analyses[analyses.length - 1];

  const { hour, intensity, totalMwh } = analysis;
  // Storage charging is load, not generation. Mention it once it's big enough to show up in GWh.
  const chargingNow = hour.charged >= 0.001 * totalMwh;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.pickerHead}>
          <div>
            <p className={styles.label}>Hour shown</p>
            <h2 className={styles.hourShown}>
              <HourRange period={hour.period} />
            </h2>
          </div>
          <p className={styles.pickerStatus}>
            {hour.period === latest ? (
              // EIA's national totals trail real time, sometimes by more than a day.
              `The newest hour EIA has published, ${countHours(hoursOld(latest, data.fetchedAt))} old when retrieved`
            ) : (
              <>
                {countHours(hoursBetween(hour.period, latest))} before the newest EIA has published ·{" "}
                <Link href="/" scroll={false}>
                  Go to the newest
                </Link>
              </>
            )}
          </p>
        </div>
        {requested !== undefined && requested !== hour.period && (
          <p className={styles.chartNote}>
            The hour in the link isn’t one of the last {periods.length} EIA has published, so this shows the newest
            one instead.
          </p>
        )}
        <p className={styles.caption}>
          Lifecycle CO₂ per kWh in each of the last {periods.length} hours EIA has published. Select a bar to see that
          hour.
        </p>
        <HourPicker
          options={analyses.map((a) => ({ period: a.hour.period, lifecycle: a.intensity.lifecycle }))}
          selected={hour.period}
        />
      </section>

      <section className={styles.figures}>
        <div className={styles.hero}>
          <h2 className={styles.label}>CO₂ per kWh generated, lifecycle</h2>
          <p className={styles.heroValue}>
            {formatGrams(intensity.lifecycle)} <span className={styles.unit}>g CO₂e/kWh</span>
          </p>
          <p className={styles.sub}>Includes mining and drilling, methane leaks, and building the plants</p>
        </div>
        <div className={styles.tile}>
          <h2 className={styles.label}>Burned at the power plant</h2>
          <p className={styles.tileValue}>
            {formatGrams(intensity.direct)} <span className={styles.unit}>g CO₂/kWh</span>
          </p>
        </div>
        <div className={styles.tile}>
          <h2 className={styles.label}>Generated in the hour</h2>
          <p className={styles.tileValue}>{formatGwh(totalMwh)}</p>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Generation by source</h2>
        <p className={styles.caption}>
          Share of the electricity generated in that hour. “Storage” is everything EIA doesn’t tie to a generating
          fuel (batteries, pumped hydro, “other” and “unknown”), all treated as battery storage.
        </p>
        <PieChart slices={pieSlices(analysis.rows)} />
        {chargingNow && (
          <p className={styles.chartNote}>
            Storage also took in {formatGwh(hour.charged)} while charging. That’s demand, not generation, so it isn’t
            in the chart.
          </p>
        )}
      </section>

      <Breakdown analysis={analysis} />
      {hour.discharged > 0 && <StorageMix analysis={analysis} />}

      <footer className={styles.footer}>
        <p>
          Generation: U.S. Energy Information Administration, Form EIA-930 (hourly net generation by energy source,
          Lower 48 total) via the <a href="https://www.eia.gov/opendata/">EIA API</a>, retrieved{" "}
          <Timestamp at={data.fetchedAt} />. Emission factors: <code>emissions.csv</code>, mostly IPCC AR5 medians
          (see <code>METHODOLOGY.md</code>).
        </p>
        <p>
          Solar uses the utility-scale PV factor and wind the onshore one; EIA’s hourly data leaves out rooftop solar,
          and solar or wind plants with batteries on site count as solar or wind. Natural gas is priced as
          combined-cycle. EIA’s “other” category also includes biomass and waste, which this page counts as storage.
        </p>
      </footer>
    </>
  );
}

function Breakdown({ analysis }: { analysis: Analysis }) {
  const { rows, totalMwh, intensity } = analysis;
  return (
    <section className={styles.card}>
      <h2>How the estimate adds up</h2>
      <p className={styles.caption}>
        Each source’s emissions per kWh, weighted by its share of the hour. The weighted amounts add up to the average
        kWh.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Source
              </th>
              <th scope="col" rowSpan={2}>
                Generated
              </th>
              <th scope="col" rowSpan={2}>
                Share
              </th>
              <th scope="colgroup" colSpan={2} className={styles.group}>
                Lifecycle (g CO₂e)
              </th>
              <th scope="colgroup" colSpan={2} className={styles.group}>
                At the plant (g CO₂)
              </th>
            </tr>
            <tr>
              <th scope="col">per kWh</th>
              <th scope="col">weighted</th>
              <th scope="col">per kWh</th>
              <th scope="col">weighted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.modality} className={row.mwh === 0 ? styles.idle : undefined}>
                <th scope="row">
                  {LABELS[row.modality]}
                  {row.modality === "storage" && (
                    <>
                      {" "}
                      <a href="#storage" className={styles.footnote}>
                        (see below)
                      </a>
                    </>
                  )}
                </th>
                <td>{formatGwh(row.mwh)}</td>
                <td>{formatShare(row.share)}</td>
                <td>{formatGrams(row.factor.lifecycle)}</td>
                <td>{formatGrams(row.share * row.factor.lifecycle)}</td>
                <td>{formatGrams(row.factor.direct)}</td>
                <td>{formatGrams(row.share * row.factor.direct)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">All sources</th>
              <td>{formatGwh(totalMwh)}</td>
              <td>{formatShare(1)}</td>
              <td />
              <td>{formatGrams(intensity.lifecycle)}</td>
              <td />
              <td>{formatGrams(intensity.direct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function StorageMix({ analysis }: { analysis: Analysis }) {
  const { hour, charging, chargingFactor, batteryAdder, storageFactor } = analysis;
  const lookback = charging.hoursConsidered === LOOKBACK_HOURS ? `${LOOKBACK_HOURS} hours` : `${charging.hoursConsidered} hours EIA returned`;

  return (
    <section className={styles.card} id="storage">
      <h2>What charged the storage</h2>
      <p className={styles.caption}>
        Storage doesn’t generate electricity; it gives back electricity generated earlier. To price the{" "}
        {formatGwh(hour.discharged)} it delivered in this hour, this page looks back over the previous {lookback}.{" "}
        {charging.method === "charging" ? (
          <>
            Whenever storage was charging, the energy is assumed to have come from that hour’s generation mix, and each
            hour counts in proportion to how much storage took in ({formatGwh(charging.chargedMwh)} in all).
          </>
        ) : (
          <>Storage didn’t record any charging in that time, so this uses the average generation mix instead.</>
        )}
      </p>

      <div className={styles.split}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Charged from</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((source) => (
                <tr key={source} className={charging.shares[source] === 0 ? styles.idle : undefined}>
                  <th scope="row">{LABELS[source]}</th>
                  <td>{formatShare(charging.shares[source])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Per kWh</th>
                <th scope="col">Lifecycle (g CO₂e)</th>
                <th scope="col">At the plant (g CO₂)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Charging mix</th>
                <td>{formatGrams(chargingFactor.lifecycle)}</td>
                <td>{formatGrams(chargingFactor.direct)}</td>
              </tr>
              <tr>
                <th scope="row">÷ {ROUND_TRIP_EFFICIENCY} for round-trip losses</th>
                <td>{formatGrams(chargingFactor.lifecycle / ROUND_TRIP_EFFICIENCY)}</td>
                <td>{formatGrams(chargingFactor.direct / ROUND_TRIP_EFFICIENCY)}</td>
              </tr>
              <tr>
                <th scope="row">+ making the battery</th>
                <td>{formatGrams(batteryAdder.lifecycle)}</td>
                <td>{formatGrams(batteryAdder.direct)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Delivered from storage</th>
                <td>{formatGrams(storageFactor.lifecycle)}</td>
                <td>{formatGrams(storageFactor.direct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className={styles.chartNote}>
        This uses the national mix for each hour, so it can’t see that batteries in solar-heavy regions such as
        California and Texas charge mostly from local solar. It likely overstates the emissions of energy stored
        there.
      </p>
    </section>
  );
}

function countHours(hours: number): string {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function ErrorMessage({ title, message }: { title: string; message: string }) {
  return (
    <section className={styles.error} role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}
