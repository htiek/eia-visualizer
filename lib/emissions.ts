import { BATTERY_ROW, EMISSIONS_ROWS, SOURCES, type Source } from "./sources";

// Grams of CO₂-equivalent per kWh. See METHODOLOGY.md for what each column covers.
export type Factor = { direct: number; lifecycle: number };

export type EmissionFactors = {
  sources: Record<Source, Factor>;
  // A battery's own manufacturing emissions per kWh it delivers, not counting
  // the electricity that charged it.
  batteryAdder: Factor;
};

// Parses emissions.csv ("Modality,Direct,Lifecycle"). Throws with a readable
// message if the file isn't in that shape or is missing a row the app needs.
export function parseEmissionsCsv(text: string): EmissionFactors {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const header = lines.shift()?.split(",").map((cell) => cell.trim());
  if (header?.join(",") !== "Modality,Direct,Lifecycle") {
    throw new Error('emissions.csv should start with the header "Modality,Direct,Lifecycle".');
  }

  const rows = new Map<string, Factor>();
  for (const line of lines) {
    const cells = line.split(",").map((cell) => cell.trim());
    const [name, direct, lifecycle] = [cells[0], Number(cells[1]), Number(cells[2])];
    if (cells.length !== 3 || cells[1] === "" || cells[2] === "" || !Number.isFinite(direct) || !Number.isFinite(lifecycle)) {
      throw new Error(`emissions.csv has a row that isn't "name,number,number": ${line}`);
    }
    rows.set(name, { direct, lifecycle });
  }

  const lookup = (name: string): Factor => {
    const factor = rows.get(name);
    if (!factor) throw new Error(`emissions.csv has no "${name}" row.`);
    return factor;
  };
  return {
    sources: Object.fromEntries(SOURCES.map((s) => [s, lookup(EMISSIONS_ROWS[s])])) as Record<Source, Factor>,
    batteryAdder: lookup(BATTERY_ROW),
  };
}
