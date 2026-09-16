/**
 * Text extraction by MIME type. Plain text and Markdown are read as UTF-8;
 * PDF goes through pdfjs; Word documents through mammoth. `composite`
 * dispatches on type so the upload pipeline has one extractor to call and
 * an unsupported type is refused before the file is even stored.
 *
 * The PDF and DOCX extractors are thin wrappers over their libraries and
 * are exercised by the e2e rig with real files rather than by unit tests
 * with synthetic fixtures — a synthetic PDF proves little about a real one.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';

import type { TextExtractor } from './ports';

const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv']);

export const textExtractor: TextExtractor = {
  supports: (mimeType) => TEXT_TYPES.has(mimeType.toLowerCase()),
  extract: async (bytes, mimeType): ReturnType<TextExtractor['extract']> => {
    if (!TEXT_TYPES.has(mimeType.toLowerCase())) return err('UNSUPPORTED_TYPE');
    return ok(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
  },
};

export const pdfExtractor: TextExtractor = {
  supports: (mimeType) => mimeType.toLowerCase() === 'application/pdf',
  extract: async (bytes, mimeType): ReturnType<TextExtractor['extract']> => {
    if (mimeType.toLowerCase() !== 'application/pdf') return err('UNSUPPORTED_TYPE');
    const extracted = await wrapAsync(async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const document = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
      const pages: string[] = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      }
      return pages.join('\n\n');
    }, 'EXTRACTION_FAILED');
    if (!extracted.ok) return extracted;
    return ok(extracted.val);
  },
};

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const docxExtractor: TextExtractor = {
  supports: (mimeType) => mimeType.toLowerCase() === DOCX,
  extract: async (bytes, mimeType): ReturnType<TextExtractor['extract']> => {
    if (mimeType.toLowerCase() !== DOCX) return err('UNSUPPORTED_TYPE');
    const extracted = await wrapAsync(async () => {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return result.value;
    }, 'EXTRACTION_FAILED');
    if (!extracted.ok) return extracted;
    return ok(extracted.val);
  },
};

export function compositeExtractor(extractors: ReadonlyArray<TextExtractor>): TextExtractor {
  return {
    supports: (mimeType) => extractors.some((extractor) => extractor.supports(mimeType)),
    extract: async (bytes, mimeType): ReturnType<TextExtractor['extract']> => {
      const extractor = extractors.find((candidate) => candidate.supports(mimeType));
      if (!extractor) return err('UNSUPPORTED_TYPE', { message: `No extractor for ${mimeType}` });
      return extractor.extract(bytes, mimeType);
    },
  };
}

export const defaultExtractor: TextExtractor = compositeExtractor([
  textExtractor,
  pdfExtractor,
  docxExtractor,
]);
