import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerWebhookTools(server: McpServer) {
  server.tool("search_webhooks", "Webhooks auflisten.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/webhooks/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_webhook", "Webhook anlegen.",
    {
      model: z.enum(["Ticket", "RmmFailedcheck"]).describe("Modell, das beobachtet wird"),
      action: z.enum(["INSERT", "UPDATE", "DELETE"]),
      attribute: z.string().describe("Zu beobachtendes Feld"),
      url: z.string().describe("Ziel-URL"),
      modelid: z.number().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/webhooks/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_webhook", "Webhook aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/webhooks/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("get_webhook_attributes", "Verfügbare Webhook-Attribute abrufen.", {},
    async () => {
      const data = await apiGet("/api2/do/function/WebhooksAttributeList");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
