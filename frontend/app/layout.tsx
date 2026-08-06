import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "PrivateVault | Nothing leaves in plaintext",
  description:
    "Institutional-grade confidential DeFi vault on iExec Nox. Deposits and withdrawals are encrypted in a TEE and invisible to MEV searchers until the 3-day cooldown expires.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
      >
        <ThemeProvider>
          <Providers>
            <main className="container">
              <div className="main-content">{children}</div>
              <footer className="footer">
                <span className="footer-brand">PrivateVault</span>
                <ul className="footer-links">
                  <li>
                    <a
                      href="https://github.com/Henoch4/PrivateVault"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Repository
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://iexec.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      iExec Nox
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://docs.nox.party"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Docs
                    </a>
                  </li>
                </ul>
              </footer>
            </main>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
