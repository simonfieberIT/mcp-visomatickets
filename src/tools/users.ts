import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerUserTools(server: McpServer) {
  server.tool(
    "search_users",
    "Benutzer suchen.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/user/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_user",
    "Neuen Benutzer anlegen.",
    { fields: z.record(z.string(), z.unknown()).describe("Benutzerfelder als Objekt") },
    async ({ fields }) => {
      const data = await apiPost("/api2/user/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_user",
    "Benutzer aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/user/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
