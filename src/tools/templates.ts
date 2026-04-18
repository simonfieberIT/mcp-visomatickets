import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../client.js";

export function registerTemplateTools(server: McpServer) {
  server.tool("search_message_templates", "Nachrichtenvorlagen auflisten.", {},
    async () => {
      const data = await apiGet("/api2/messagetemplates/search/");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("search_text_templates", "Textbausteine auflisten.", {},
    async () => {
      const data = await apiGet("/api2/texttemplates/search/");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
