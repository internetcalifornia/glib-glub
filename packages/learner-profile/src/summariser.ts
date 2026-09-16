/**
 * Summarising an upload: what it is, what it shows about the learner, and
 * a handful of topic tags. LLM-backed through the structured-output helper,
 * so a malformed answer is SUMMARY_FAILED rather than a half-parsed object.
 *
 * The prompt asks for pedagogy, not description: "what does this reveal
 * about what the learner can and cannot yet do" is what the tutor needs.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import { completeJson, type LlmProvider } from '@glib-glub/ai';
import { z } from 'zod';

import type { Summariser } from './ports';

const summarySchema = z.object({
  summary: z.string().min(1).max(1_200),
  tags: z.array(z.string().min(1).max(40)).max(12),
});

const MAX_TEXT_CHARS = 24_000;

export const SUMMARISER_SYSTEM_PROMPT = `You read a learner's uploaded schoolwork (an essay, a test, notes) and describe what it reveals about them as a learner, for a tutor who will meet them next.
Answer with JSON: {"summary": string, "tags": string[]}.
- summary: 2–5 sentences. Name the subject and topics, what the learner did well, and where they struggled or made errors. Be specific and kind. Never quote the work at length.
- tags: up to 12 short lowercase topic tags (e.g. "fractions", "unlike denominators", "essay structure").`;

export function llmSummariser(llm: LlmProvider): Summariser {
  return {
    summarise: async ({ fileName, text }): ReturnType<Summariser['summarise']> => {
      const result = await completeJson(
        llm,
        {
          system: SUMMARISER_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: `File name: ${fileName}\n\n${text.slice(0, MAX_TEXT_CHARS)}` },
          ],
          maxTokens: 600,
          temperature: 0.2,
        },
        summarySchema
      );
      if (!result.ok) {
        return err('SUMMARY_FAILED', { message: result.err.message, cause: result.err });
      }
      return ok({
        summary: result.val.value.summary,
        tags: [...new Set(result.val.value.tags.map((tag) => tag.toLowerCase().trim()))],
      });
    },
  };
}

/**
 * A summariser with no model behind it: the file name and the topic words
 * as the summary, distinct long words as tags. It never quotes the text —
 * the snapshot must not carry raw upload text, and a fake that leaked it
 * would pass a scenario the real summariser is held to. Used by feature
 * tests, and as the fallback when no AI endpoint is configured so uploads
 * still land somewhere useful in development.
 */
export const keywordSummariser: Summariser = {
  summarise: async ({ fileName, text }): ReturnType<Summariser['summarise']> => {
    const words = `${fileName} ${text}`
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 5);
    const tags = [...new Set(words)].slice(0, 12);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return ok({
      summary: `${fileName}: ${wordCount} words covering ${tags.slice(0, 5).join(', ') || 'no clear topics'}`,
      tags,
    });
  },
};
