import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../client.js";

export function registerEmailTools(server: McpServer) {
  server.tool("send_email", "E-Mail über Visoma versenden.",
    {
      to: z.string().describe("Empfänger-E-Mail (Pflicht)"),
      subject: z.string().optional(),
      body: z.string().optional(),
      cc: z.string().optional(),
      ticketId: z.number().optional(),
      template: z.number().optional().describe("Nachrichten-Vorlagen-ID"),
      save: z.number().optional().describe("In DB speichern: 0 oder 1"),
    },
    async (body) => {
      const data = await apiPost("/api2/do/function/sendMail", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("search_messages", "E-Mails zu einem Ticket suchen.",
    { ticketId: z.number().describe("Ticket-ID") },
    async ({ ticketId }) => {
      const data = await apiGet(`/api2/message/search/params[ticketid]/${ticketId}/`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("get_unread_messages", "Ungelesene E-Mails abrufen.", {},
    async () => {
      const data = await apiGet("/api2/message/search/unseen/1/");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
