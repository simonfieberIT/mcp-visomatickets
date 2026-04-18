import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerChecklistTools(server: McpServer) {
  server.tool("search_checklist_templates", "Checklisten-Vorlagen suchen.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/checklisttemplate/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_checklist_template", "Checklisten-Vorlage anlegen.",
    { fields: z.record(z.string(), z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/checklisttemplate/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_checklist_template", "Checklisten-Vorlage aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/checklisttemplate/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
