"use client";

import { ReactNode } from "react";
import { Navbar } from "./navbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F5F6F8]">
      <Navbar />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
