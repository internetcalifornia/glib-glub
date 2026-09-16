/**
 * Seed (Decision #7): Mathematics → Grade 6 Mathematics → "Grade 6
 * Mathematics" — six units of three lessons following the shape of a
 * typical sixth-grade year: ratios and rates; fractions and decimals;
 * expressions; equations and inequalities; geometry; statistics.
 *
 * Lesson content is the tutor's own notes — what to explain, what to ask,
 * the mistakes to expect — never a script to read aloud.
 */

import type { Kysely } from 'kysely';

import { seedTrack, unseedTrack, type SeedTrack } from './seed';

export const GRADE_6_MATH: SeedTrack = {
  key: 'grade-6-math',
  category: 'Mathematics',
  subject: 'Grade 6 Mathematics',
  title: 'Grade 6 Mathematics',
  summary:
    'The sixth-grade year: ratios and rates, fractions and decimals, expressions, equations and inequalities, geometry, and statistics — taught by asking, one idea at a time.',
  levelMin: '6-8',
  levelMax: '6-8',
  language: 'en',
  pedagogy:
    'Speak to an eleven- or twelve-year-old: short sentences, one question at a time, concrete examples (pizza, allowance, sports scores) before symbols. Never state the answer to a problem before the learner has tried twice; first ask what they notice, then give a hint, then show a parallel worked example with different numbers. When they are right, ask them to explain why. Celebrate reasoning aloud.',
  units: [
    {
      title: 'Ratios and rates',
      lessons: [
        {
          title: 'What a ratio says',
          objectives: [
            'Describe a ratio relationship in words and with a:b notation',
            'Tell part-to-part from part-to-whole',
          ],
          content:
            'Start from something the learner has seen: 3 red marbles for every 2 blue. Ask them to say it three ways (3 to 2, 3:2, 3/2) and what each number counts. Draw out that the ratio of red to ALL marbles is 3:5, not 3:2 — the most common slip. Ask them to invent a ratio from their own life (players per team, songs per album). Check: given 6 red, how many blue keeps the same ratio, and how do they know?',
        },
        {
          title: 'Unit rates',
          objectives: ['Find a unit rate from a ratio', 'Use a unit rate to compare two offers'],
          content:
            'A unit rate is a ratio with 1 on the bottom. Use price per item: 5 pencils for $2.50 → ask "what does one pencil cost?" before naming the idea. Then compare two deals (12 for $6 vs 8 for $3.60) and ask which is better and how they decided. Watch for dividing in the wrong direction (pencils per dollar vs dollars per pencil) — both are unit rates; ask which one answers the question. Extend to speed: miles per hour as a unit rate.',
        },
        {
          title: 'Percent as a ratio out of 100',
          objectives: [
            'Explain percent as a ratio to 100',
            'Find a percent of a quantity using a rate per 100',
          ],
          content:
            'Percent means "per hundred". Ask: if 30% of a class of 100 like soccer, how many students? Then a class of 20 — the learner must scale. Use a double number line or a 10×10 grid mentally. Common errors: treating 30% as 30 rather than 0.30, and confusing "30% of" with "30% more". Ask them to find 10% first, then build 30% from it; that strategy transfers to tips and discounts.',
        },
      ],
    },
    {
      title: 'Fractions and decimals',
      lessons: [
        {
          title: 'Dividing fractions',
          objectives: [
            'Interpret a ÷ b as "how many b fit in a"',
            'Divide a fraction by a fraction and explain why the method works',
          ],
          content:
            'Begin with whole numbers: 6 ÷ 2 means "how many 2s in 6". Then 3 ÷ 1/2: how many halves in 3? Let the learner count them before any rule. Only after several concrete cases introduce "multiply by the reciprocal" — and ask them to check it against a case they already counted. The misconception to expect: dividing makes things smaller. Ask for an example where it does not.',
        },
        {
          title: 'Adding, subtracting and multiplying decimals',
          objectives: [
            'Line up place values to add and subtract decimals',
            'Multiply decimals and place the point by reasoning about size',
          ],
          content:
            'Money is the anchor: $3.50 + $0.75. Ask why the digits line up the way they do (same place value), not just "line up the points". For multiplication, 0.5 × 0.2: estimate first — half of a fifth is small — then compute. Errors to expect: adding 3.5 + 0.75 as 3.5 + 7.5, and placing the decimal point by copying a rule without estimating. Always ask "does that size make sense?"',
        },
        {
          title: 'Dividing decimals',
          objectives: [
            'Divide a decimal by a whole number and by a decimal',
            'Use estimation to check a quotient',
          ],
          content:
            'Start with 7.2 ÷ 3 and ask for an estimate (a bit more than 2). Then 7.2 ÷ 0.3: ask "how many 0.3s fit in 7.2?" and let them reason it must be more than 7.2 ÷ 3. Show that scaling both numbers by 10 leaves the answer unchanged (72 ÷ 3) and ask why. The learner should end the lesson able to say, in their own words, why moving the point on both numbers is allowed.',
        },
      ],
    },
    {
      title: 'Expressions',
      lessons: [
        {
          title: 'Variables and expressions',
          objectives: [
            'Write an expression from a word phrase',
            'Evaluate an expression for a given value',
          ],
          content:
            'A variable is a placeholder for a number we do not know yet or that can change. Use "3 more than a number" → n + 3, "twice a number" → 2n. Ask the learner to write expressions for their own situations (allowance plus tips). Evaluate for n = 4, n = 10. Expect confusion between 2n and n²: ask what each means with a specific number.',
        },
        {
          title: 'Order of operations and exponents',
          objectives: [
            'Evaluate expressions with exponents using the order of operations',
            'Explain why 2³ is not 2 × 3',
          ],
          content:
            'Ask what 2³ means before defining it (2 × 2 × 2). Then 3 + 2 × 4: ask for the answer and, whichever they give, ask why. Establish the order as a shared convention so everyone reads an expression the same way. Practice with parentheses that change the result. The persistent error is left-to-right regardless of operation; use expressions where that gives a clearly wrong real-world answer.',
        },
        {
          title: 'Equivalent expressions',
          objectives: [
            'Use the distributive property to rewrite an expression',
            'Combine like terms and check equivalence by substitution',
          ],
          content:
            '3(x + 2) = 3x + 6: draw it as three groups of (x + 2). Ask the learner to check with x = 5 on both sides — substitution is the honest test of equivalence and should become a habit. Combine like terms: 2x + 3x + 4 → 5x + 4, and ask why 4 stays separate. Expect 2x + 3 → 5x; ask them to test with a value.',
        },
      ],
    },
    {
      title: 'Equations and inequalities',
      lessons: [
        {
          title: 'Solving one-step equations',
          objectives: ['Solve x + a = b and ax = b by undoing', 'Check a solution by substitution'],
          content:
            'An equation is a balance. x + 7 = 12: ask what number makes it true, then ask what they did (took 7 from both sides). Name "undoing" as the strategy. For 4x = 20, undo multiplication with division. Always check by substituting back. Expect subtracting only from one side; use the balance picture to show why that breaks the equality.',
        },
        {
          title: 'Inequalities on a number line',
          objectives: [
            'Write an inequality from a situation',
            'Represent solutions of x > a or x ≤ a on a number line',
          ],
          content:
            '"You must be at least 12 to ride": age ≥ 12. Ask for values that work and values that do not, and note that there are infinitely many solutions. Draw the number line; open vs closed circle for strict vs inclusive. Expect the learner to treat an inequality as having one answer; ask for three different solutions.',
        },
        {
          title: 'Dependent and independent variables',
          objectives: [
            'Identify which quantity depends on which',
            'Read and build a table and graph for y = kx',
          ],
          content:
            'Hours worked and money earned at $8 an hour: which one do you choose, which one follows? Build a table (1, 8), (2, 16), (3, 24) and plot it. Write the rule y = 8x and ask what 8 means on the graph. Expect swapped axes; ask which variable "comes first" in the story.',
        },
      ],
    },
    {
      title: 'Geometry',
      lessons: [
        {
          title: 'Area of triangles and quadrilaterals',
          objectives: [
            'Find the area of a triangle by relating it to a rectangle',
            'Decompose a trapezoid or composite shape into known pieces',
          ],
          content:
            'Draw a rectangle, cut it along a diagonal, ask what fraction each triangle is. That is where ½ × base × height comes from — let the learner say it. Then a shape made of a rectangle and a triangle: ask them to split it. Expect using the slanted side as the height; ask "which side is perpendicular to the base?"',
        },
        {
          title: 'Volume with fractional edges',
          objectives: [
            'Find the volume of a right rectangular prism with fractional edge lengths',
            'Explain volume as counting unit cubes',
          ],
          content:
            'Volume is how many unit cubes fit. A 2 × 3 × 4 box: count layers before multiplying. Then a box 2 × 3 × ½: ask what half a layer means. Fractional edges are where the formula must be trusted over counting; connect the two with a picture. Expect adding edges instead of multiplying; ask what "cubic" units means.',
        },
        {
          title: 'Surface area from nets',
          objectives: [
            'Unfold a prism into a net and find its surface area',
            'Distinguish surface area from volume',
          ],
          content:
            'Imagine unfolding a cereal box. Ask how many faces, which ones match, and find each area. Surface area is the wrapping; volume is the filling — ask for a real situation for each (paint vs water). Expect forgetting the hidden faces or double-counting; have the learner label each face as they go.',
        },
      ],
    },
    {
      title: 'Statistics',
      lessons: [
        {
          title: 'Statistical questions',
          objectives: [
            'Tell a statistical question from one with a single answer',
            'Describe the spread and center of a data set in words',
          ],
          content:
            '"How tall am I?" has one answer; "How tall are sixth graders?" expects variation — that is a statistical question. Ask the learner to write two of each. Collect a small data set from their own life (minutes of homework this week) and describe it: where is it clustered, how spread out, any outliers?',
        },
        {
          title: 'Mean, median, mode, range',
          objectives: [
            'Compute mean, median, mode and range',
            'Choose which measure describes a set best and say why',
          ],
          content:
            'Use scores like 70, 80, 80, 90, 100. Ask which single number best describes them and why, before defining anything. Then compute each measure. Add an outlier (10) and ask which measures moved — the mean chases outliers, the median does not. Expect forgetting to order the data before finding the median.',
        },
        {
          title: 'Dot plots, histograms and box plots',
          objectives: [
            'Read a dot plot and a histogram',
            'Explain what a box plot shows about spread',
          ],
          content:
            'Same data, three pictures. A dot plot shows every value; a histogram groups them; a box plot shows the middle half and the extremes. Ask what each one hides and what it shows. Have the learner sketch a dot plot from a list, then group it into bins. Expect reading a histogram bar as one value rather than a range.',
        },
      ],
    },
  ],
};

export async function up(db: Kysely<unknown>): Promise<void> {
  await seedTrack(db, GRADE_6_MATH);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await unseedTrack(db, GRADE_6_MATH.key);
}
