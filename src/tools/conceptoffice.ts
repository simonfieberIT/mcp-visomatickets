import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../client.js";

export function registerConceptOfficeTools(server: McpServer) {
  server.tool("search_conceptoffice_times", "Zeiten für Concept-Office-Export abrufen. onlyUnexported=true für noch nicht exportierte Zeiten.",
    { onlyUnexported: z.boolean().optional().describe("Nur noch nicht exportierte Zeiten abrufen (Standard: false)") },
    async ({ onlyUnexported }) => {
      const path = onlyUnexported
        ? "/api2/conceptoffice/search/params[exported]/0/"
        : "/api2/conceptoffice/search/";
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("mark_times_as_exported", "Zeiten als nach Concept-Office exportiert markieren.",
    { ids: z.array(z.number()).describe("Array der Timer-IDs") },
    async ({ ids }) => {
      const data = await apiPost("/api2/do/function/markasexported", { ids });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
