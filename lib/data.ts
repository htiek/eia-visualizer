import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { DEMO_KEY, fetchHours, type FetchResult } from "./eia";
import { parseEmissionsCsv, type EmissionFactors } from "./emissions";

// Cached so the page doesn't call EIA on every visit. EIA adds about one hour
// of data an hour, so refreshing hourly keeps up. Failures are only cached
// briefly, so the next visit tries again.
export async function getHours(): Promise<FetchResult & { fetchedAt: string }> {
  "use cache";

  const apiKey = process.env.EIA_API_KEY || DEMO_KEY;
  const result = await fetchHours(apiKey);

  if (result.ok) {
    cacheLife("hours");
  } else {
    cacheLife("seconds");
  }
  return { ...result, fetchedAt: new Date().toISOString() };
}

export type EmissionsResult = { ok: true; factors: EmissionFactors } | { ok: false; error: string };

// Re-read every minute or so, so edits to emissions.csv show up without a restart.
export async function getEmissionFactors(): Promise<EmissionsResult> {
  "use cache";

  let text: string;
  try {
    text = await readFile(path.join(process.cwd(), "emissions.csv"), "utf8");
  } catch {
    cacheLife("seconds");
    return { ok: false, error: "Couldn't read emissions.csv from the project folder." };
  }
  try {
    const factors = parseEmissionsCsv(text);
    cacheLife("minutes");
    return { ok: true, factors };
  } catch (e) {
    cacheLife("seconds");
    return { ok: false, error: e instanceof Error ? e.message : "emissions.csv couldn't be read." };
  }
}
