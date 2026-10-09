// EIA API v2, "Hourly Net Generation by Balancing Authority and Energy Source"
// (Form EIA-930). Docs: https://www.eia.gov/opendata/documentation.php
const ENDPOINT = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";

// EIA's shared key. It works without signing up, but only allows about 10
// requests a day per IP address, so you'll want your own (see the README).
export const DEMO_KEY = "DEMO_KEY";

// EIA's own total for the contiguous United States.
export const RESPONDENT = "US48";

// The newest rows first. At about 16 energy sources an hour this is roughly
// five days, comfortably more than the latest hour plus a day of history,
// even though EIA's national totals run hours behind real time.
export const ROW_LIMIT = 2000;

// One hour of net generation in megawatt-hours, keyed by EIA energy source
// code ("NG", "SUN", "BAT", ...). `period` is the UTC hour it ends on, as EIA
// writes it: "2026-10-08T03" covers 02:00–03:00 UTC.
export type Hour = { period: string; mwhByFuel: Record<string, number> };

export type FetchResult = { ok: true; hours: Hour[] } | { ok: false; error: string };

type EiaRow = {
  period: string;
  fueltype: string;
  value: string | number | null;
  "value-units": string;
};

export function buildUrl(apiKey: string): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "hourly",
    "data[0]": "value",
    "facets[respondent][]": RESPONDENT,
    "sort[0][column]": "period",
    "sort[0][direction]": "desc",
    length: String(ROW_LIMIT),
  });
  // URLSearchParams escapes the brackets; EIA's docs write them literally.
  return `${ENDPOINT}?${params.toString().replaceAll("%5B", "[").replaceAll("%5D", "]")}`;
}

// Groups EIA's rows into hours, oldest first. Returns null if the rows aren't
// in the shape this app expects.
export function parseRows(rows: EiaRow[]): Hour[] | null {
  const byPeriod = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (row["value-units"] !== "megawatthours" || typeof row.period !== "string") return null;
    const mwhByFuel = byPeriod.get(row.period) ?? {};
    byPeriod.set(row.period, mwhByFuel);
    // A missing value means that source hasn't been reported for that hour.
    if (row.value === null || row.value === "") continue;
    const mwh = Number(row.value);
    if (!Number.isFinite(mwh)) return null;
    mwhByFuel[row.fueltype] = mwh;
  }
  return [...byPeriod]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, mwhByFuel]) => ({ period, mwhByFuel }));
}

function httpError(status: number, apiKey: string): string {
  if (status === 429) {
    return apiKey === DEMO_KEY
      ? "EIA's rate limit was reached. The shared DEMO_KEY only allows about 10 requests a day. Add your own free API key to .env.local (see the README)."
      : "EIA's rate limit was reached for your API key. Try again in a few minutes.";
  }
  if (status === 401 || status === 403) {
    return "EIA rejected the API key. Check EIA_API_KEY in .env.local.";
  }
  return `The EIA API responded with HTTP ${status}.`;
}

// The newest few days of hourly Lower 48 generation by energy source.
// Expected failures (bad key, rate limit, network trouble) come back as
// { ok: false } rather than throwing.
export async function fetchHours(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetchImpl(buildUrl(apiKey));
  } catch {
    return { ok: false, error: "Couldn't reach the EIA API at api.eia.gov. Check your internet connection." };
  }

  if (!response.ok) return { ok: false, error: httpError(response.status, apiKey) };

  let rows: EiaRow[] | null = null;
  try {
    const body = await response.json();
    rows = Array.isArray(body?.response?.data) ? body.response.data : null;
  } catch {
    // Fall through to the error below.
  }
  const hours = rows && parseRows(rows);
  if (!rows || !hours) return { ok: false, error: "The EIA API sent back data in a format this app doesn't recognize." };

  // When the response is cut off at ROW_LIMIT, the oldest hour may be missing
  // some of its sources.
  if (rows.length >= ROW_LIMIT) hours.shift();
  return { ok: true, hours };
}
