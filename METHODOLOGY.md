# Methodology: `emissions.csv`

## What the numbers mean

- **Units:** grams of CO₂-equivalent per kilowatt-hour of electricity generated (gCO₂eq/kWh).
  "CO₂-equivalent" includes other greenhouse gases (mainly methane) weighted by their 100-year
  warming effect. For the fossil rows, nearly all of the *Direct* value is plain CO₂.
- **Direct:** emissions released at the power plant while it runs, almost entirely from burning
  fuel. A plant that burns nothing (wind, solar, nuclear, hydro, geothermal) gets 0.
- **Lifecycle:** cradle-to-grave emissions per kWh. This adds everything upstream and downstream
  of the plant: fuel extraction and transport, methane leaks, building and decommissioning the
  plant, manufacturing panels and turbines, mining uranium, and so on.
- Every value is a **median** across the published studies, not a best or worst case.
- The last row, **Battery Storage (adder only)**, is not a generation source. It is listed last
  for that reason, and it is explained below.

## Primary source

Most rows come straight from **IPCC AR5 Working Group III (2014), Annex III, Table A.III.2,
"Emissions of selected electricity supply technologies (gCO₂eq/kWh)"** (Schlömer et al.). I
picked this table because:

1. It reports **direct and lifecycle emissions separately**, which matches the two columns needed.
2. It is a meta-analysis of hundreds of life-cycle assessment (LCA) studies, harmonized by the
   IPCC, and it is the most widely cited reference for these comparisons.

I took the values from the IPCC PDF itself (page 1335 of the printed report), not from secondary
summaries.

| CSV row            | IPCC row                 | Direct (median) | Lifecycle (median) |
|--------------------|--------------------------|-----------------|--------------------|
| Coal               | Coal — PC                | 760             | 820                |
| Natural Gas        | Gas — Combined Cycle     | 370             | 490                |
| Biomass            | Biomass — dedicated      | n.a. (see below)| 230                |
| Solar PV (Utility) | Solar PV — utility       | 0               | 48                 |
| Solar PV (Rooftop) | Solar PV — rooftop       | 0               | 41                 |
| Geothermal         | Geothermal               | 0               | 38                 |
| Concentrated Solar | Concentrated Solar Power | 0               | 27                 |
| Hydropower         | Hydropower               | 0               | 24                 |
| Nuclear            | Nuclear                  | 0               | 12                 |
| Wind (Offshore)    | Wind offshore            | 0               | 12                 |
| Wind (Onshore)     | Wind onshore             | 0               | 11                 |

## Gaps and the assumptions used to fill them

### Oil (estimated; not in the IPCC table)

Oil is a small share of global electricity, and the IPCC table leaves it out. I estimated it:

- **Direct ≈ 800.** The IPCC 2006 Guidelines default emission factor for residual fuel oil is
  77.4 gCO₂/MJ of fuel. Oil-fired steam plants typically convert about 35% of that energy into
  electricity, so 77.4 × 3.6 MJ/kWh ÷ 0.35 ≈ 796, rounded to 800.
- **Lifecycle ≈ 900.** This adds about 12% for crude extraction, refining and transport. That
  falls between the upstream share IPCC shows for coal (~8%) and for gas (~32%, which is
  inflated by methane leaks), and it is typical of well-to-tank estimates for heavy fuel oil.

Treat both numbers as roughly ±15%. Oil coming out above coal is plausible: the IPCC coal figure
assumes a modern, efficient pulverized-coal plant, while oil-fired plants tend to be older and
less efficient.

### Biomass direct emissions (set to 0 by convention)

The IPCC marks biomass direct emissions "n.a." Burning biomass releases plenty of CO₂ at the
stack: roughly 1,100–1,600 g/kWh for a typical dedicated plant, based on wood's ~112 gCO₂/MJ at
25–35% efficiency. That carbon is *biogenic*, though, meaning the plants absorbed it while they
grew. Standard accounting practice, used by IPCC national inventories and by the IPCC lifecycle
figure in this file, counts biogenic CO₂ as net zero at the stack.

I used **0** so the Direct column follows the same accounting as the Lifecycle column, and so
Direct never ends up larger than Lifecycle. If your demo is about *physical* smokestack
emissions, use about 1,300 instead.

### Battery storage (estimated; an adder, not a source)

A grid battery doesn't generate electricity. It stores electricity that something else
generated. So the row covers only the battery's *own* emissions, mostly from manufacturing
the cells, spread over every kWh it delivers in its lifetime. **It does not include the
electricity used to charge it.**

- **Direct = 0.** A battery burns nothing while it runs.
- **Lifecycle ≈ 25.** Making a lithium-ion battery emits roughly 60–120 kg CO₂eq per kWh of
  capacity. A utility battery that cycles about once a day for 15 years delivers roughly
  3,000–6,000 kWh per kWh of capacity, after allowing for degradation. That works out to about
  10–40 g/kWh. Inverters, enclosures and cooling add a bit more, so I used 25 as a middle
  value. One full lifecycle study of an LFP home battery found 31 g/kWh before counting
  charging. Published estimates range from about 9 to 135 g/kWh, and cycle life is the
  biggest swing factor. Treat 25 as roughly ±50%.

To get the emissions of a kWh that passed through a battery, add the charging source's
emissions, adjusted for the roughly 85% of stored energy you get back out:

    total ≈ (charging source Lifecycle ÷ 0.85) + 25

For example, a kWh from utility solar that went through a battery comes to about
48 ÷ 0.85 + 25 ≈ 80 g/kWh. Gas run through a battery comes to about 490 ÷ 0.85 + 25 ≈ 600.
**Don't plot this row as if it were a generation source.** On its own it looks cleaner than
solar, but it is only ever an extra cost on top of whatever charged the battery.

### Other notes

- **Hydropower varies hugely.** The median is 24, but the IPCC range runs up to 2,200 g/kWh.
  Some tropical reservoirs release large amounts of methane from rotting vegetation. The median
  describes a typical dam, not every dam.
- **Nuclear, wind and solar** have small lifecycle ranges in absolute terms. Solar PV values in
  particular have probably *dropped* since 2014, as panels got more efficient and manufacturing
  grids got cleaner. The 2014 numbers are conservative.
- **Natural gas** is combined-cycle, the most common kind of gas plant. Open-cycle "peaker"
  turbines are less efficient and emit roughly 1.5× as much per kWh.

## What was left out

- **Plants with carbon capture and storage (CCS), and ocean/tidal power.** The IPCC lists these
  as pre-commercial, so they don't count as "common" generation modes.
- **Biomass co-firing** (burning biomass mixed into a coal plant). It is mostly coal and would
  muddy the comparison.

## Precision

This is meant to be close enough for a demo, not exhaustive. IPCC values are reported to two
significant figures, and real plants vary widely around these medians depending on technology,
location and fuel source. Use the numbers to compare modalities, not to calculate the
emissions of a specific plant.

## Sources

- IPCC, 2014: Annex III: Technology-specific cost and performance parameters. In *Climate Change
  2014: Mitigation of Climate Change*, Working Group III contribution to AR5. Table A.III.2.
  <https://www.ipcc.ch/site/assets/uploads/2018/02/ipcc_wg3_ar5_annex-iii.pdf>
- IPCC, 2006: *2006 IPCC Guidelines for National Greenhouse Gas Inventories*, Vol. 2, Ch. 2
  (Stationary Combustion), default CO₂ emission factors for residual fuel oil and wood.
  <https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf>
- Rapier, R., 2020: "Estimating the Carbon Footprint of Utility-Scale Battery Storage," *Forbes*
  (cradle-to-gate manufacturing range for lithium-ion batteries).
  <https://www.forbes.com/sites/rrapier/2020/02/16/estimating-the-carbon-footprint-of-utility-scale-battery-storage/>
- Life cycle assessment (LCA) of a battery home storage system based on primary data, *Journal of
  Cleaner Production* (2022) (LFP lifecycle figure excluding charging).
  <https://www.sciencedirect.com/science/article/pii/S0959652622024921>
- Global warming potential of lithium-ion battery energy storage systems: A review, *Journal of
  Energy Storage* (2022) (range of published estimates).
  <https://www.sciencedirect.com/science/article/pii/S2352152X22010325>
