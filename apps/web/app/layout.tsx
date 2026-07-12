import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { NavBar } from "@/features/layout/NavBar";
import { Footer } from "@/features/layout/Footer";
import { PageProgressBar } from "@/features/layout/PageProgressBar";
import { ToastProvider } from "@/components/ui/Toast";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cubelelo Events",
  description: "Speedcubing competition platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col pt-14">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AnimatedBackground />
              <Suspense fallback={null}>
                <PageProgressBar />
              </Suspense>
              <NavBar />
              <div className="relative z-[1] flex flex-1 flex-col">
                {children}
              </div>
              <Footer />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
