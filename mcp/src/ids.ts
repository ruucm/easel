const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomId(prefix = "mcp"): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${s}-${Date.now().toString(36)}`;
}

export function collectIds(nodes: Array<{ id: string; children: unknown[] }>): Set<string> {
  const seen = new Set<string>();
  const walk = (arr: unknown[]) => {
    for (const n of arr) {
      const node = n as { id?: string; children?: unknown[] };
      if (typeof node.id === "string") seen.add(node.id);
      if (Array.isArray(node.children)) walk(node.children);
    }
  };
  walk(nodes);
  return seen;
}

export function uniqueId(prefix: string, taken: Set<string>): string {
  let id = randomId(prefix);
  while (taken.has(id)) id = randomId(prefix);
  taken.add(id);
  return id;
}
