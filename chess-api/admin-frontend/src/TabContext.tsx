import { createContext, useContext, useCallback } from 'react';

interface TabCtx {
  navigateToTab: (tab: string, params?: Record<string, string>) => void;
}

// default no-op prevents crash if useNavigateTab is called outside TabProvider
const Ctx = createContext<TabCtx>({ navigateToTab: () => {} });

export const useNavigateTab = () => useContext(Ctx).navigateToTab;

export function TabProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate: (tab: string, params?: Record<string, string>) => void;
}) {
  // stabilize reference so consuming components don't re-render on every render
  const navigateToTab = useCallback(
    (tab: string, params?: Record<string, string>) => onNavigate(tab, params),
    [onNavigate],
  );
  return <Ctx.Provider value={{ navigateToTab }}>{children}</Ctx.Provider>;
}
