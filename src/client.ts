const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");
const TOKEN = process.env.VISOMA_TOKEN;

if (!BASE_URL || !TOKEN) {
  throw new Error("VISOMA_BASE_URL and VISOMA_TOKEN environment variables are required");
}

export function buildFilterPath(filters: Record<string, string | number>): string {
  return Object.entries(filters)
    .map(([key, value]) => `params[${key}]/${value}`)
    .join("/") + "/";
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", TOKEN!);

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} for ${method} ${path}`);
  }

  const data = await res.json() as { Success?: boolean; Message?: string };

  if (data.Success === false) {
    throw new Error(`Visoma API error: ${data.Message ?? "Unknown error"}`);
  }

  return data;
}

export async function apiGet(path: string): Promise<unknown> {
  return request("GET", path);
}

export async function apiPost(path: string, body: unknown): Promise<unknown> {
  return request("POST", path, body);
}

export async function apiPut(path: string, body: unknown): Promise<unknown> {
  return request("PUT", path, body);
}

export function getBasicAuthHeaders(): Record<string, string> {
  const username = process.env.VISOMA_USERNAME;
  const password = process.env.VISOMA_PASSWORD;
  if (!username || !password) {
    throw new Error("VISOMA_USERNAME and VISOMA_PASSWORD are required for fulltext search");
  }
  return {
    "X_VSM_USERNAME": username,
    "X_VSM_PASSWORD": password,
  };
}
