Feature: Enrolling and pacing
  A learner enrolls in a published track and chooses a pace. The plan then
  says what is due, and whether the learner has fallen behind.

  Background:
    Given the category "Mathematics" with the subject "Grade 6 Mathematics"
    And the educator "ed@example.com" has a published track "Ratios and Rates" in "Grade 6 Mathematics" with 2 units of 3 lessons
    And "maya@example.com" is a learner

  Scenario: Enrolling in a published track
    When "maya@example.com" enrolls in "Ratios and Rates" with a "weekly" pace of 2 sessions
    Then "maya@example.com" is enrolled in "Ratios and Rates"
    And her plan for "Ratios and Rates" is "weekly" with 2 sessions per period

  Scenario: A draft cannot be enrolled in
    Given the educator "ed@example.com" has a draft track "Unfinished Algebra" in "Grade 6 Mathematics"
    When "maya@example.com" enrolls in "Unfinished Algebra" with a "daily" pace of 1 sessions
    Then the change fails with TRACK_NOT_PUBLISHED

  Scenario: The first lessons are due at the start
    Given "maya@example.com" enrolled in "Ratios and Rates" with a "weekly" pace of 2 sessions on "2026-09-14"
    When the due lessons are computed on "2026-09-15"
    Then 2 lessons are due
    And the first due lesson is lesson 1 of unit 1
    And she is not behind

  Scenario: Completing lessons advances the plan
    Given "maya@example.com" enrolled in "Ratios and Rates" with a "weekly" pace of 2 sessions on "2026-09-14"
    And she completed 2 lessons of "Ratios and Rates"
    When the due lessons are computed on "2026-09-22"
    Then 2 lessons are due
    And the first due lesson is lesson 3 of unit 1

  Scenario: Missing a period marks the learner behind
    Given "maya@example.com" enrolled in "Ratios and Rates" with a "weekly" pace of 2 sessions on "2026-09-14"
    When the due lessons are computed on "2026-09-29"
    Then she is behind by 4 lessons
