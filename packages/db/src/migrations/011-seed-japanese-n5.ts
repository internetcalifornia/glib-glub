/**
 * Seed (Decision #7): Languages → Japanese → "Japanese: first steps" — a
 * short beginner track (hiragana, greetings, numbers and time) that proves
 * the model generalises beyond mathematics and beyond children: the level
 * range is 9-12 through adult, and the tutor's notes assume a learner who
 * can read English explanations.
 */

import type { Kysely } from 'kysely';

import { seedTrack, unseedTrack, type SeedTrack } from './seed';

export const JAPANESE_FIRST_STEPS: SeedTrack = {
  key: 'japanese-first-steps',
  category: 'Languages',
  subject: 'Japanese',
  title: 'Japanese: first steps',
  summary:
    'Hiragana, greetings, numbers and time — enough to introduce yourself, be polite, and read a menu.',
  levelMin: '9-12',
  levelMax: 'adult',
  language: 'ja',
  pedagogy:
    'Speak mostly in English with Japanese words and short phrases spoken clearly at a natural pace, then slowly. Have the learner repeat aloud and listen for pitch and vowel length. Never translate a whole sentence for them before they have tried; ask what they recognise. Correct gently by modelling the right form, then asking them to say it again. Use romaji only until the hiragana in the lesson is learned.',
  units: [
    {
      title: 'Hiragana',
      lessons: [
        {
          title: 'Vowels and the k row',
          objectives: ['Pronounce あいうえお with pure vowels', 'Recognise かきくけこ'],
          content:
            'Five vowels, always the same sound: a (ah) i (ee) u (oo) e (eh) o (oh). Have the learner say each and then combine with k. Ask them to spot the vowel inside each k-row sound. Expect English-style diphthongs ("ay" for え); model the short pure vowel. Practise reading あか (red) and いけ (pond).',
        },
        {
          title: 'The s, t and n rows',
          objectives: [
            'Read and say さしすせそ, たちつてと, なにぬねの',
            'Notice the irregular readings し, ち, つ',
          ],
          content:
            'Introduce each row by sound first, then the shapes. Point out し is "shi", ち is "chi", つ is "tsu" — ask the learner to find them in words (すし, ちず). Build words from rows learned so far: なつ (summer), あさ (morning). Expect confusing さ and ち, ぬ and め; contrast them side by side.',
        },
        {
          title: 'Dakuten and combined sounds',
          objectives: [
            'Read voiced sounds (が, ざ, だ, ば) and ぱ',
            'Read combinations like きゃ, しゅ, ちょ',
          ],
          content:
            'Two small marks turn k into g, s into z, t into d, h into b; a small circle makes p. Ask the learner to guess a few before telling them. Combined sounds use a small や, ゆ, よ: きょ is one beat, not two. Practise with とうきょう (Tokyo) and ask them to count beats. Expect reading small や as full size.',
        },
      ],
    },
    {
      title: 'Greetings and introductions',
      lessons: [
        {
          title: 'Hello, goodbye and thank you',
          objectives: [
            'Use おはようございます, こんにちは, こんばんは at the right time of day',
            'Say ありがとうございます and すみません',
          ],
          content:
            'Greet the learner in Japanese and see what they do. Explain the three greetings by time of day, then quiz with a clock time. ありがとうございます is thanks; すみません covers "excuse me" and "sorry" — ask for a situation for each. Model the polite ending ございます and explain when the shorter form is fine (friends, family).',
        },
        {
          title: 'Introducing yourself',
          objectives: [
            'Say your name and where you are from with です',
            'Use はじめまして and よろしくおねがいします',
          ],
          content:
            'はじめまして (nice to meet you), [name] です, [place] から きました, よろしくおねがいします. Have the learner build their own introduction and say it twice. Ask what です does (it is the polite "am/is"). Expect trying to say "I" every time; explain that わたし is often dropped when clear.',
        },
        {
          title: 'Simple questions',
          objectives: [
            'Ask and answer おなまえは? and おげんきですか',
            'Use か to make a question',
          ],
          content:
            'Adding か at the end turns a statement into a question — demonstrate with げんきです → げんきですか. Practise a two-line exchange and swap roles. Ask the learner to make a question from a sentence they know. Expect rising intonation without か, which is casual; model both.',
        },
      ],
    },
    {
      title: 'Numbers and time',
      lessons: [
        {
          title: 'Numbers 1 to 100',
          objectives: [
            'Count 1–10 and build 11–99 from them',
            'Notice the alternative readings of 4, 7 and 9',
          ],
          content:
            'いち に さん し/よん ご ろく しち/なな はち きゅう じゅう. Once 1–10 are solid, show that 11 is じゅういち (ten-one) and 20 is にじゅう (two-ten); let the learner build 34 and 78 themselves. Explain that よん and なな are often preferred (し sounds like death). Quiz with prices and ages.',
        },
        {
          title: 'Telling time',
          objectives: ['Say the hour with じ and minutes with ふん/ぷん', 'Ask いま なんじですか'],
          content:
            "Hours take じ: さんじ (3 o'clock). Warn about よじ (4), くじ (9) and しちじ (7). Minutes take ふん or ぷん depending on the number — give the pattern, then ask the learner to try 5, 10, 15 and correct by modelling. Ask the time on a real clock several times.",
        },
        {
          title: 'Days and dates',
          objectives: [
            'Name the days of the week',
            'Say a date with がつ and にち, noting the irregular days',
          ],
          content:
            "Days end in ようび: げつようび (Monday) through にちようび (Sunday); ask what each first part means (moon, fire, water…). Months are number + がつ; days of the month mostly number + にち, but 1st–10th, 14th, 20th and 24th are irregular. Teach ついたち, ふつか, みっか first; ask the learner's birthday.",
        },
      ],
    },
  ],
};

export async function up(db: Kysely<unknown>): Promise<void> {
  await seedTrack(db, JAPANESE_FIRST_STEPS);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await unseedTrack(db, JAPANESE_FIRST_STEPS.key);
}
