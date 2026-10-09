"use client";

import { useSyncExternalStore } from "react";
import { formatHourRange, formatTimestamp } from "@/lib/time";

// The server doesn't know the reader's time zone, so it renders UTC and the
// browser switches to local time after hydrating.
const noSubscription = () => () => {};

export function useTimeZone(): string {
  return useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

export function HourRange({ period }: { period: string }) {
  const timeZone = useTimeZone();
  return <time dateTime={`${period}:00Z`}>{formatHourRange(period, timeZone)}</time>;
}

export function Timestamp({ at }: { at: string }) {
  const timeZone = useTimeZone();
  return <time dateTime={at}>{formatTimestamp(at, timeZone)}</time>;
}
