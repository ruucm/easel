"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { DesignSystemAdapter } from "./types";
import { getDesignSystem, getAllDesignSystems, getDefaultDesignSystemId } from "./registry";

interface DesignSystemContextValue {
  activeDS: DesignSystemAdapter;
  activeDSId: string;
  setActiveDSId: (id: string) => void;
  allDS: DesignSystemAdapter[];
}

const DesignSystemContext = createContext<DesignSystemContextValue>(null!);

export function DesignSystemProvider({ children }: { children: ReactNode }) {
  const [activeDSId, setActiveDSId] = useState(getDefaultDesignSystemId);
  const activeDS = getDesignSystem(activeDSId) ?? getDesignSystem(getDefaultDesignSystemId())!;
  const allDS = getAllDesignSystems();

  return (
    <DesignSystemContext.Provider value={{ activeDS, activeDSId, setActiveDSId, allDS }}>
      {children}
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem() {
  return useContext(DesignSystemContext);
}
