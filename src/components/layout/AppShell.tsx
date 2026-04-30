"use client";

import React from "react";
import Header from "./Header";
import PageContainer from "./PageContainer";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Common layout wrapper for all pages.
 * Handles conditional Header rendering and consistent X-axis alignment.
 */
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname?.endsWith("/login");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {!isLoginPage && <Header />}
      <main className={clsx("flex-1 flex flex-col", !isLoginPage && "pt-[64px]")}>
        <PageContainer className="flex-1 flex flex-col">
          {children}
        </PageContainer>
      </main>
    </div>
  );
}
