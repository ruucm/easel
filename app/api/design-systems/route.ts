import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dsSchemas } from "../ai-edit/schemas";

const IMPORTED_SCHEMAS_DIR = path.join(
  process.cwd(),
  "app/api/ai-edit/imported-schemas"
);
const GUIDES_DIR = path.join(process.cwd(), "guides");

function listImportedIds(): string[] {
  try {
    return fs
      .readdirSync(IMPORTED_SCHEMAS_DIR)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.replace(/\.txt$/, ""));
  } catch {
    return [];
  }
}

function readSchema(dsId: string): string | null {
  if (dsSchemas[dsId]) return dsSchemas[dsId];
  try {
    const p = path.join(IMPORTED_SCHEMAS_DIR, `${dsId}.txt`);
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function hasGuide(dsId: string): boolean {
  try {
    fs.statSync(path.join(GUIDES_DIR, `${dsId}.md`));
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/design-systems            — list all DS ids with metadata
 * GET /api/design-systems?dsId=foo   — return { dsId, schema, hasGuide }
 */
export async function GET(req: NextRequest) {
  const dsId = req.nextUrl.searchParams.get("dsId");

  if (dsId) {
    const schema = readSchema(dsId);
    if (!schema) {
      return NextResponse.json({ error: "Unknown dsId" }, { status: 404 });
    }
    return NextResponse.json({ dsId, schema, hasGuide: hasGuide(dsId) });
  }

  const builtin = Object.keys(dsSchemas);
  const imported = listImportedIds().filter((id) => !builtin.includes(id));
  const systems = [...builtin, ...imported].map((id) => ({
    id,
    source: builtin.includes(id) ? ("builtin" as const) : ("imported" as const),
    hasGuide: hasGuide(id),
  }));

  return NextResponse.json({ systems });
}
