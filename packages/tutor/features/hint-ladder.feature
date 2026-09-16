Feature: The hint ladder is enforced in code
  The tutor never gives away an answer the learner has not tried for.
  Each attempt on a problem moves the tutor one rung up the ladder:
  clarify, then hint, then a parallel worked example, and only then the
  answer with an explanation.

  Background:
    Given a live solo session for "maya@example.com"
    And the tutor presented the problem "5 pencils cost $2.50. What does one cost?" with the expected answer "0.50"

  Scenario: A wrong first attempt gets a clarifying question
    When the learner attempts "2.50"
    Then the attempt is marked incorrect
    And the next move is "clarify"

  Scenario: A second wrong attempt gets a hint
    Given the learner attempted "2.50"
    When the learner attempts "12.50"
    Then the next move is "hint"

  Scenario: A third wrong attempt gets a parallel worked example
    Given the learner attempted "2.50" and "12.50"
    When the learner attempts "5"
    Then the next move is "parallel_example"

  Scenario: Only after three wrong attempts may the answer be revealed
    Given the learner attempted "2.50", "12.50" and "5"
    When the learner attempts "0.25"
    Then the next move is "reveal_with_explanation"

  Scenario: A correct attempt closes the problem with an explanation
    Given the learner attempted "2.50"
    When the learner attempts "0.50"
    Then the attempt is marked correct
    And the next move is "celebrate_and_explain"
    And the problem is closed

  Scenario: Answers are compared leniently
    When the learner attempts "$0.5"
    Then the attempt is marked correct

  Scenario: The tutor cannot record an attempt without a problem
    Given the problem was closed
    When the learner attempts "anything"
    Then recording fails with NO_OPEN_PROBLEM
