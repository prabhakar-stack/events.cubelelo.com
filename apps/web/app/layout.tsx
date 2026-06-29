import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { NavBar } from "@/features/layout/NavBar";
import { Footer } from "@/features/layout/Footer";

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
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <AuthProvider>
            <NavBar />
            {children}
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
