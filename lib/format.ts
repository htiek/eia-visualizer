const oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// EIA reports megawatt-hours; at national scale gigawatt-hours read better.
export function formatGwh(mwh: number): string {
  return `${oneDecimal.format(mwh / 1000)} GWh`;
}

export function formatShare(share: number): string {
  if (share > 0 && share < 0.0005) return "<0.1%";
  return `${oneDecimal.format(share * 100)}%`;
}

// Grams per kWh. The emission factors are only good to two significant
// figures, so decimals would be false precision.
export function formatGrams(grams: number): string {
  return whole.format(grams);
}
