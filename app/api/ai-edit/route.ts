import { NextRequest } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";

// ─── Design System Schema Registry (server-side) ────────────────────
// We can't import the client-side adapters in a server route, so we
// store schemas as plain strings keyed by adapter ID.

import { dsSchemas } from "./schemas";

const IMPORTED_SCHEMAS_DIR = path.join(process.cwd(), "app/api/ai-edit/imported-schemas");

/**
 * Look up a schema by dsId. Checks the built-in registry first, then falls
 * back to imported schemas written by /api/ds-pack/import. Synchronous reads
 * are fine — schema files are tiny.
 */
function getSchema(dsId: string): string | null {
  if (dsSchemas[dsId]) return dsSchemas[dsId];
  try {
    const p = path.join(IMPORTED_SCHEMAS_DIR, `${dsId}.txt`);
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

// ─── OAuth Token (env → Keychain → file) ─────────────────────────────

interface TokenInfo {
  token: string;
  source: "env" | "keychain" | "credentials-file";
  preview: string;
}

function readClaudeCodeToken(): TokenInfo | null {
  if (process.env.ANTHROPIC_API_KEY) {
    const token = process.env.ANTHROPIC_API_KEY;
    return { token, source: "env", preview: `${token.slice(0, 12)}...${token.slice(-4)}` };
  }

  if (process.platform === "darwin") {
    try {
      const result = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w',
        { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
      );
      const data = JSON.parse(result.trim());
      if (data?.claudeAiOauth?.accessToken) {
        const token = data.claudeAiOauth.accessToken;
        return { token, source: "keychain", preview: `${token.slice(0, 12)}...${token.slice(-4)}` };
      }
    } catch {}
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (homeDir) {
    try {
      const credPath = path.join(homeDir, ".claude", ".credentials.json");
      const raw = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      if (raw?.claudeAiOauth?.accessToken) {
        const token = raw.claudeAiOauth.accessToken;
        return { token, source: "credentials-file", preview: `${token.slice(0, 12)}...${token.slice(-4)}` };
      }
    } catch {}
  }

  return null;
}

// ─── Model Selection ────────────────────────────────────────────────

const MODEL_ENV_KEYS = ["CLAUDE_MODEL", "CLAUDE_CODE_MODEL", "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_MODEL"];
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

interface ModelInfo {
  model: string;
  source: string;
}

function getModel(): ModelInfo {
  for (const key of MODEL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return { model: value.trim(), source: key };
  }
  return { model: DEFAULT_MODEL, source: "default" };
}

// ─── System Prompts ─────────────────────────────────────────────────

function getEditPrompt(schema: string): string {
  return `You are a design system canvas AI assistant. You modify CanvasNode objects based on user instructions.

${schema}

RESPONSE FORMAT:
1. First, briefly explain what you will change (1-2 sentences in the user's language).
2. Then output a line containing only: ---JSON---
3. Then output ONLY the valid JSON object for the modified node. No markdown fences.

Example:
I'll change the background color to red and make the text bold.
---JSON---
{"id":"btn-1","type":"Button","name":"Red Button","style":{"backgroundColor":"red","fontWeight":700},"children":[],"componentProps":{"size":"m","color":"red","children":"Click"}}

RULES:
- Keep the same id.
- You can modify: name, style, text, componentProps, type, children.
- When adding children, generate unique ids (use short readable ids like "ai-btn-1").
- When the user asks to change a property, modify only what's needed.
- For style changes, merge with existing styles.
- For component type changes, adjust componentProps accordingly.
- NEVER use emojis in text content. For icons, use the appropriate icon component type if available.`;
}

function getCreatePrompt(schema: string): string {
  return `You are a design system canvas AI assistant. You CREATE new UI designs from scratch based on user descriptions.

${schema}

RESPONSE FORMAT:
1. First, briefly explain what you will create (1-2 sentences in the user's language).
2. Then output a line containing only: ---JSON---
3. Then output ONLY the valid JSON object for the new node tree. No markdown fences.

RULES:
- The root node MUST be a Frame with position: "absolute". The left/top will be set by the system, so use left: 0, top: 0.
- Generate unique ids for all nodes (use short readable ids like "ai-frame-1", "ai-btn-1", "ai-title-1").
- Give the root Frame a descriptive "name" based on what the user asked for.
- Use Frame nodes as containers with flexbox layout (display: "flex", flexDirection, gap, padding, etc.).
- Create realistic, well-designed UI — use proper spacing, colors, typography.
- Set explicit width on the root Frame (typically 300-900px depending on the design).
- Use children arrays to nest components inside Frames.
- For text content, use Text nodes with the "text" field.
- Make the design look professional and production-ready.
- NEVER use emojis in text content.
- Use the full range of available components when appropriate for the design.`;
}


// ─── Streaming Anthropic API Call ──────────────────────────────────

function streamAnthropicAPI(
  apiKey: string,
  body: Record<string, unknown>,
  onData: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  const isOAuth = apiKey.includes("sk-ant-oat");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (isOAuth) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["anthropic-beta"] = "claude-code-20250219,oauth-2025-04-20";
    headers["user-agent"] = "claude-cli/2.1.75";
    headers["x-app"] = "cli";
  } else {
    headers["x-api-key"] = apiKey;
  }

  const bodyObj: Record<string, unknown> = { ...body, stream: true };
  if (isOAuth) {
    const originalSystem = (bodyObj.system as string) || "";
    bodyObj.system = [
      {
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        cache_control: { type: "ephemeral" },
      },
      ...(originalSystem
        ? [{
            type: "text",
            text: originalSystem,
            cache_control: { type: "ephemeral" },
          }]
        : []),
    ];
  }

  const postData = Buffer.from(JSON.stringify(bodyObj), "utf-8");
  headers["Content-Length"] = String(postData.length);

  const req = https.request(
    {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers,
    },
    (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errData = "";
        res.on("data", (chunk: Buffer) => (errData += chunk.toString()));
        res.on("end", () => onError(new Error(`API HTTP ${res.statusCode}: ${errData.slice(0, 300)}`)));
        return;
      }

      let buffer = "";
      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta" &&
              event.delta.text
            ) {
              onData(event.delta.text);
            }
          } catch {}
        }
      });

      res.on("end", onDone);
    }
  );
  req.on("error", onError);
  req.write(postData);
  req.end();
}

// ─── GET: Return model + token meta (no API call) ───────────────────

export async function GET() {
  const tokenInfo = readClaudeCodeToken();
  const modelInfo = getModel();

  return Response.json({
    model: modelInfo.model,
    modelSource: modelInfo.source,
    tokenSource: tokenInfo?.source ?? null,
    tokenPreview: tokenInfo?.preview ?? null,
    ready: !!tokenInfo,
  });
}

// ─── POST: SSE Stream ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const tokenInfo = readClaudeCodeToken();
  if (!tokenInfo) {
    return new Response(
      JSON.stringify({ error: "No Anthropic API key found. Set ANTHROPIC_API_KEY or login to Claude Code." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { node, prompt, mode, designGuide, dsId } = await req.json();
  const isCreate = mode === "create" || !node;

  if (!prompt) {
    return new Response(
      JSON.stringify({ error: "Missing prompt" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!isCreate && !node) {
    return new Response(
      JSON.stringify({ error: "Missing node for edit mode" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get the schema for the requested design system
  const schema = getSchema(dsId || "html") || dsSchemas["html"];
  const modelInfo = getModel();

  let systemPrompt = isCreate ? getCreatePrompt(schema) : getEditPrompt(schema);
  if (designGuide) {
    systemPrompt += `\n\n--- DESIGN SYSTEM USAGE GUIDE ---\nFollow these rules strictly when using this design system's components:\n\n${designGuide}`;
  }
  const userMessage = isCreate
    ? `Create a new design: ${prompt}`
    : `Current node:\n${JSON.stringify(node, null, 2)}\n\nUser request: ${prompt}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: "meta",
          model: modelInfo.model,
          modelSource: modelInfo.source,
          tokenSource: tokenInfo.source,
          tokenPreview: tokenInfo.preview,
        })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "context", text: isCreate ? `Creating new design` : `Target: ${node.name} (${node.type})` })}\n\n`)
      );

      streamAnthropicAPI(
        tokenInfo.token,
        {
          model: modelInfo.model,
          max_tokens: 32768,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        },
        (chunk) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`)
          );
        },
        () => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        },
        (err) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`)
          );
          controller.close();
        },
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
