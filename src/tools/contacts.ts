import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerContactTools(server: McpServer) {
  server.tool(
    "search_contacts",
    "Kontakte suchen.",
    {
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    },
    async ({ filters }) => {
      const data = await apiGet(`/api2/contact/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_contact",
    "Neuen Kontakt anlegen.",
    { fields: z.record(z.string(), z.unknown()).describe("Kontaktfelder als Objekt") },
    async ({ fields }) => {
      const data = await apiPost("/api2/contact/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_contact",
    "Kontakt aktualisieren.",
    {
      id: z.number().describe("Kontakt-ID"),
      fields: z.record(z.string(), z.unknown()),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/contact/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
