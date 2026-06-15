"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderContextType {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;
  backHref: string | null;
  setBackHref: (href: string | null) => void;
  headerActions: ReactNode;
  setHeaderActions: (node: ReactNode) => void;
  resetHeader: () => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([]);
  const [backHref, setBackHrefState] = useState<string | null>(null);
  const [headerActions, setHeaderActionsState] = useState<ReactNode>(null);

  const setBreadcrumbs = useCallback((items: BreadcrumbItem[]) => {
    setBreadcrumbsState(items);
  }, []);

  const setBackHref = useCallback((href: string | null) => {
    setBackHrefState(href);
  }, []);

  const setHeaderActions = useCallback((node: ReactNode) => {
    setHeaderActionsState(node);
  }, []);

  const resetHeader = useCallback(() => {
    setBreadcrumbsState([]);
    setBackHrefState(null);
    setHeaderActionsState(null);
  }, []);

  return (
    <HeaderContext.Provider value={{ breadcrumbs, setBreadcrumbs, backHref, setBackHref, headerActions, setHeaderActions, resetHeader }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
