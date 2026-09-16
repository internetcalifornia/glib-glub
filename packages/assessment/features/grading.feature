Feature: Grading each kind of question
  Objective questions grade themselves, exactly and predictably. Open
  questions go to a grader against a rubric and come back as a score with
  feedback.

  Scenario Outline: A single-choice answer is right or wrong
    Given a single-choice question "What is 3/4 + 1/8?" with options "7/8, 4/12, 1/2" and the key "7/8"
    When the answer "<answer>" is graded
    Then the score is <score>

    Examples:
      | answer | score |
      | 7/8    | 1     |
      | 1/2    | 0     |

  Scenario Outline: A multi-select answer must match the whole key
    Given a multi-select question "Which are prime?" with options "2, 4, 5, 9" and the keys "2, 5"
    When the answers "<answers>" are graded
    Then the score is <score>

    Examples:
      | answers | score |
      | 2, 5    | 1     |
      | 2       | 0     |
      | 2, 5, 9 | 0     |

  Scenario: A true/false answer
    Given a true-false question "0.5 equals 1/2" with the key "true"
    When the answer "true" is graded
    Then the score is 1

  Scenario Outline: A fill-in-the-blank answer ignores case and spacing and accepts alternatives
    Given a fill-blank question "One half as a decimal is ___" accepting "0.5, .5"
    When the answer "<answer>" is graded
    Then the score is <score>

    Examples:
      | answer | score |
      | .5     | 1     |
      | 0.50   | 0     |

  Scenario: A numeric blank accepts a tolerance
    Given a fill-blank question "Pi to two decimals is ___" accepting "3.14" with a tolerance of 0.005
    When the answer "3.141" is graded
    Then the score is 1

  Scenario: A short answer goes to the grader with the rubric
    Given a short-answer question "Explain why 1/2 = 2/4" with the rubric "Mentions multiplying numerator and denominator by the same number"
    And the grader will answer with a score of 0.75 and the feedback "Good, but say why the value stays the same"
    When the answer "You double both numbers" is graded
    Then the score is 0.75
    And the feedback is "Good, but say why the value stays the same"
    And the grader saw the rubric

  Scenario: A grader failure is a value, not a grade
    Given a short-answer question "Explain" with the rubric "Anything"
    And the grader is unavailable
    When the answer "x" is graded
    Then grading fails with GRADER_UNAVAILABLE
