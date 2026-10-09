import type { EmissionFactors, Factor } from "./emissions";
import type { Hour } from "./eia";
import { MODALITIES, modalityOf, SOURCES, zeroBySource, type Modality, type Source } from "./sources";
import { hoursBetween } from "./time";

// Share of the energy put into storage that comes back out (see METHODOLOGY.md).
export const ROUND_TRIP_EFFICIENCY = 0.85;

// Grid batteries mostly charge and discharge once a day, so whatever storage
// delivers now was most likely put in sometime during the previous day.
export const LOOKBACK_HOURS = 24;

// How far back the reader can pick an hour, counting the newest reported one.
export const SELECTABLE_HOURS = 24;

// An hour counts as reported once each of these has a value.
const REQUIRED_FUELS = ["NG", "COL", "NUC", "WAT", "WND", "SUN"];

export type HourMix = {
  period: string;
  generation: Record<Source, number>; // MWh
  discharged: number; // MWh storage delivered to the grid
  charged: number; // MWh storage took from the grid
};

export type ChargingMix = {
  shares: Record<Source, number>; // fraction of the charging energy from each source
  hoursConsidered: number;
  chargedMwh: number;
  // "charging": weighted by the energy storage took in each hour.
  // "average": no charging was recorded, so it's the plain generation mix.
  method: "charging" | "average";
};

export type BreakdownRow = { modality: Modality; mwh: number; share: number; factor: Factor };

export type Analysis = {
  hour: HourMix;
  rows: BreakdownRow[];
  totalMwh: number;
  intensity: Factor; // per kWh generated in `hour`
  charging: ChargingMix;
  chargingFactor: Factor; // per kWh that went into storage
  batteryAdder: Factor; // the battery's own emissions per kWh delivered
  storageFactor: Factor; // per kWh that came back out
};

export function mixOf(hour: Hour): HourMix {
  const generation = zeroBySource();
  let discharged = 0;
  let charged = 0;
  for (const [fuel, mwh] of Object.entries(hour.mwhByFuel)) {
    const modality = modalityOf(fuel);
    if (modality === "storage") {
      if (mwh > 0) discharged += mwh;
      else charged -= mwh;
    } else {
      // An idle plant's net generation goes slightly negative from the power it
      // draws for itself. That's load, not generation.
      generation[modality] += Math.max(0, mwh);
    }
  }
  return { period: hour.period, generation, discharged, charged };
}

function totalOf(generation: Record<Source, number>): number {
  return SOURCES.reduce((sum, s) => sum + generation[s], 0);
}

// Storage takes its charging energy from the grid, so each MWh it absorbs in an
// hour is assumed to have that hour's generation mix. Averaging over every hour
// in `history`, weighted by how much storage absorbed, gives the mix of what's
// stored now.
export function inferChargingMix(history: HourMix[]): ChargingMix {
  const shares = zeroBySource();
  let chargedMwh = 0;
  for (const hour of history) {
    const total = totalOf(hour.generation);
    if (hour.charged <= 0 || total <= 0) continue;
    chargedMwh += hour.charged;
    for (const s of SOURCES) shares[s] += (hour.charged * hour.generation[s]) / total;
  }
  let weight = chargedMwh;
  let method: ChargingMix["method"] = "charging";

  if (chargedMwh === 0) {
    method = "average";
    for (const hour of history) {
      for (const s of SOURCES) shares[s] += hour.generation[s];
    }
    weight = history.reduce((sum, hour) => sum + totalOf(hour.generation), 0);
  }
  if (weight > 0) {
    for (const s of SOURCES) shares[s] /= weight;
  }
  return { shares, hoursConsidered: history.length, chargedMwh, method };
}

function blend(shares: Record<Source, number>, factors: Record<Source, Factor>): Factor {
  return {
    direct: SOURCES.reduce((sum, s) => sum + shares[s] * factors[s].direct, 0),
    lifecycle: SOURCES.reduce((sum, s) => sum + shares[s] * factors[s].lifecycle, 0),
  };
}

// A kWh out of storage carries the emissions of the energy that charged it,
// grossed up for what's lost on the round trip, plus the battery's own
// manufacturing emissions.
export function storageFactorFor(chargingFactor: Factor, batteryAdder: Factor): Factor {
  return {
    direct: chargingFactor.direct / ROUND_TRIP_EFFICIENCY + batteryAdder.direct,
    lifecycle: chargingFactor.lifecycle / ROUND_TRIP_EFFICIENCY + batteryAdder.lifecycle,
  };
}

function isReported(hour: Hour): boolean {
  return REQUIRED_FUELS.every((fuel) => fuel in hour.mwhByFuel);
}

// The fully reported hours from the last SELECTABLE_HOURS, oldest first,
// counting back from the newest one rather than from now: EIA's national
// totals trail real time by hours.
export function selectablePeriods(hours: Hour[]): string[] {
  const latest = hours.findLast(isReported);
  if (!latest) return [];
  return hours
    .filter((h) => isReported(h) && hoursBetween(h.period, latest.period) < SELECTABLE_HOURS)
    .map((h) => h.period);
}

// Estimates the emissions per kWh of the hour `period` from `hours` (oldest
// first). Returns null if that hour isn't there or isn't fully reported.
export function analyze(hours: Hour[], factors: EmissionFactors, period: string): Analysis | null {
  const target = hours.find((h) => h.period === period);
  if (!target || !isReported(target)) return null;
  const hour = mixOf(target);

  const history = hours
    .filter((h) => {
      const before = hoursBetween(h.period, period);
      return before > 0 && before <= LOOKBACK_HOURS;
    })
    .map(mixOf);

  // With no earlier hours to go on, the hour's own mix is the best guess.
  const charging = inferChargingMix(history.length > 0 ? history : [hour]);
  const chargingFactor = blend(charging.shares, factors.sources);
  const storageFactor = storageFactorFor(chargingFactor, factors.batteryAdder);

  const entries = MODALITIES.map((modality) =>
    modality === "storage"
      ? { modality, mwh: hour.discharged, factor: storageFactor }
      : { modality, mwh: hour.generation[modality], factor: factors.sources[modality] },
  );
  const totalMwh = entries.reduce((sum, e) => sum + e.mwh, 0);
  const rows = entries.map((e) => ({ ...e, share: totalMwh > 0 ? e.mwh / totalMwh : 0 }));
  const intensity = {
    direct: rows.reduce((sum, r) => sum + r.share * r.factor.direct, 0),
    lifecycle: rows.reduce((sum, r) => sum + r.share * r.factor.lifecycle, 0),
  };

  return { hour, rows, totalMwh, intensity, charging, chargingFactor, batteryAdder: factors.batteryAdder, storageFactor };
}
