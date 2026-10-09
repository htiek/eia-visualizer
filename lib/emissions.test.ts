import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEmissionsCsv } from "./emissions";

const csv = readFileSync(path.join(__dirname, "..", "emissions.csv"), "utf8");

describe("parseEmissionsCsv", () => {
  it("reads the project's emissions.csv", () => {
    const factors = parseEmissionsCsv(csv);
    expect(factors.sources.gas).toEqual({ direct: 370, lifecycle: 490 });
    expect(factors.sources.solar).toEqual({ direct: 0, lifecycle: 48 });
    expect(factors.sources.wind).toEqual({ direct: 0, lifecycle: 11 });
    expect(factors.batteryAdder).toEqual({ direct: 0, lifecycle: 25 });
  });

  it("handles Windows line endings and stray spaces", () => {
    const factors = parseEmissionsCsv(csv.replaceAll("\n", " \r\n"));
    expect(factors.sources.coal).toEqual({ direct: 760, lifecycle: 820 });
  });

  it("names a missing row", () => {
    const withoutNuclear = csv.replace(/^Nuclear,.*$/m, "");
    expect(() => parseEmissionsCsv(withoutNuclear)).toThrow('no "Nuclear" row');
  });

  it("rejects a bad header or a non-numeric value", () => {
    expect(() => parseEmissionsCsv(csv.replace("Modality,Direct,Lifecycle", "Source,gCO2"))).toThrow(/header/);
    expect(() => parseEmissionsCsv(csv.replace("Coal,760,820", "Coal,760,"))).toThrow(/Coal,760,/);
  });
});
