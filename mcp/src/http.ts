/**
 * HTTP client for operations that must go through the running Easel dev
 * server (AI edits, design-system packs, guides). Scene R/W talks to the
 * filesystem directly via SceneStore.
 */

export class HttpClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async ping(): Promise<
    | { ok: true; ready: boolean; model?: string; tokenSource: string | null }
    | { ok: false; error: string }
  > {
    try {
      const r = await fetch(`${this.baseUrl}/api/ai-edit`);
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const data = (await r.json()) as {
        ready: boolean;
        model?: string;
        tokenSource?: string | null;
      };
      return {
        ok: true,
        ready: data.ready,
        model: data.model,
        tokenSource: data.tokenSource ?? null,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async getGuide(dsId: string): Promise<string | null> {
    const r = await fetch(
      `${this.baseUrl}/api/guides?dsId=${encodeURIComponent(dsId)}`
    );
    if (!r.ok) return null;
    const data = (await r.json()) as { content?: string };
    return typeof data.content === "string" ? data.content : null;
  }

  async setGuide(dsId: string, content: string): Promise<void> {
    const r = await fetch(`${this.baseUrl}/api/guides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dsId, content }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`setGuide failed: HTTP ${r.status}: ${text.slice(0, 200)}`);
    }
  }

  async listImportedPacks(): Promise<string[]> {
    const r = await fetch(`${this.baseUrl}/api/ds-pack/uninstall`);
    if (!r.ok) return [];
    const data = (await r.json()) as { imported?: string[] };
    return Array.isArray(data.imported) ? data.imported : [];
  }

  async listDesignSystems(): Promise<
    Array<{ id: string; source: "builtin" | "imported"; hasGuide: boolean }>
  > {
    const r = await fetch(`${this.baseUrl}/api/design-systems`);
    if (!r.ok) throw new Error(`listDesignSystems HTTP ${r.status}`);
    const data = (await r.json()) as {
      systems: Array<{ id: string; source: "builtin" | "imported"; hasGuide: boolean }>;
    };
    return data.systems ?? [];
  }

  async getDesignSystemSchema(dsId: string): Promise<{
    dsId: string;
    schema: string;
    hasGuide: boolean;
  }> {
    const r = await fetch(
      `${this.baseUrl}/api/design-systems?dsId=${encodeURIComponent(dsId)}`
    );
    if (!r.ok) throw new Error(`getDesignSystemSchema HTTP ${r.status}`);
    return r.json() as Promise<{ dsId: string; schema: string; hasGuide: boolean }>;
  }

  async listSaves(): Promise<Array<{ name: string; updatedAt: string; size: number }>> {
    const r = await fetch(`${this.baseUrl}/api/saves`);
    if (!r.ok) throw new Error(`listSaves HTTP ${r.status}`);
    const data = (await r.json()) as {
      saves: Array<{ name: string; updatedAt: string; size: number }>;
    };
    return data.saves ?? [];
  }

  /**
   * Call /api/ai-edit and collect the full streamed response. The route
   * streams text deltas terminated by "---JSON---\n{...}". We accumulate
   * everything, split on that marker, and return both halves.
   */
  async aiEdit(opts: {
    mode: "edit" | "create";
    prompt: string;
    node?: unknown;
    dsId?: string;
    designGuide?: string;
    onDelta?: (chunk: string) => void;
  }): Promise<{ explanation: string; json: unknown; raw: string }> {
    const body = {
      mode: opts.mode,
      prompt: opts.prompt,
      node: opts.node,
      dsId: opts.dsId,
      designGuide: opts.designGuide,
    };

    const r = await fetch(`${this.baseUrl}/api/ai-edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok || !r.body) {
      const text = await r.text();
      throw new Error(`ai-edit HTTP ${r.status}: ${text.slice(0, 300)}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let text = "";
    let streamError: string | null = null;

    // Read SSE frames. Each frame is `data: {json}\n\n`.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = sseBuffer.indexOf("\n\n")) >= 0) {
        const frame = sseBuffer.slice(0, idx);
        sseBuffer = sseBuffer.slice(idx + 2);
        if (!frame.startsWith("data: ")) continue;
        const dataLine = frame.slice(6);
        try {
          const evt = JSON.parse(dataLine) as {
            type: string;
            text?: string;
            error?: string;
          };
          if (evt.type === "delta" && typeof evt.text === "string") {
            text += evt.text;
            opts.onDelta?.(evt.text);
          } else if (evt.type === "error") {
            streamError = evt.error ?? evt.text ?? "AI stream error";
          }
        } catch {
          // ignore non-JSON SSE comments
        }
      }
    }

    if (streamError) throw new Error(streamError);

    const marker = "---JSON---";
    const markerIdx = text.indexOf(marker);
    let explanation = text;
    let jsonText = "";
    if (markerIdx >= 0) {
      explanation = text.slice(0, markerIdx).trim();
      jsonText = text.slice(markerIdx + marker.length).trim();
    }

    let json: unknown = null;
    if (jsonText) {
      try {
        json = JSON.parse(jsonText);
      } catch (e) {
        // Sometimes the model fences or adds trailing prose. Try to pull out the first {...} balanced block.
        const trimmed = extractJson(jsonText);
        if (trimmed) {
          try {
            json = JSON.parse(trimmed);
          } catch (e2) {
            throw new Error(
              `Failed to parse AI JSON: ${(e2 as Error).message}. Raw: ${jsonText.slice(0, 200)}`
            );
          }
        } else {
          throw new Error(
            `Failed to parse AI JSON: ${(e as Error).message}. Raw: ${jsonText.slice(0, 200)}`
          );
        }
      }
    }

    return { explanation, json, raw: text };
  }
}

/** Extract the first balanced {...} block from a string. */
function extractJson(input: string): string | null {
  const start = input.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}
