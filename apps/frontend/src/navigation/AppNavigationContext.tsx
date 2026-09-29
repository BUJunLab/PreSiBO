import { createContext, useContext } from "react";

export type PageKey = "about" | "target" | "network" | "geneProfiles" | "drug";

export interface AppNavigationIntent {
  id: number;
  page: PageKey;
  tab?: string;
  gene?: string;
  query?: string;
}

interface AppNavigationContextValue {
  activePage: PageKey;
  activeTabLabel: string;
  initialGene?: string | null;
  sharedGene?: string | null;
  setSharedGene?: (gene: string | null) => void;
  navigate: (page: PageKey) => void;
  setActiveTabLabel: (label: string) => void;
  navigationIntent: AppNavigationIntent | null;
  requestNavigation: (intent: Omit<AppNavigationIntent, "id">) => void;
}

const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);

export const AppNavigationProvider = AppNavigationContext.Provider;

export function useAppNavigation() {
  const value = useContext(AppNavigationContext);
  if (!value) {
    throw new Error("useAppNavigation must be used within AppNavigationProvider.");
  }

  return value;
}
