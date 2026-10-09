"use client";

import Link, { useLinkStatus } from "next/link";
import { useState } from "react";
import { formatGrams } from "@/lib/format";
import { formatHourRange, hourTick } from "@/lib/time";
import { useTimeZone } from "./LocalTime";
import styles from "./HourPicker.module.css";

export type HourOption = { period: string; lifecycle: number };

// The newest hour lives at "/" so the plain URL always means "the latest".
function hourHref(period: string, latest: string): string {
  return period === latest ? "/" : `/?hour=${period}`;
}

// A column chart of each hour's lifecycle CO₂ per kWh. Every column is a link
// to that hour, so picking an hour and reading the trend are the same gesture.
export default function HourPicker({ options, selected }: { options: HourOption[]; selected: string }) {
  const timeZone = useTimeZone();
  const [hovered, setHovered] = useState<string | null>(null);

  const latest = options[options.length - 1].period;
  // Round the axis up to the next 100 g so the gridlines land on round numbers.
  const top = Math.max(100, Math.ceil(Math.max(...options.map((o) => o.lifecycle)) / 100) * 100);
  const hoveredIndex = options.findIndex((o) => o.period === hovered);

  return (
    <div className={styles.picker}>
      <div className={styles.plot}>
        <div className={styles.grid} aria-hidden>
          {[1, 0.5, 0].map((fraction) => (
            <span key={fraction} className={styles.gridline} style={{ bottom: `${fraction * 100}%` }}>
              <span className={styles.gridLabel}>{formatGrams(top * fraction)}</span>
            </span>
          ))}
        </div>

        <nav className={styles.columns} aria-label="Choose an hour">
          {options.map((option) => (
            <Link
              key={option.period}
              href={hourHref(option.period, latest)}
              prefetch={false}
              scroll={false}
              className={styles.column}
              aria-current={option.period === selected ? "true" : undefined}
              aria-label={`${formatHourRange(option.period, timeZone)}: ${formatGrams(option.lifecycle)} g CO₂e per kWh`}
              onPointerEnter={() => setHovered(option.period)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(option.period)}
              onBlur={() => setHovered(null)}
            >
              <Bar height={option.lifecycle / top} />
            </Link>
          ))}
        </nav>

        {hoveredIndex >= 0 && (
          <div
            className={styles.tooltip}
            style={{ left: `${((hoveredIndex + 0.5) / options.length) * 100}%` }}
            data-edge={hoveredIndex < 3 ? "start" : hoveredIndex >= options.length - 3 ? "end" : undefined}
            aria-hidden
          >
            <span className={styles.tooltipTime}>{formatHourRange(options[hoveredIndex].period, timeZone)}</span>
            <span className={styles.tooltipValue}>{formatGrams(options[hoveredIndex].lifecycle)} g CO₂e/kWh</span>
          </div>
        )}
      </div>

      <div className={styles.ticks} aria-hidden>
        {options.map((option) => (
          <span key={option.period} className={styles.tick}>
            <span>{hourTick(option.period, timeZone)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Bar({ height }: { height: number }) {
  // Pulses while the clicked hour loads.
  const { pending } = useLinkStatus();
  return <span className={styles.bar} style={{ height: `${height * 100}%` }} data-pending={pending} />;
}
