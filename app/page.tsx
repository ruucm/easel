"use client";

// Register all design system adapters before anything else
import "./design-systems/init";

import { CanvasProvider } from "./store/context";
import { DesignSystemProvider } from "./design-systems/context";
import LeftSidebar from "./components/LeftSidebar";
import CanvasRenderer from "./components/CanvasRenderer";
import PropertiesPanel from "./components/PropertiesPanel";
import dynamic from "next/dynamic";
const BottomBar = dynamic(() => import("./components/BottomBar"), { ssr: false });

export default function Home() {
  return (
    <DesignSystemProvider>
      <CanvasProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-white">
          {/* Left: Layers + Assets */}
          <LeftSidebar />

          {/* Center: Canvas + Bottom Bar */}
          <div className="flex-1 relative">
            <CanvasRenderer />
            <BottomBar />
          </div>

          {/* Right: Properties */}
          <div className="w-60 flex flex-col border-l border-gray-200">
            <PropertiesPanel />
          </div>
        </div>
      </CanvasProvider>
    </DesignSystemProvider>
  );
}
