import { describe, expect, it } from "vitest";
import type { BreakdownRow } from "./grid";
import { pieSlices } from "./pie";
import type { Modality } from "./sources";

const factor = { direct: 0, lifecycle: 0 };
function rows(mwh: Partial<Record<Modality, number>>): BreakdownRow[] {
  const total = Object.values(mwh).reduce((sum, v) => sum + v, 0);
  return Object.entries(mwh).map(([modality, v]) => ({ modality: modality as Modality, mwh: v, share: v / total, factor }));
}

describe("pieSlices", () => {
  it("folds oil, geothermal and anything under 2% into one slice at the end", () => {
    const slices = pieSlices(rows({ gas: 600, solar: 10, storage: 100, oil: 150, geothermal: 40, wind: 100 }));
    expect(slices.map((s) => s.key)).toEqual(["gas", "storage", "wind", "smaller"]);
    expect(slices[3]).toMatchObject({ label: "Smaller sources", mwh: 200, members: ["solar", "oil", "geothermal"] });
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it("skips sources that generated nothing", () => {
    const slices = pieSlices(rows({ gas: 500, storage: 0, oil: 0, coal: 500 }));
    expect(slices.map((s) => s.key)).toEqual(["gas", "coal"]);
  });
});
