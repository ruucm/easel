import type { DesignSystemAdapter } from "./types";

const adapters = new Map<string, DesignSystemAdapter>();

export function registerDesignSystem(adapter: DesignSystemAdapter) {
  adapters.set(adapter.id, adapter);
}

export function getDesignSystem(id: string): DesignSystemAdapter | undefined {
  return adapters.get(id);
}

export function getAllDesignSystems(): DesignSystemAdapter[] {
  return Array.from(adapters.values());
}

export function getDefaultDesignSystemId(): string {
  const first = adapters.keys().next().value;
  return first ?? "html";
}
