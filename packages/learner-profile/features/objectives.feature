Feature: Learning objectives
  Learners — or their guardians — say what they want to get out of the
  coming weeks. Objectives steer which lessons the tutor reaches for and
  are part of every session's context.

  Scenario: An adult learner sets their own objective
    Given "maya@example.com" is a learner with the age band "adult"
    When "maya@example.com" adds the objective "Be comfortable adding fractions with unlike denominators" for themselves
    Then "maya@example.com" has 1 active objective
    And that objective was set by "maya@example.com"

  Scenario: A guardian sets an objective for a young learner
    Given "kid@example.com" is a learner with the age band "6-8"
    And "parent@example.com" is an accepted guardian of "kid@example.com"
    When "parent@example.com" adds the objective "Explain reasoning out loud" for "kid@example.com"
    Then "kid@example.com" has 1 active objective
    And that objective was set by "parent@example.com"

  Scenario: A young learner cannot set their own objective
    Given "kid@example.com" is a learner with the age band "6-8"
    When "kid@example.com" adds the objective "No homework ever" for themselves
    Then the change fails with FORBIDDEN

  Scenario: Achieving an objective moves it out of the active list
    Given "maya@example.com" is a learner with the age band "adult"
    And "maya@example.com" has the objective "Add fractions"
    When "maya@example.com" marks the objective "Add fractions" as achieved
    Then "maya@example.com" has 0 active objectives
    And "maya@example.com" has 1 achieved objective

  Scenario: There is a limit on active objectives
    Given "maya@example.com" is a learner with the age band "adult"
    And "maya@example.com" has 8 active objectives
    When "maya@example.com" adds the objective "One more" for themselves
    Then the change fails with TOO_MANY_OBJECTIVES
