import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerCustomerTools(server: McpServer) {
  server.tool(
    "search_customers",
    "Kunden suchen und auflisten.",
    {
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "Name": "Mustermann", "QueryLimit": 50 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/Customer/search/${filters ? buildFilterPath(filters) : ""}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Neuen Kunden anlegen.",
    {
      Number: z.string().describe("Kundennummer, z. B. A001 (Pflicht)"),
      Name: z.string().describe("Firmenname (Pflicht)"),
      EMail: z.string().optional(),
      Fon: z.string().optional(),
      Fax: z.string().optional(),
      TicketInfo: z.string().optional(),
      Technician1Id: z.number().optional(),
      Technician2Id: z.number().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/Customer/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Kunden aktualisieren.",
    {
      id: z.number().describe("Kunden-ID"),
      fields: z.record(z.string(), z.unknown()).describe("Zu ändernde Felder"),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/Customer/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_by_email",
    "Kunden anhand einer E-Mail-Adresse suchen.",
    {
      email: z.string().describe("E-Mail-Adresse"),
    },
    async ({ email }) => {
      const data = await apiPost("/api2/do/function/GetCustomerByMail", { email });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
