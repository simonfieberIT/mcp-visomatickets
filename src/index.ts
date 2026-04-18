import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "visoma-tickets",
  version: "0.1.0",
});

// Tools werden in späteren Tasks hier registriert

const transport = new StdioServerTransport();
await server.connect(transport);
