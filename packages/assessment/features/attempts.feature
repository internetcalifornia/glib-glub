Feature: Attempts, scores and educator overrides
  A learner sits an assessment; each response is graded; the attempt's
  score follows the latest grade for each response. An educator can
  override a grade, and the earlier grade stays in the history.

  Background:
    Given "maya@example.com" is a learner
    And "ed@example.com" is an educator
    And a quiz "Fractions check" with a single-choice question "1/2 + 1/4 = ?" keyed "3/4", a true-false question "2/4 equals 1/2" keyed "true", and a short-answer question "Why is 3/6 one half?" with the rubric "divides top and bottom by 3"
    And the grader will answer with a score of 0.5 and the feedback "Half there"

  Scenario: Submitting an attempt grades every response
    When "maya@example.com" submits "Fractions check" with the answers "3/4 | true | because 3 is half of 6"
    Then the attempt score is 2.5 out of 3
    And the response to "Why is 3/6 one half?" was graded by "llm"

  Scenario: An educator overrides a model grade and the history is kept
    Given "maya@example.com" submitted "Fractions check" with the answers "3/4 | true | because 3 is half of 6"
    When "ed@example.com" overrides the grade for "Why is 3/6 one half?" to 1 with the feedback "Exactly right"
    Then the attempt score is 3 out of 3
    And the response to "Why is 3/6 one half?" has 2 gradings
    And the latest grading was by "educator"

  Scenario: A learner cannot override grades
    Given "maya@example.com" submitted "Fractions check" with the answers "3/4 | true | because 3 is half of 6"
    When "maya@example.com" overrides the grade for "Why is 3/6 one half?" to 1 with the feedback "I deserve it"
    Then the change fails with FORBIDDEN

  Scenario: Missing answers score zero
    When "maya@example.com" submits "Fractions check" with the answers "3/4"
    Then the attempt score is 1 out of 3
