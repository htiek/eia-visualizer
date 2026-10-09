import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Hour } from "./eia";
import { parseRows } from "./eia";
import { parseEmissionsCsv } from "./emissions";
import { analyze, inferChargingMix, mixOf, selectablePeriods, storageFactorFor } from "./grid";

const factors = parseEmissionsCsv(readFileSync(path.join(__dirname, "..", "emissions.csv"), "utf8"));

// Every hour needs these sources reported to count; zero-fill the ones a test doesn't care about.
function hour(period: string, mwhByFuel: Record<string, number>): Hour {
  return { period, mwhByFuel: { NG: 0, COL: 0, NUC: 0, WAT: 0, WND: 0, SUN: 0, ...mwhByFuel } };
}

describe("mixOf", () => {
  it("counts every non-generating category as storage, split into charging and discharging", () => {
    const mix = mixOf(hour("2026-10-08T03", { NG: 100, SNB: 7, WNB: 3, BAT: -20, PS: 5, OTH: 8, OES: -1, UES: 2, UNK: 1, XYZ: 4 }));
    expect(mix.generation.gas).toBe(100);
    expect(mix.generation.solar).toBe(7);
    expect(mix.generation.wind).toBe(3);
    expect(mix.discharged).toBe(5 + 8 + 2 + 1 + 4);
    expect(mix.charged).toBe(21);
  });

  it("treats a generator's slightly negative output as zero", () => {
    const mix = mixOf(hour("2026-10-08T03", { SUN: 30, SNB: -31 }));
    expect(mix.generation.solar).toBe(30);
    expect(mix.charged).toBe(0);
  });
});

describe("inferChargingMix", () => {
  it("weights each hour's generation mix by how much storage charged in it", () => {
    const charging = inferChargingMix([
      mixOf(hour("2026-10-08T01", { NG: 60, SUN: 40, BAT: -10 })),
      mixOf(hour("2026-10-08T02", { COL: 50, NG: 50, BAT: -30 })),
      mixOf(hour("2026-10-08T03", { NUC: 100, BAT: 25 })), // discharging only: ignored
    ]);
    expect(charging.method).toBe("charging");
    expect(charging.chargedMwh).toBe(40);
    expect(charging.hoursConsidered).toBe(3);
    expect(charging.shares.gas).toBeCloseTo(21 / 40);
    expect(charging.shares.solar).toBeCloseTo(4 / 40);
    expect(charging.shares.coal).toBeCloseTo(15 / 40);
    expect(charging.shares.nuclear).toBe(0);
  });

  it("falls back to the average generation mix when storage never charged", () => {
    const charging = inferChargingMix([
      mixOf(hour("2026-10-08T01", { NG: 75, BAT: 10 })),
      mixOf(hour("2026-10-08T02", { NUC: 25 })),
    ]);
    expect(charging.method).toBe("average");
    expect(charging.chargedMwh).toBe(0);
    expect(charging.shares.gas).toBeCloseTo(0.75);
    expect(charging.shares.nuclear).toBeCloseTo(0.25);
  });
});

describe("storageFactorFor", () => {
  it("matches the worked examples in METHODOLOGY.md", () => {
    // Utility solar through a battery: 48 ÷ 0.85 + 25 ≈ 80.
    expect(storageFactorFor(factors.sources.solar, factors.batteryAdder).lifecycle).toBeCloseTo(48 / 0.85 + 25);
    // Gas through a battery: 490 ÷ 0.85 + 25 ≈ 600.
    expect(storageFactorFor(factors.sources.gas, factors.batteryAdder).lifecycle).toBeCloseTo(601.47, 1);
    // A battery burns nothing, so only the charging source's direct emissions carry through.
    expect(storageFactorFor(factors.sources.gas, factors.batteryAdder).direct).toBeCloseTo(370 / 0.85);
  });
});

const hours = [
  hour("2026-10-07T02", { COL: 1000, BAT: -1000 }),
  hour("2026-10-08T01", { NG: 60, SUN: 40, BAT: -10 }),
  hour("2026-10-08T02", { COL: 50, NG: 50, BAT: -30, PS: 5 }),
  hour("2026-10-08T03", { NG: 80, NUC: 20, BAT: 25, OTH: 5 }),
  { period: "2026-10-08T04", mwhByFuel: { NG: 90 } }, // not fully reported yet
];

const fixture = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "us48-2026-10-08.json"), "utf8"));
const realHours = parseRows(fixture.response.data)!;

describe("selectablePeriods", () => {
  it("lists fully reported hours within a day of the newest one, oldest first", () => {
    // 2026-10-07T02 is 25 hours before the newest reported hour.
    expect(selectablePeriods(hours)).toEqual(["2026-10-08T01", "2026-10-08T02", "2026-10-08T03"]);
  });

  it("offers 24 hours from a real EIA response", () => {
    const periods = selectablePeriods(realHours);
    expect(periods).toHaveLength(24);
    expect(periods[0]).toBe("2026-10-07T04");
    expect(periods[23]).toBe("2026-10-08T03");
  });

  it("is empty when nothing is fully reported", () => {
    expect(selectablePeriods([{ period: "2026-10-08T04", mwhByFuel: { NG: 90 } }])).toEqual([]);
  });
});

describe("analyze", () => {
  it("estimates an hour's emissions, pricing storage by what charged it in the day before", () => {
    const analysis = analyze(hours, factors, "2026-10-08T03")!;
    expect(analysis.hour.period).toBe("2026-10-08T03");
    expect(analysis.totalMwh).toBe(130);
    // 2026-10-07T02 is more than 24 hours earlier, so it's left out.
    expect(analysis.charging.hoursConsidered).toBe(2);
    expect(analysis.charging.chargedMwh).toBe(40);

    // Charged 52.5% gas, 37.5% coal, 10% solar.
    expect(analysis.chargingFactor.lifecycle).toBeCloseTo(0.525 * 490 + 0.375 * 820 + 0.1 * 48);
    expect(analysis.storageFactor.lifecycle).toBeCloseTo(569.55 / 0.85 + 25);
    expect(analysis.storageFactor.direct).toBeCloseTo(479.25 / 0.85);

    // 80 MWh gas + 20 MWh nuclear + 30 MWh out of storage.
    expect(analysis.intensity.lifecycle).toBeCloseTo((80 * 490 + 20 * 12 + 30 * (569.55 / 0.85 + 25)) / 130);
    expect(analysis.intensity.direct).toBeCloseTo((80 * 370 + 30 * (479.25 / 0.85)) / 130);

    const storage = analysis.rows.find((r) => r.modality === "storage")!;
    expect(storage.mwh).toBe(30);
    expect(storage.share).toBeCloseTo(30 / 130);
    expect(analysis.rows.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1);
  });

  it("looks back from the chosen hour, never ahead of it", () => {
    const analysis = analyze(hours, factors, "2026-10-08T01")!;
    expect(analysis.charging.hoursConsidered).toBe(1);
    expect(analysis.charging.shares.coal).toBe(1);
  });

  it("returns null for an hour that's missing or not fully reported", () => {
    expect(analyze(hours, factors, "2026-10-08T04")).toBeNull();
    expect(analyze(hours, factors, "2026-10-09T00")).toBeNull();
  });

  it("uses the hour itself when there's no earlier data", () => {
    const analysis = analyze([hour("2026-10-08T03", { NG: 50, NUC: 50, BAT: 10 })], factors, "2026-10-08T03")!;
    expect(analysis.charging.method).toBe("average");
    expect(analysis.charging.shares.gas).toBeCloseTo(0.5);
  });

  it("produces plausible numbers for a real EIA response", () => {
    const analysis = analyze(realHours, factors, "2026-10-08T03")!;
    // BAT 7,514 + OTH 14,867 + PS 2,259 out; UES took in 16.
    expect(analysis.hour.discharged).toBe(24640);
    expect(analysis.hour.charged).toBe(16);
    expect(analysis.charging.hoursConsidered).toBe(24);
    expect(analysis.charging.method).toBe("charging");
    expect(analysis.intensity.lifecycle).toBeGreaterThan(300);
    expect(analysis.intensity.lifecycle).toBeLessThan(600);
    expect(analysis.intensity.direct).toBeLessThan(analysis.intensity.lifecycle);
  });
});
