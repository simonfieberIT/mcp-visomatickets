import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerTypeTools(server: McpServer) {
  server.tool("search_ticket_types", "Tickettypen auflisten.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/tickettype/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_ticket_type", "Tickettyp anlegen.",
    { fields: z.record(z.string(), z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/tickettype/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_ticket_type", "Tickettyp aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/tickettype/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("search_timer_types", "Timertypen auflisten.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/TimerType/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
