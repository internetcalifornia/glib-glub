/**
 * The MCP authoring endpoint (Decision #8). Authentication is an API key
 * as a bearer token, resolved to the educator it belongs to; a request
 * without one is served read-only. Everything else is the SDK's handler.
 */

import { getDeps } from '@/lib/deps';
import { bearerFrom, resolveApiKey } from '@/lib/mcp/api-keys';
import { mcpHandler } from '@/lib/mcp/server';

async function serve(request: Request): Promise<Response> {
  const deps = getDeps();
  if (!deps.ok) return Response.json({ error: deps.err.type }, { status: 500 });

  const bearer = bearerFrom(request.headers);
  if (!bearer) return mcpHandler(deps.val).fetch(request);

  const user = await resolveApiKey(deps.val.db, bearer, deps.val.clock.now());
  if (!user.ok) {
    return Response.json(
      { error: user.err.type },
      {
        status: user.err.type === 'INVALID_KEY' ? 401 : 500,
        headers: { 'www-authenticate': 'Bearer realm="glib-glub MCP"' },
      }
    );
  }
  return mcpHandler(deps.val).fetch(request, {
    authInfo: { token: bearer, clientId: user.val, scopes: ['curriculum'] },
  });
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
