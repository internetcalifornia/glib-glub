/**
 * The MCP surface end to end through the SDK's own client over an
 * in-memory transport: the tools are listed with their names and hints, an
 * educator can create → add unit → add lesson → publish, a learner is
 * refused by the policy underneath (not by the tool), and an anonymous
 * client can read but not write.
 */

import { curriculumWorld, ensureSubject, type CurriculumWorld } from '@glib-glub/curriculum';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { registerCurriculumTools, CURRICULUM_TOOL_NAMES } from './curriculum-tools';
import type { ToolContext } from './common';

async function connect(world: CurriculumWorld, ctx: ToolContext): Promise<Client> {
  const server = new McpServer({ name: 'glib-glub-test', version: '0.0.0' });
  registerCurriculumTools(server, ctx, world);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
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

function isError(result: unknown): boolean {
  return (
    typeof result === 'object' && result !== null && 'isError' in result && result.isError === true
  );
}

const uuid = (text: string, label: string): string => {
  const match = text.match(new RegExp(`${label} id ([0-9a-f-]{36})`));
  return match?.[1] ?? '';
};

describe('curriculum MCP tools', () => {
  let world: CurriculumWorld;
  let subjectId: string;

  beforeEach(async () => {
    world = curriculumWorld();
    const subject = await ensureSubject(world.store, 'Mathematics', 'Grade 6 Mathematics');
    subjectId = subject.ok ? subject.val.id : '';
  });

  it('lists every tool with a read/act hint', async () => {
    const client = await connect(world, { userId: null });

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([...CURRICULUM_TOOL_NAMES].sort());
    const create = tools.tools.find((tool) => tool.name === 'curriculum_create_track');
    const list = tools.tools.find((tool) => tool.name === 'curriculum_list_categories');
    expect(create?.annotations?.readOnlyHint).toBe(false);
    expect(list?.annotations?.readOnlyHint).toBe(true);
  });

  it('lets an educator author and publish a track', async () => {
    const educator = await world.person('ed@example.com', 'educator');
    const client = await connect(world, { userId: educator });

    const categories = textOf(
      await client.callTool({ name: 'curriculum_list_categories', arguments: {} })
    );
    expect(categories).toContain('Grade 6 Mathematics');
    expect(uuid(categories, 'subject')).toBe(subjectId);

    const created = textOf(
      await client.callTool({
        name: 'curriculum_create_track',
        arguments: { subjectId, title: 'Fractions' },
      })
    );
    const trackId = uuid(created, 'track');
    expect(trackId).not.toBe('');

    const unit = textOf(
      await client.callTool({
        name: 'curriculum_add_unit',
        arguments: { trackId, title: 'Adding fractions' },
      })
    );
    const unitId = uuid(unit, 'unit');
    const lesson = await client.callTool({
      name: 'curriculum_add_lesson',
      arguments: {
        trackId,
        unitId,
        title: 'Same denominators',
        objectives: ['add halves'],
        content: 'Ask what a half plus a half is.',
      },
    });
    expect(isError(lesson)).toBe(false);

    const published = await client.callTool({
      name: 'curriculum_publish_track',
      arguments: { trackId },
    });
    expect(isError(published)).toBe(false);
    const outline = textOf(
      await client.callTool({ name: 'curriculum_get_track', arguments: { trackId } })
    );
    expect(outline).toContain('Fractions [published]');
    expect(outline).toContain('1.1 Same denominators');
  });

  it('refuses a learner through the policy, as a text error', async () => {
    const learner = await world.person('maya@example.com');
    const client = await connect(world, { userId: learner });

    const result = await client.callTool({
      name: 'curriculum_create_track',
      arguments: { subjectId, title: 'Nope' },
    });

    expect(isError(result)).toBe(true);
    expect(textOf(result)).toContain('FORBIDDEN');
  });

  it('refuses an anonymous client before the policy runs', async () => {
    const client = await connect(world, { userId: null });

    const result = await client.callTool({
      name: 'curriculum_create_track',
      arguments: { subjectId, title: 'Nope' },
    });

    expect(isError(result)).toBe(true);
    expect(textOf(result)).toContain('authenticated educator');
  });

  it('reports an empty publish as TRACK_EMPTY', async () => {
    const educator = await world.person('ed@example.com', 'educator');
    const client = await connect(world, { userId: educator });
    const created = textOf(
      await client.callTool({
        name: 'curriculum_create_track',
        arguments: { subjectId, title: 'Empty' },
      })
    );

    const result = await client.callTool({
      name: 'curriculum_publish_track',
      arguments: { trackId: uuid(created, 'track') },
    });

    expect(isError(result)).toBe(true);
    expect(textOf(result)).toContain('TRACK_EMPTY');
  });
});
