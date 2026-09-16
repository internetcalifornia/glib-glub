Feature: A session from start to summary
  A session opens with what the tutor needs, records every turn and tool
  call as it goes, and closes with a summary the next session starts from.

  Background:
    Given a learner "maya@example.com" in the age band "6-8" with the snapshot "Visual learner"
    And a track "Grade 6 Mathematics" with the pedagogy "Ask first" whose next due lesson is "Unit rates" with the notes "Price per pencil."

  Scenario: Starting a session records who and what
    When a solo voice session starts for "maya@example.com"
    Then the session is "live"
    And the session is on the lesson "Unit rates"
    And the session has 1 participant

  Scenario: Tool calls and turns are recorded
    Given a solo voice session started for "maya@example.com"
    When the tutor calls "tutor_present_problem" with the problem "5 pencils cost $2.50. What does one cost?" and the answer "0.50"
    And the learner says "Is it 2.50?"
    And the tutor records the attempt "2.50"
    And the tutor notes the misconception "Divided in the wrong direction"
    Then the session has 3 tool calls
    And the session has 1 learner turn

  Scenario: Ending a session writes a summary and marks the lesson
    Given a solo voice session started for "maya@example.com"
    And the tutor presented the problem "5 pencils cost $2.50. What does one cost?" with the answer "0.50"
    And the tutor recorded the attempt "0.50"
    And the tutor noted the misconception "Divided in the wrong direction"
    When the tutor calls "tutor_end_session"
    Then the session is "ended"
    And the summary lists the misconception "Divided in the wrong direction"
    And the summary says 1 problem was solved
    And the lesson "Unit rates" is marked completed for "maya@example.com"

  Scenario: The tutor adds a flashcard during a session
    Given a solo voice session started for "maya@example.com"
    When the tutor calls "tutor_add_flashcard" with the front "unit rate" and the back "a rate with 1 on the bottom"
    Then the learner's deck for "Unit rates" has 1 card

  Scenario: Only the learner or a participant may act on a session
    Given a solo voice session started for "maya@example.com"
    When "stranger@example.com" tries to end the session
    Then the change fails with FORBIDDEN
