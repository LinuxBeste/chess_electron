import { createContext, useContext, useCallback } from 'react';

interface TabCtx {
  navigateToTab: (tab: string, params?: Record<string, string>) => void;
}

const Ctx = createContext<TabCtx>({ navigateToTab: () => {} });

export const useNavigateTab = () => useContext(Ctx);

export function TabProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate: (tab: string, params?: Record<string, string>) => void;
}) {
  const navigateToTab = useCallback(
    (tab: string, params?: Record<string, string>) => onNavigate(tab, params),
    [onNavigate],
  );
  return <Ctx.Provider value={{ navigateToTab }}>{children}</Ctx.Provider>;
}
