import type { Metadata } from "next";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivateVault — MEV Protection Vault",
  description:
    "Institutional-grade confidential DeFi vault on iExec Nox. Deposits and withdrawals are encrypted and invisible until the 3-day cooldown expires.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
