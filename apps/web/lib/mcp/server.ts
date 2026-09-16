/**
 * The MCP server the web app serves at /api/mcp: a fresh McpServer per
 * request (the SDK's serving model) with the pure tool registrations from
 * packages/mcp-tools, told who is calling by the route. Registration does
 * no I/O, so building one per request costs nothing measurable.
 */

import { PRODUCT_NAME } from '@glib-glub/core';
import { registerCurriculumTools } from '@glib-glub/mcp-tools';
import { createMcpHandler, McpServer, type McpHttpHandler } from '@modelcontextprotocol/server';

import packageJson from '../../package.json' with { type: 'json' };
import type { Deps } from '../deps';

interface HandlerSlot {
  __glibGlubMcpHandler?: McpHttpHandler;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- globalThis has no declared slot for our state; this is the documented split-singleton guard
const slot = globalThis as unknown as HandlerSlot;

export function mcpHandler(deps: Deps): McpHttpHandler {
  slot.__glibGlubMcpHandler ??= createMcpHandler(
    (ctx) => {
      const server = new McpServer({ name: PRODUCT_NAME, version: packageJson.version });
      registerCurriculumTools(
        server,
        // The route resolved the API key to a user id and passed it as the
        // client id; an anonymous caller gets the read-only tools' view.
        { userId: ctx.authInfo?.clientId ?? null },
        { store: deps.curriculum, roles: deps.roles }
      );
      return server;
    },
    { legacy: 'stateless' }
  );
  return slot.__glibGlubMcpHandler;
}
