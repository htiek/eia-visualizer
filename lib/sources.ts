// Every kind of supply, in the order it's listed and drawn.
export const MODALITIES = ["gas", "coal", "nuclear", "hydro", "wind", "solar", "storage", "oil", "geothermal"] as const;
export type Modality = (typeof MODALITIES)[number];

// Storage isn't a generating source: it only hands back energy something else
// generated earlier, so its emissions are worked out from what charged it.
export type Source = Exclude<Modality, "storage">;
export const SOURCES = MODALITIES.filter((m): m is Source => m !== "storage");

export const LABELS: Record<Modality, string> = {
  gas: "Natural gas",
  coal: "Coal",
  nuclear: "Nuclear",
  hydro: "Hydro",
  wind: "Wind",
  solar: "Solar",
  oil: "Oil",
  geothermal: "Geothermal",
  storage: "Storage",
};

// The emissions.csv row used for each source. EIA's hourly data only covers
// utility-scale plants (rooftop solar is behind the meter) and doesn't split
// onshore from offshore wind; nearly all U.S. wind is onshore.
export const EMISSIONS_ROWS: Record<Source, string> = {
  gas: "Natural Gas",
  coal: "Coal",
  nuclear: "Nuclear",
  hydro: "Hydropower",
  wind: "Wind (Onshore)",
  solar: "Solar PV (Utility)",
  oil: "Oil",
  geothermal: "Geothermal",
};
export const BATTERY_ROW = "Battery Storage (adder only)";

// EIA-930 energy source codes for generating fuels. Hybrid plants (solar or
// wind with a battery on site) count as their generating source.
const SOURCE_BY_FUEL: Record<string, Source> = {
  NG: "gas",
  COL: "coal",
  NUC: "nuclear",
  WAT: "hydro",
  WND: "wind",
  WNB: "wind",
  SUN: "solar",
  SNB: "solar",
  OIL: "oil",
  GEO: "geothermal",
};

// Everything else — BAT (battery), PS (pumped storage), OTH (other),
// OES (other energy storage), UES (unknown energy storage), UNK (unknown),
// and any code EIA adds later — is treated as battery storage.
export function modalityOf(fuel: string): Modality {
  return SOURCE_BY_FUEL[fuel] ?? "storage";
}

export function zeroBySource(): Record<Source, number> {
  return Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<Source, number>;
}
