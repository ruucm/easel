"use client";

import React from "react";
import { useCanvasDispatch, useViewport } from "../store/context";
import { useDesignSystem } from "../design-systems/context";
import type { ComponentTemplate } from "../design-systems/types";
import { getDesignSystem } from "../design-systems/registry";

export default function ComponentLibrary() {
  const { panX, panY, zoom } = useViewport();
  const dispatch = useCanvasDispatch();
  const { activeDS, activeDSId, setActiveDSId, allDS } = useDesignSystem();

  const addComponent = (template: ComponentTemplate) => {
    const vw = window.innerWidth - 480;
    const vh = window.innerHeight;
    const cx = (-panX + vw / 2) / zoom;
    const cy = (-panY + vh / 2) / zoom;
    dispatch({ type: "ADD_NODE", node: template.create(cx, cy) });
  };

  const handleDSChange = (newDSId: string) => {
    if (newDSId === activeDSId) return;
    const newDS = getDesignSystem(newDSId);
    // Clear canvas and load the new DS's default nodes (or empty)
    dispatch({ type: "LOAD_STATE", nodes: newDS?.defaultNodes ?? [] });
    setActiveDSId(newDSId);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Design system selector */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <select
            value={activeDSId}
            onChange={(e) => handleDSChange(e.target.value)}
            className="w-full appearance-none text-[11px] font-semibold bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 pr-7 text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {allDS.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 4L5 6.5L7.5 4" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: activeDS.accentColor }}
          />
          <span className="text-[10px] text-gray-400">
            {activeDS.description}
          </span>
        </div>
      </div>

      {/* Component grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 auto-rows-min">
        {activeDS.catalog.map((t, i) => (
          <button
            key={`${activeDSId}-${t.type}-${t.label}-${i}`}
            onClick={() => addComponent(t)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer group"
          >
            <span className="text-gray-400 group-hover:text-blue-500 transition-colors">
              {t.icon}
            </span>
            <span className="text-[11px] font-medium text-gray-600 group-hover:text-blue-600">
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
