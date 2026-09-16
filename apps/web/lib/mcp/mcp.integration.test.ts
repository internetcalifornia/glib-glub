/**
 * The MCP surface end to end through the real route handler: an educator's
 * API key lets an MCP client list the tools and create a track that then
 * exists in the catalogue; a bad key is refused with 401; an anonymous
 * client can list but not write.
 */

import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { ensureSubject, kyselyCurriculumStore } from '@glib-glub/curriculum';
import type { DB } from '@glib-glub/db';
import { IDENTITY_TABLES, kyselyIdentityStore } from '@glib-glub/identity';
import { connectTestDb, describeLive } from '@glib-glub/testing';
import { afterAll, beforeEach, expect, it } from 'vitest';

// The route reads its configuration lazily; give it enough to build deps.
process.env.APP_ORIGIN ??= 'http://localhost:3000';
process.env.AUTH_SECRET ??= '0123456789abcdef0123456789abcdef';

import { POST } from '@/app/api/mcp/route';
import { createApiKey } from './api-keys';

describeLive('MCP over /api/mcp', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, clear, close } = handle.val;
  const identity = kyselyIdentityStore(db);

  beforeEach(async () => {
    void (await clear(['mcp_api_keys', ...IDENTITY_TABLES]));
  });
  afterAll(async () => {
    await close();
  });

  const routeFetch = (input: string | URL | Request, init?: RequestInit) =>
    POST(new Request(input, init));

  async function connect(bearer: string | null): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL('http://glib-glub.test/api/mcp'), {
      fetch: routeFetch,
      requestInit: bearer ? { headers: { authorization: `Bearer ${bearer}` } } : undefined,
    });
    const client = new Client({ name: 'contract-test', version: '0.0.0' });
    await client.connect(transport);
    return client;
  }

  function textOf(result: unknown): string {
    if (
      typeof result !== 'object' ||
      result === null ||
      !('content' in result) ||
      !Array.isArray(result.content)
    )
      return '';
    return result.content
      .map((block: unknown) =>
        typeof block === 'object' &&
        block !== null &&
        'text' in block &&
        typeof block.text === 'string'
          ? block.text
          : ''
      )
      .join('\n');
  }

  it('lets an educator create a track with an API key, and refuses a bad key', async () => {
    const educator = await identity.createUser({
      email: 'ed@example.com',
      name: 'Ms Lee',
      emailVerified: true,
    });
    expect(educator.ok).toBe(true);
    if (!educator.ok) return;
    void (await identity.addRole(educator.val.id, 'educator'));
    const key = await createApiKey(db, {
      userId: educator.val.id,
      name: 'authoring agent',
      now: new Date(),
    });
    expect(key.ok).toBe(true);
    if (!key.ok) return;

    const client = await connect(key.val.secret);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain('curriculum_create_track');
    const subject = await ensureSubject(
      kyselyCurriculumStore(db),
      'Mathematics',
      'Grade 6 Mathematics'
    );
    expect(subject.ok).toBe(true);
    const subjectId = subject.ok ? subject.val.id : '';
    const categories = textOf(
      await client.callTool({ name: 'curriculum_list_categories', arguments: {} })
    );
    expect(categories).toContain(`Grade 6 Mathematics (subject id ${subjectId})`);
    const created = await client.callTool({
      name: 'curriculum_create_track',
      arguments: {
        subjectId,
        title: 'Ratios by MCP',
        summary: 'A track authored over the wire.',
        levelMin: '6-8',
        levelMax: '6-8',
        language: 'en',
      },
    });
    expect(textOf(created)).toContain('Ratios by MCP');
    await client.close();

    const refused = await routeFetch('http://glib-glub.test/api/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer gg_not_a_real_key',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(refused.status).toBe(401);
  });

  it('serves an anonymous client read-only', async () => {
    const client = await connect(null);
    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);
    const attempt = await client.callTool({
      name: 'curriculum_create_track',
      arguments: {
        subjectId: '00000000-0000-4000-8000-000000000000',
        title: 'Nope',
        summary: 'Anonymous',
        levelMin: '6-8',
        levelMax: '6-8',
        language: 'en',
      },
    });
    expect('isError' in attempt && attempt.isError).toBe(true);
    await client.close();
  });
});
