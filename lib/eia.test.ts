import { describe, expect, it } from "vitest";
import { buildUrl, DEMO_KEY, fetchHours, parseRows, ROW_LIMIT } from "./eia";

const row = (period: string, fueltype: string, value: string | null) => ({
  period,
  fueltype,
  value,
  "value-units": "megawatthours",
});

function respondWith(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

describe("buildUrl", () => {
  it("asks for the newest hourly Lower 48 rows, with brackets written literally", () => {
    const url = buildUrl("abc");
    expect(url).toContain("https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/?");
    expect(url).toContain("api_key=abc");
    expect(url).toContain("frequency=hourly");
    expect(url).toContain("facets[respondent][]=US48");
    expect(url).toContain("sort[0][column]=period&sort[0][direction]=desc");
    expect(url).toContain(`length=${ROW_LIMIT}`);
  });
});

describe("parseRows", () => {
  it("groups rows into hours, oldest first", () => {
    const hours = parseRows([row("2026-10-08T03", "NG", "200"), row("2026-10-08T02", "NG", "100"), row("2026-10-08T03", "BAT", "-5")]);
    expect(hours).toEqual([
      { period: "2026-10-08T02", mwhByFuel: { NG: 100 } },
      { period: "2026-10-08T03", mwhByFuel: { NG: 200, BAT: -5 } },
    ]);
  });

  it("leaves out sources EIA has no value for", () => {
    expect(parseRows([row("2026-10-08T03", "NG", "200"), row("2026-10-08T03", "SUN", null)])).toEqual([
      { period: "2026-10-08T03", mwhByFuel: { NG: 200 } },
    ]);
  });

  it("rejects rows in other units or with non-numeric values", () => {
    expect(parseRows([{ ...row("2026-10-08T03", "NG", "200"), "value-units": "megawatts" }])).toBeNull();
    expect(parseRows([row("2026-10-08T03", "NG", "lots")])).toBeNull();
  });
});

describe("fetchHours", () => {
  it("returns the parsed hours", async () => {
    const result = await fetchHours("abc", respondWith({ response: { data: [row("2026-10-08T03", "NG", "200")] } }));
    expect(result).toEqual({ ok: true, hours: [{ period: "2026-10-08T03", mwhByFuel: { NG: 200 } }] });
  });

  it("drops the oldest hour when the response was cut off at the row limit", async () => {
    const data = Array.from({ length: ROW_LIMIT }, (_, i) => row(i < ROW_LIMIT - 1 ? "2026-10-08T03" : "2026-10-08T02", `F${i}`, "1"));
    const result = await fetchHours("abc", respondWith({ response: { data } }));
    expect(result.ok && result.hours.map((h) => h.period)).toEqual(["2026-10-08T03"]);
  });

  it("explains rate limiting, pointing DEMO_KEY users at their own key", async () => {
    const demo = await fetchHours(DEMO_KEY, respondWith({}, 429));
    expect(demo.ok === false && demo.error).toMatch(/DEMO_KEY/);
    const own = await fetchHours("abc", respondWith({}, 429));
    expect(own.ok === false && own.error).not.toMatch(/DEMO_KEY/);
  });

  it("reports a rejected key, a network failure and an unexpected body", async () => {
    expect(await fetchHours("abc", respondWith({}, 403))).toMatchObject({ ok: false, error: expect.stringMatching(/rejected/) });
    const offline: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await fetchHours("abc", offline)).toMatchObject({ ok: false, error: expect.stringMatching(/Couldn't reach/) });
    expect(await fetchHours("abc", respondWith({ error: "nope" }))).toMatchObject({ ok: false, error: expect.stringMatching(/format/) });
  });
});
