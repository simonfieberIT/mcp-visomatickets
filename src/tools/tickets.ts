import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerTicketTools(server: McpServer) {
  server.tool(
    "search_tickets",
    "Tickets in Visoma suchen und auflisten. Unterstützt Filter wie CustomerId, StatusId, ResponsibleId, QueryLimit.",
    {
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "Customer.Number": "A001", "QueryLimit": 50 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/tickets/search/${filters ? buildFilterPath(filters) : ""}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_ticket",
    "Neues Ticket in Visoma erstellen.",
    {
      CustomerId: z.number().describe("Kunden-ID (Pflicht)"),
      AddressId: z.number().describe("Adress-ID (Pflicht)"),
      Title: z.string().describe("Titel des Tickets (Pflicht)"),
      Description: z.string().describe("Beschreibung (Pflicht)"),
      ResponsibleId: z.number().optional().describe("Verantwortlicher Benutzer"),
      PriorityId: z.number().optional().describe("Priorität"),
      StatusId: z.number().optional().describe("Status"),
      TypeId: z.number().optional().describe("Tickettyp"),
      DueOn: z.string().optional().describe("Fälligkeit: DD.MM.YYYY HH:mm:ss"),
      ContactId: z.number().optional().describe("Ansprechpartner-ID"),
      ArrangerIds: z.string().optional().describe("Kommagetrennte Bearbeiter-IDs"),
      ProjectIds: z.string().optional().describe("Kommagetrennte Projekt-IDs"),
      NotifyCustomer: z.number().optional().describe("Kunden benachrichtigen: 0 oder 1"),
    },
    async (body) => {
      const data = await apiPost("/api2/Ticket/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ticket",
    "Ticket aktualisieren. Lock/Unlock wird automatisch durchgeführt.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID für den Lock"),
      fields: z.record(z.string(), z.unknown()).describe("Zu ändernde Felder als Objekt"),
    },
    async ({ id, userId, fields }) => {
      await apiPost("/api2/do/function/Lock", { Model: "ticket", Id: id, Lock: userId });
      try {
        const data = await apiPut(`/api2/Ticket/${id}`, fields);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } finally {
        await apiPost("/api2/do/function/UnLock", { Model: "ticket", Id: id, Lock: userId });
      }
    }
  );

  server.tool(
    "lock_ticket",
    "Ticket manuell sperren.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID"),
    },
    async ({ id, userId }) => {
      const data = await apiPost("/api2/do/function/Lock", { Model: "ticket", Id: id, Lock: userId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "unlock_ticket",
    "Ticket manuell entsperren.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID"),
    },
    async ({ id, userId }) => {
      const data = await apiPost("/api2/do/function/UnLock", { Model: "ticket", Id: id, Lock: userId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "upload_file_to_ticket",
    "Dokument an Ticket anhängen.",
    {
      ticketId: z.number().describe("Ticket-ID"),
      filename: z.string().describe("Dateiname"),
      content: z.string().describe("Dateiinhalt als Base64-String"),
    },
    async ({ ticketId, filename, content }) => {
      const data = await apiPost("/api2/do/function/UploadFile", { ticketId, filename, content });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "check_ticket_lock",
    "Prüft ob ein Ticket noch von einem bestimmten Benutzer gesperrt ist.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID des Sperrenden"),
    },
    async ({ id, userId }) => {
      const data = await apiPost("/api2/do/function/StillLocked", { Model: "ticket", Id: id, Lock: userId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
