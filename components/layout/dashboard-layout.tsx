"use client";

import { ReactNode, useEffect, useState } from "react";
import { Navbar } from "./navbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }

    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
    }

    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground transition-colors">
      <Navbar />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}