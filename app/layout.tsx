import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The last hour on the U.S. grid",
  description: "Where the Lower 48's electricity came from in the latest hour EIA has published, and about how much CO₂ each kWh carried.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
