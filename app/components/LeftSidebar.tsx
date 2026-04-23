"use client";

import { useState } from "react";
import ComponentLibrary from "./ComponentLibrary";
import LayerPanel from "./LayerPanel";
import SaveManager from "./SaveManager";

type Tab = "Layers" | "Assets";

export default function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<Tab>("Layers");

  return (
    <div className="w-60 flex flex-col border-r border-gray-200 bg-white">
      {/* Save/Load */}
      <SaveManager />

      {/* Tab bar */}
      <div className="flex p-1 mx-2 mt-2 mb-1 rounded-lg bg-gray-100/80">
        {(["Layers", "Assets"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all"
            style={{
              color: activeTab === tab ? "#374151" : "#9ca3af",
              backgroundColor: activeTab === tab ? "#ffffff" : "transparent",
              boxShadow: activeTab === tab ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "Layers" ? <LayerPanel /> : <ComponentLibrary />}
      </div>
    </div>
  );
}
