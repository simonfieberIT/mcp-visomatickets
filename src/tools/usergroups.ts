import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerUserGroupTools(server: McpServer) {
  server.tool(
    "search_usergroups",
    "Benutzergruppen suchen und auflisten.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/usergroups/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_usergroup",
    "Neue Benutzergruppe anlegen.",
    {
      title: z.string().describe("Name der Benutzergruppe (Pflicht)"),
      active: z.number().optional().describe("Aktiv: 1 = Ja, 0 = Nein"),
    },
    async (fields) => {
      const data = await apiPost("/api2/usergroups/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_usergroup",
    "Benutzergruppe aktualisieren.",
    {
      id: z.number().describe("Benutzergruppen-ID"),
      fields: z.record(z.string(), z.unknown()).describe("Zu ändernde Felder als Objekt"),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/usergroups/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
