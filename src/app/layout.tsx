import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanza Personale",
  description: "Portfolio tracker & financial management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
