import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerAddressTools(server: McpServer) {
  server.tool(
    "search_addresses",
    "Adressen suchen.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/address/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_address",
    "Neue Adresse anlegen.",
    { fields: z.record(z.string(), z.unknown()).describe("Adressfelder als Objekt") },
    async ({ fields }) => {
      const data = await apiPost("/api2/address/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_address",
    "Adresse aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/address/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
