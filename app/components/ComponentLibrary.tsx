"use client";

import React, { useEffect, useRef, useState } from "react";
import { useCanvasDispatch, useViewport } from "../store/context";
import { useDesignSystem } from "../design-systems/context";
import type { ComponentTemplate } from "../design-systems/types";
import { getDesignSystem } from "../design-systems/registry";

type ImportResult = {
  ok?: boolean;
  id?: string;
  name?: string;
  depsChanged?: boolean;
  changedDeps?: Record<string, string>;
  guideWritten?: boolean;
  installError?: string;
  message?: string;
  error?: string;
};

export default function ComponentLibrary() {
  const { panX, panY, zoom } = useViewport();
  const dispatch = useCanvasDispatch();
  const { activeDS, activeDSId, setActiveDSId, allDS } = useDesignSystem();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<
    | { phase: "idle" }
    | { phase: "uploading"; fileName: string }
    | { phase: "installing"; fileName: string }
    | { phase: "done"; result: ImportResult }
    | { phase: "error"; error: string }
  >({ phase: "idle" });
  const [importedIds, setImportedIds] = useState<string[]>([]);

  const loadImported = () => {
    fetch("/api/ds-pack/uninstall")
      .then((r) => r.json())
      .then((d) => setImportedIds(Array.isArray(d.imported) ? d.imported : []))
      .catch(() => setImportedIds([]));
  };

  useEffect(() => {
    loadImported();
  }, []);

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
    dispatch({ type: "LOAD_STATE", nodes: newDS?.defaultNodes ?? [] });
    setActiveDSId(newDSId);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFile = async (file: File) => {
    setImportStatus({ phase: "uploading", fileName: file.name });

    // Briefly show "installing..." after upload starts, since npm install is the slow part.
    const fd = new FormData();
    fd.append("pack", file);

    // Swap to "installing" after a small delay so users get realistic feedback.
    const installingTimer = setTimeout(() => {
      setImportStatus((s) =>
        s.phase === "uploading" ? { phase: "installing", fileName: file.name } : s
      );
    }, 400);

    try {
      const res = await fetch("/api/ds-pack/import", { method: "POST", body: fd });
      clearTimeout(installingTimer);
      const result: ImportResult = await res.json();
      if (!res.ok || result.error) {
        setImportStatus({
          phase: "error",
          error: result.error || `Server error (${res.status})`,
        });
        return;
      }
      setImportStatus({ phase: "done", result });
      loadImported();
      // HMR reload to pick up the new import in init.ts.
      // Happens once user dismisses the dialog.
    } catch (err) {
      clearTimeout(installingTimer);
      setImportStatus({ phase: "error", error: (err as Error).message });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  };

  const handleExport = () => {
    window.location.href = `/api/ds-pack/export?dsId=${encodeURIComponent(activeDSId)}`;
  };

  const handleUninstall = async (dsId: string) => {
    if (!confirm(`Remove imported design system "${dsId}"?\n(npm packages will be kept in package.json.)`)) return;
    try {
      const res = await fetch("/api/ds-pack/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(`Uninstall failed: ${data.error || res.statusText}`);
        return;
      }
      // If user was on the uninstalled DS, fall back to the first one.
      if (activeDSId === dsId && allDS.length > 0) {
        const fallback = allDS.find((d) => d.id !== dsId) || allDS[0];
        handleDSChange(fallback.id);
      }
      loadImported();
      // Page reload so the removed import line takes effect cleanly.
      setTimeout(() => window.location.reload(), 100);
    } catch (err) {
      alert(`Uninstall failed: ${(err as Error).message}`);
    }
  };

  const closeDialog = () => {
    if (importStatus.phase === "done") {
      // Reload so HMR picks up the new init.ts import.
      window.location.reload();
    } else {
      setImportStatus({ phase: "idle" });
    }
  };

  const isImported = importedIds.includes(activeDSId);

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
                {importedIds.includes(ds.id) ? "  · imported" : ""}
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
          <span className="text-[10px] text-gray-400 truncate">
            {activeDS.description}
          </span>
        </div>

        {/* Pack controls */}
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={handleImportClick}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors"
            title="Install a .dspack.zip file shared by a teammate"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v5.5M2.5 4L5 6.5L7.5 4M1.5 8.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import pack
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
            title={`Download ${activeDS.name} as .dspack.zip`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 9V3.5M2.5 6L5 3.5L7.5 6M1.5 1.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export
          </button>
          {isImported && (
            <button
              onClick={() => handleUninstall(activeDSId)}
              className="flex items-center justify-center px-2 py-1.5 rounded-md border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
              title={`Uninstall imported DS "${activeDSId}"`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3h6M3.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3l.5 5.5a1 1 0 001 1h1a1 1 0 001-1L7 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.dspack,application/zip"
          onChange={handleFileInput}
          className="hidden"
        />
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

      {/* Import status dialog */}
      {importStatus.phase !== "idle" && (
        <div
          className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && importStatus.phase !== "uploading" && importStatus.phase !== "installing") {
              closeDialog();
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden">
            {(importStatus.phase === "uploading" || importStatus.phase === "installing") && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm font-semibold text-gray-900">
                    {importStatus.phase === "uploading"
                      ? "Uploading pack…"
                      : "Installing packages…"}
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-8">
                  {importStatus.fileName}
                </div>
                {importStatus.phase === "installing" && (
                  <div className="text-[11px] text-gray-400 ml-8 mt-2">
                    This can take 30–90 seconds if new npm packages are added.
                  </div>
                )}
              </div>
            )}

            {importStatus.phase === "done" && (
              <>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4.2 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      Installed &ldquo;{importStatus.result.name}&rdquo;
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed ml-8">
                    {importStatus.result.message}
                  </div>
                  {importStatus.result.changedDeps && Object.keys(importStatus.result.changedDeps).length > 0 && (
                    <div className="mt-3 ml-8 p-2 bg-gray-50 rounded-md">
                      <div className="text-[10px] font-semibold text-gray-500 mb-1">Installed packages</div>
                      <div className="text-[11px] font-mono text-gray-700 space-y-0.5">
                        {Object.entries(importStatus.result.changedDeps).map(([k, v]) => (
                          <div key={k}>{k}@{v}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {importStatus.result.installError && (
                    <div className="mt-3 ml-8 p-2 bg-red-50 rounded-md text-[11px] text-red-600">
                      {importStatus.result.installError}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={closeDialog}
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Reload &amp; use
                  </button>
                </div>
              </>
            )}

            {importStatus.phase === "error" && (
              <>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                      !
                    </div>
                    <div className="text-sm font-semibold text-gray-900">Import failed</div>
                  </div>
                  <div className="text-xs text-red-600 leading-relaxed ml-8 whitespace-pre-wrap break-words">
                    {importStatus.error}
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={closeDialog}
                    className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
