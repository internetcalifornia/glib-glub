Feature: A baseline test estimates a level
  Before the first session a learner can take a short baseline test. The
  score becomes a level estimate for the subject that the tutor reads
  from the personalisation snapshot.

  Scenario Outline: Scores map to levels
    Given "maya@example.com" is a learner
    And a baseline test "Grade 6 baseline" for the subject "Grade 6 Mathematics" with 10 true-false questions all keyed "true"
    When "maya@example.com" answers <correct> of them correctly
    Then the level estimate of "maya@example.com" in "Grade 6 Mathematics" is "<level>"

    Examples:
      | correct | level      |
      | 2       | beginning  |
      | 5       | developing |
      | 8       | proficient |
      | 10      | advanced   |

  Scenario: A later baseline replaces the estimate
    Given "maya@example.com" is a learner
    And a baseline test "Grade 6 baseline" for the subject "Grade 6 Mathematics" with 10 true-false questions all keyed "true"
    And "maya@example.com" answered 4 of them correctly
    When "maya@example.com" answers 9 of them correctly
    Then the level estimate of "maya@example.com" in "Grade 6 Mathematics" is "advanced"
    And "maya@example.com" has 1 level estimate
