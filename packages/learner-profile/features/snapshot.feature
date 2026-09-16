Feature: The personalisation snapshot
  Everything the tutor should know about a learner, distilled into one
  versioned document: the bio, the active objectives, what the uploads
  showed, and the latest level estimate. Rebuilding from unchanged inputs
  gives the same version, so "nothing new" is detectable.

  Background:
    Given "maya@example.com" is a learner with the age band "adult"

  Scenario: The snapshot gathers bio, objectives and upload summaries
    Given "maya@example.com" has the bio "I loved geometry but fractions scare me" with learning styles "visual"
    And "maya@example.com" has the objective "Add fractions"
    And "maya@example.com" uploaded "test.txt" containing "fractions test: mixed results on unlike denominators"
    When the snapshot of "maya@example.com" is rebuilt
    Then the snapshot mentions "fractions scare me"
    And the snapshot lists the objective "Add fractions"
    And the snapshot includes 1 upload summary
    And the snapshot version is 1

  Scenario: Rebuilding from unchanged inputs keeps the version
    Given "maya@example.com" has the bio "I loved geometry" with learning styles "visual"
    And the snapshot of "maya@example.com" was rebuilt
    When the snapshot of "maya@example.com" is rebuilt
    Then the snapshot version is 1

  Scenario: A changed input bumps the version
    Given "maya@example.com" has the bio "I loved geometry" with learning styles "visual"
    And the snapshot of "maya@example.com" was rebuilt
    When "maya@example.com" adds the objective "Ratios" for themselves
    And the snapshot of "maya@example.com" is rebuilt
    Then the snapshot version is 2

  Scenario: The snapshot never carries raw upload text
    Given "maya@example.com" uploaded "essay.txt" containing "RAW-ESSAY-TEXT about volcanoes"
    When the snapshot of "maya@example.com" is rebuilt
    Then the snapshot does not mention "RAW-ESSAY-TEXT"
