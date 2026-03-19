import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from "@/hooks/useUser";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema Integral SAySSPP",
  description:
    "Portal Interno - Secretaría Municipal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col`}
      >
        <UserProvider>
          {/* CONTENIDO PRINCIPAL */}
          <main className="flex-1">{children}</main>

          {/* FOOTER */}
          <Footer />

          {/* TOAST */}
          <Toaster />
        </UserProvider>
      </body>
    </html>
  );
}