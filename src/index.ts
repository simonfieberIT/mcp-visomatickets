import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerTimerTools } from "./tools/timers.js";
import { registerGhostwriterTools } from "./tools/ghostwriter.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerAddressTools } from "./tools/addresses.js";
import { registerUserTools } from "./tools/users.js";
import { registerArticleTools } from "./tools/articles.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerStatusTools } from "./tools/status.js";
import { registerPriorityTools } from "./tools/priorities.js";
import { registerTypeTools } from "./tools/types.js";
import { registerEmailTools } from "./tools/email.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerConceptOfficeTools } from "./tools/conceptoffice.js";
import { registerRmmTools } from "./tools/rmm.js";
import { registerSearchTools } from "./tools/search.js";
import { registerUserGroupTools } from "./tools/usergroups.js";
import { VisomaSession } from "./session.js";

const server = new McpServer({
  name: "visoma-tickets",
  version: "0.1.0",
});

const session = new VisomaSession();

registerTicketTools(server);
registerTimerTools(server);
registerGhostwriterTools(server, session);
registerInvoiceTools(server);
registerCustomerTools(server);
registerContactTools(server);
registerAddressTools(server);
registerUserTools(server);
registerArticleTools(server);
registerAssetTools(server);
registerProjectTools(server);
registerCategoryTools(server);
registerStatusTools(server);
registerPriorityTools(server);
registerTypeTools(server);
registerEmailTools(server);
registerWebhookTools(server);
registerTemplateTools(server);
registerChecklistTools(server);
registerConceptOfficeTools(server);
registerRmmTools(server);
registerSearchTools(server);
registerUserGroupTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
