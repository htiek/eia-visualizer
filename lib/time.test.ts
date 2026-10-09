import { describe, expect, it } from "vitest";
import { formatHourRange, formatTimestamp, hoursBetween, hoursOld, hourTick, periodToDate } from "./time";

describe("periodToDate", () => {
  it("reads EIA's UTC hour", () => {
    expect(periodToDate("2026-10-08T03").toISOString()).toBe("2026-10-08T03:00:00.000Z");
  });
});

describe("hoursBetween", () => {
  it("counts across midnight", () => {
    expect(hoursBetween("2026-10-07T22", "2026-10-08T03")).toBe(5);
  });
});

describe("hoursOld", () => {
  it("counts whole hours since the hour ended", () => {
    expect(hoursOld("2026-10-08T03", "2026-10-09T04:36:40Z")).toBe(25);
  });
});

describe("formatHourRange", () => {
  it("shows the hour that ends at the period, in the given time zone", () => {
    expect(formatHourRange("2026-10-08T03", "UTC")).toBe("Oct 8, 2:00 – 3:00 AM UTC");
    expect(formatHourRange("2026-10-08T03", "America/Los_Angeles")).toBe("Oct 7, 7:00 – 8:00 PM PDT");
  });

  it("uses only plain spaces, so server and browser text match", () => {
    expect(formatHourRange("2026-10-08T03", "UTC")).not.toMatch(/[^\S ]/);
  });
});

describe("formatTimestamp", () => {
  it("includes the date and zone", () => {
    expect(formatTimestamp("2026-10-08T22:52:00Z", "America/Los_Angeles")).toBe("Oct 8, 2026, 3:52 PM PDT");
  });
});

describe("hourTick", () => {
  it("labels every sixth hour by when it starts, with the date at midnight", () => {
    // The hour ending 08:00 UTC covers midnight–1 AM in Los Angeles.
    expect(hourTick("2026-10-08T08", "America/Los_Angeles")).toBe("Oct 8");
    expect(hourTick("2026-10-08T14", "America/Los_Angeles")).toBe("6 AM");
    expect(hourTick("2026-10-08T20", "America/Los_Angeles")).toBe("12 PM");
    expect(hourTick("2026-10-08T09", "America/Los_Angeles")).toBeNull();
  });
});
