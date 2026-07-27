import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

// Applique le thème (clair/sombre/automatique) mis en cache avant l'hydratation,
// pour éviter un flash de thème incorrect au chargement. La valeur réelle,
// configurée dans Configuration > Affichage, est ensuite synchronisée par
// useThemeSync (voir app/dashboard/layout.tsx).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "auto";
    var isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Gestion de Stocks",
  description: "Plateforme de gestion des cartes bancaires",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
