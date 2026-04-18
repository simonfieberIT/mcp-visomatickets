import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTicketTools } from "./tools/tickets.js";

const server = new McpServer({
  name: "visoma-tickets",
  version: "0.1.0",
});

registerTicketTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
