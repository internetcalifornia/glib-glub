Feature: Authoring a track
  Educators build tracks from units and lessons and publish them when they
  are ready. Learners cannot author; a track cannot be published empty.

  Background:
    Given the category "Mathematics" with the subject "Grade 6 Mathematics"

  Scenario: An educator creates a draft track
    Given "ed@example.com" is an educator
    When "ed@example.com" creates the track "Fractions" in "Grade 6 Mathematics"
    Then the track "Fractions" exists with the visibility "draft"
    And the track "Fractions" was authored by "ed@example.com"

  Scenario: A learner cannot create a track
    Given "maya@example.com" is a learner
    When "maya@example.com" creates the track "My Track" in "Grade 6 Mathematics"
    Then the change fails with FORBIDDEN

  Scenario: Units and lessons are added in order
    Given "ed@example.com" is an educator
    And "ed@example.com" created the track "Fractions" in "Grade 6 Mathematics"
    When "ed@example.com" adds the units "Equivalent fractions, Adding fractions" to "Fractions"
    And "ed@example.com" adds the lessons "Same denominators, Unlike denominators" to the unit "Adding fractions" of "Fractions"
    Then the track "Fractions" has the units "Equivalent fractions, Adding fractions"
    And the unit "Adding fractions" of "Fractions" has the lessons "Same denominators, Unlike denominators"

  Scenario: Only the author edits a draft
    Given "ed@example.com" is an educator
    And "other@example.com" is an educator
    And "ed@example.com" created the track "Fractions" in "Grade 6 Mathematics"
    When "other@example.com" adds the unit "Hijack" to "Fractions"
    Then the change fails with FORBIDDEN

  Scenario: An empty track cannot be published
    Given "ed@example.com" is an educator
    And "ed@example.com" created the track "Fractions" in "Grade 6 Mathematics"
    When "ed@example.com" publishes the track "Fractions"
    Then the change fails with TRACK_EMPTY

  Scenario: A track with a lesson publishes
    Given "ed@example.com" is an educator
    And "ed@example.com" created the track "Fractions" in "Grade 6 Mathematics"
    And "ed@example.com" added the unit "Adding fractions" with the lesson "Same denominators" to "Fractions"
    When "ed@example.com" publishes the track "Fractions"
    Then the track "Fractions" exists with the visibility "published"
