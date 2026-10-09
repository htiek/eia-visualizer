"use client";

import { useState } from "react";
import { formatGwh, formatShare } from "@/lib/format";
import type { PieSlice } from "@/lib/pie";
import { LABELS } from "@/lib/sources";
import styles from "./PieChart.module.css";

const SIZE = 240;
const R = SIZE / 2;

// Angles are fractions of a turn, clockwise from 12 o'clock.
function point(turn: number, radius: number): [number, number] {
  const angle = turn * 2 * Math.PI;
  return [R + radius * Math.sin(angle), R - radius * Math.cos(angle)];
}

function slicePath(start: number, end: number): string {
  if (end - start > 0.9999) {
    return `M ${R} 0 A ${R} ${R} 0 1 1 ${R} ${SIZE} A ${R} ${R} 0 1 1 ${R} 0 Z`;
  }
  const [x0, y0] = point(start, R);
  const [x1, y1] = point(end, R);
  const largeArc = end - start > 0.5 ? 1 : 0;
  return `M ${R} ${R} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

function membersText(slice: PieSlice): string {
  return slice.members.map((m) => LABELS[m]).join(", ");
}

export default function PieChart({ slices }: { slices: PieSlice[] }) {
  const [active, setActive] = useState<PieSlice["key"] | null>(null);

  const arcs = slices.map((slice, i) => {
    const start = slices.slice(0, i).reduce((sum, s) => sum + s.share, 0);
    return { ...slice, start, end: start + slice.share };
  });
  const current = arcs.find((a) => a.key === active);
  const hover = (key: PieSlice["key"]) => ({
    onPointerEnter: () => setActive(key),
    onPointerLeave: () => setActive(null),
  });

  return (
    <div className={styles.chart}>
      <div className={styles.plot}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Pie chart of generation by source">
          {arcs.map((arc) => (
            <path
              key={arc.key}
              d={slicePath(arc.start, arc.end)}
              fill={`var(--color-${arc.key})`}
              className={styles.slice}
              data-dimmed={active !== null && active !== arc.key}
              tabIndex={0}
              aria-label={`${arc.label}: ${formatShare(arc.share)}, ${formatGwh(arc.mwh)}`}
              onFocus={() => setActive(arc.key)}
              onBlur={() => setActive(null)}
              {...hover(arc.key)}
            />
          ))}
        </svg>
        {current && <Tooltip arc={current} />}
      </div>

      <ul className={styles.legend}>
        {arcs.map((arc) => (
          <li key={arc.key} className={styles.item} data-dimmed={active !== null && active !== arc.key} {...hover(arc.key)}>
            <span className={styles.swatch} style={{ background: `var(--color-${arc.key})` }} aria-hidden />
            <span className={styles.name}>
              {arc.label}
              {arc.key === "smaller" && <span className={styles.members}>{membersText(arc)}</span>}
            </span>
            <span className={styles.share}>{formatShare(arc.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tooltip({ arc }: { arc: PieSlice & { start: number; end: number } }) {
  // Sit over the middle of the slice, a little outside its center of mass.
  const [x, y] = point((arc.start + arc.end) / 2, arc.share > 0.9999 ? 0 : R * 0.6);
  return (
    <div className={styles.tooltip} style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }} aria-hidden>
      <span className={styles.tooltipName}>
        <span className={styles.swatch} style={{ background: `var(--color-${arc.key})` }} />
        {arc.label}
      </span>
      {arc.key === "smaller" && <span className={styles.tooltipDetail}>{membersText(arc)}</span>}
      <span className={styles.tooltipValue}>
        {formatShare(arc.share)} · {formatGwh(arc.mwh)}
      </span>
    </div>
  );
}
