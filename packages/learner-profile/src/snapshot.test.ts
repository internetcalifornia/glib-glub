/**
 * renderSnapshot: every populated field appears as one labelled line, empty
 * fields leave no trace, and upload summaries are what appears — never
 * anything that could be raw text (the content type cannot even carry it).
 */

import { describe, expect, it } from 'vitest';

import { renderSnapshot } from './snapshot';

describe('renderSnapshot', () => {
  it('renders each populated field on its own labelled line', () => {
    const text = renderSnapshot({
      about: 'Loves dinosaurs',
      interests: ['dinosaurs', 'football'],
      learningStyles: ['visual'],
      preferredLanguage: 'ja',
      gradeLabel: 'Grade 6',
      objectives: [{ title: 'Explain reasoning out loud' }],
      uploads: [
        { fileName: 'ratios.pdf', summary: 'Ratio worksheet, mostly right', tags: ['ratios'] },
      ],
      levelEstimates: [{ subject: 'Grade 6 Mathematics', level: 'developing', confidence: 0.8 }],
    });

    expect(text.split('\n')).toEqual([
      'About: Loves dinosaurs',
      'Grade: Grade 6',
      'Interests: dinosaurs, football',
      'Learns best: visual',
      'Preferred language: ja',
      'Objectives: Explain reasoning out loud',
      'Prior work (ratios.pdf): Ratio worksheet, mostly right [ratios]',
      'Baseline in Grade 6 Mathematics: developing (confidence 80%)',
    ]);
  });

  it('renders an empty snapshot as an empty string', () => {
    expect(
      renderSnapshot({
        about: '',
        interests: [],
        learningStyles: [],
        preferredLanguage: 'en',
        gradeLabel: null,
        objectives: [],
        uploads: [],
        levelEstimates: [],
      })
    ).toBe('');
  });
});
