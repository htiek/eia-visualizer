import type { BreakdownRow } from "./grid";
import { LABELS, type Modality } from "./sources";

// Modalities big enough to get their own slice and color. Oil and geothermal
// are each well under 1% of U.S. generation, so they always join "Smaller sources".
export const OWN_SLICE: Modality[] = ["gas", "coal", "nuclear", "hydro", "wind", "solar", "storage"];

// Anything below this share is too thin to see as its own slice.
export const MIN_SLICE_SHARE = 0.02;

export type PieSlice = {
  key: Modality | "smaller";
  label: string;
  mwh: number;
  share: number;
  members: Modality[]; // what the slice is made of; more than one only for "smaller"
};

// Slices in drawing order, skipping anything that generated nothing.
export function pieSlices(rows: BreakdownRow[]): PieSlice[] {
  const slices: PieSlice[] = [];
  const smaller: PieSlice = { key: "smaller", label: "Smaller sources", mwh: 0, share: 0, members: [] };
  for (const row of rows) {
    if (row.mwh <= 0) continue;
    if (OWN_SLICE.includes(row.modality) && row.share >= MIN_SLICE_SHARE) {
      slices.push({ key: row.modality, label: LABELS[row.modality], mwh: row.mwh, share: row.share, members: [row.modality] });
    } else {
      smaller.mwh += row.mwh;
      smaller.share += row.share;
      smaller.members.push(row.modality);
    }
  }
  if (smaller.members.length > 0) slices.push(smaller);
  return slices;
}
