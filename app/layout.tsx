import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/bottom-nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Tech English",
  description: "Repite frases de inglés técnico con repetición espaciada",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="mx-auto flex h-full max-w-md flex-col">
          <header className="flex items-center justify-center border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur dark:border-gray-900 dark:bg-gray-950/80">
            <h1 className="text-lg font-bold tracking-tight">Tech English</h1>
          </header>
          <main className="flex-1 overflow-y-auto px-4 py-5">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
