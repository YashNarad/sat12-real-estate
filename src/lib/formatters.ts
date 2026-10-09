export function formatINR(value: number, intent: "Buy" | "Rent" = "Buy"): string {
  if (intent === "Rent") {
    return `₹${new Intl.NumberFormat("en-IN").format(value)}/mo`;
  }
  if (value >= 10_000_000) {
    return `₹${Number((value / 10_000_000).toFixed(2))} Cr`;
  }
  if (value >= 100_000) {
    return `₹${Number((value / 100_000).toFixed(1))} Lakh`;
  }
  return `₹${new Intl.NumberFormat("en-IN").format(value)}`;
}

export function formatArea(value: number): string {
  return `${new Intl.NumberFormat("en-IN").format(value)} sqft`;
}
