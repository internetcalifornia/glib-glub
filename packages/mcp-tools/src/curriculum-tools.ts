/**
 * The curriculum authoring surface over MCP: `curriculum_<verb>_<noun>`
 * tools. Registration performs no I/O — every handler resolves its data
 * when called — so the same function can register into a real server and
 * into a collector that lists the surface for documentation.
 *
 * Read tools are marked `readOnlyHint`; act tools require a caller
 * (`ctx.userId`) and hand it to the curriculum policy, which enforces the
 * educator role and authorship. The tool never re-implements those rules.
 */

import { brandId } from '@glib-glub/core';
import {
  addLesson,
  addUnit,
  createTrack,
  getOutline,
  listCatalogue,
  publishTrack,
  browseSubject,
  type CurriculumDeps,
} from '@glib-glub/curriculum';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { errorResult, textResult, type ToolContext, type ToolText } from './common';

const LEVELS = ['k-5', '6-8', '9-12', 'university', 'adult'] as const;

function requireCaller(ctx: ToolContext): ToolText | null {
  return ctx.userId
    ? null
    : {
        content: [{ type: 'text', text: 'FORBIDDEN: this tool needs an authenticated educator' }],
        isError: true,
      };
}

export function registerCurriculumTools(
  server: McpServer,
  ctx: ToolContext,
  deps: CurriculumDeps
): void {
  server.registerTool(
    'curriculum_list_categories',
    {
      title: 'Curriculum · Read — List categories and subjects',
      description:
        'Every category with its subjects and their ids, for choosing where a track belongs.',
      annotations: { readOnlyHint: true },
      inputSchema: z.object({}),
    },
    async (): Promise<ToolText> => {
      const catalogue = await listCatalogue(deps.store);
      if (!catalogue.ok) return errorResult(catalogue);
      if (catalogue.val.length === 0) return textResult('No categories yet.');
      return textResult(
        catalogue.val
          .map(
            (entry) =>
              `${entry.category.name}\n${entry.subjects.map((subject) => `  - ${subject.name} (subject id ${subject.id})`).join('\n')}`
          )
          .join('\n')
      );
    }
  );

  server.registerTool(
    'curriculum_list_tracks',
    {
      title: 'Curriculum · Read — List tracks in a subject',
      description: "Published tracks in a subject, plus the caller's own drafts.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        subjectId: z.string().uuid().describe('A subject id from curriculum_list_categories'),
      }),
    },
    async ({ subjectId }): Promise<ToolText> => {
      const tracks = await browseSubject(deps.store, {
        viewerId: ctx.userId ? brandId<'user'>(ctx.userId) : null,
        subjectId: brandId<'subject'>(subjectId),
      });
      if (!tracks.ok) return errorResult(tracks);
      if (tracks.val.length === 0) return textResult('No tracks in this subject.');
      return textResult(
        tracks.val
          .map((track) => `- ${track.title} [${track.visibility}] (track id ${track.id})`)
          .join('\n')
      );
    }
  );

  server.registerTool(
    'curriculum_get_track',
    {
      title: 'Curriculum · Read — Get a track outline',
      description:
        'The units and lessons of a track, in teaching order, with ids for adding lessons.',
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ trackId: z.string().uuid() }),
    },
    async ({ trackId }): Promise<ToolText> => {
      const outline = await getOutline(deps, brandId<'track'>(trackId));
      if (!outline.ok) return errorResult(outline);
      const lines = [
        `${outline.val.track.title} [${outline.val.track.visibility}] — levels ${outline.val.track.levelMin}–${outline.val.track.levelMax}`,
        outline.val.track.summary,
        ...outline.val.units.flatMap((unit) => [
          `Unit ${unit.position}: ${unit.title} (unit id ${unit.id})`,
          ...unit.lessons.map(
            (lesson) =>
              `  ${unit.position}.${lesson.position} ${lesson.title} (lesson id ${lesson.id})`
          ),
        ]),
      ];
      return textResult(lines.filter(Boolean).join('\n'));
    }
  );

  server.registerTool(
    'curriculum_create_track',
    {
      title: 'Curriculum · Act — Create a draft track',
      description:
        'Create a draft track in a subject. Only educators. Add units and lessons, then publish.',
      annotations: { readOnlyHint: false },
      inputSchema: z.object({
        subjectId: z.string().uuid(),
        title: z.string().min(1).max(200),
        summary: z.string().max(1000).optional(),
        levelMin: z.enum(LEVELS).optional(),
        levelMax: z.enum(LEVELS).optional(),
        language: z.string().min(2).max(8).optional(),
        pedagogy: z
          .string()
          .max(2000)
          .optional()
          .describe('Teaching rules the tutor follows for this track'),
      }),
    },
    async (input): Promise<ToolText> => {
      const refused = requireCaller(ctx);
      if (refused) return refused;
      const track = await createTrack(deps, brandId<'user'>(ctx.userId ?? ''), {
        subjectId: brandId<'subject'>(input.subjectId),
        title: input.title,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        ...(input.levelMin === undefined ? {} : { levelMin: input.levelMin }),
        ...(input.levelMax === undefined ? {} : { levelMax: input.levelMax }),
        ...(input.language === undefined ? {} : { language: input.language }),
        ...(input.pedagogy === undefined ? {} : { pedagogy: input.pedagogy }),
        origin: 'mcp',
      });
      if (!track.ok) return errorResult(track);
      return textResult(`Created draft track "${track.val.title}" (track id ${track.val.id}).`);
    }
  );

  server.registerTool(
    'curriculum_add_unit',
    {
      title: 'Curriculum · Act — Add a unit to a draft track',
      description: "Append a unit to the author's draft track.",
      annotations: { readOnlyHint: false },
      inputSchema: z.object({ trackId: z.string().uuid(), title: z.string().min(1).max(200) }),
    },
    async ({ trackId, title }): Promise<ToolText> => {
      const refused = requireCaller(ctx);
      if (refused) return refused;
      const unit = await addUnit(deps, brandId<'user'>(ctx.userId ?? ''), {
        trackId: brandId<'track'>(trackId),
        title,
      });
      if (!unit.ok) return errorResult(unit);
      return textResult(
        `Added unit ${unit.val.position} "${unit.val.title}" (unit id ${unit.val.id}).`
      );
    }
  );

  server.registerTool(
    'curriculum_add_lesson',
    {
      title: 'Curriculum · Act — Add a lesson to a unit',
      description:
        "Append a lesson to a unit of the author's draft track. Content is the tutor's teaching notes, not a script.",
      annotations: { readOnlyHint: false },
      inputSchema: z.object({
        trackId: z.string().uuid(),
        unitId: z.string().uuid(),
        title: z.string().min(1).max(200),
        objectives: z.array(z.string().max(200)).max(8).optional(),
        content: z.string().max(8000).optional(),
        estimatedMinutes: z.number().int().min(5).max(120).optional(),
      }),
    },
    async (input): Promise<ToolText> => {
      const refused = requireCaller(ctx);
      if (refused) return refused;
      const lesson = await addLesson(deps, brandId<'user'>(ctx.userId ?? ''), {
        trackId: brandId<'track'>(input.trackId),
        unitId: brandId<'unit'>(input.unitId),
        title: input.title,
        ...(input.objectives === undefined ? {} : { objectives: input.objectives }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.estimatedMinutes === undefined
          ? {}
          : { estimatedMinutes: input.estimatedMinutes }),
      });
      if (!lesson.ok) return errorResult(lesson);
      return textResult(
        `Added lesson ${lesson.val.position} "${lesson.val.title}" (lesson id ${lesson.val.id}).`
      );
    }
  );

  server.registerTool(
    'curriculum_publish_track',
    {
      title: 'Curriculum · Act — Publish a draft track',
      description: "Make the author's draft track visible to learners. Needs at least one lesson.",
      annotations: { readOnlyHint: false },
      inputSchema: z.object({ trackId: z.string().uuid() }),
    },
    async ({ trackId }): Promise<ToolText> => {
      const refused = requireCaller(ctx);
      if (refused) return refused;
      const track = await publishTrack(
        deps,
        brandId<'user'>(ctx.userId ?? ''),
        brandId<'track'>(trackId)
      );
      if (!track.ok) return errorResult(track);
      return textResult(`Published "${track.val.title}".`);
    }
  );
}

export const CURRICULUM_TOOL_NAMES = [
  'curriculum_list_categories',
  'curriculum_list_tracks',
  'curriculum_get_track',
  'curriculum_create_track',
  'curriculum_add_unit',
  'curriculum_add_lesson',
  'curriculum_publish_track',
] as const;
