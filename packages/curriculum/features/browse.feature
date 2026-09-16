Feature: Finding a track
  Learners browse categories and subjects to find a published track that
  fits their level. Drafts are invisible to everyone but their author.

  Background:
    Given the category "Mathematics" with the subject "Grade 6 Mathematics"
    And the category "Languages" with the subject "Japanese"

  Scenario: Categories and their subjects are listed
    When the categories are listed
    Then the list contains "Mathematics" with the subject "Grade 6 Mathematics"
    And the list contains "Languages" with the subject "Japanese"

  Scenario: Only published tracks appear in a subject
    Given the educator "ed@example.com" has a published track "Ratios and Rates" in "Grade 6 Mathematics"
    And the educator "ed@example.com" has a draft track "Unfinished Algebra" in "Grade 6 Mathematics"
    When the learner "maya@example.com" browses "Grade 6 Mathematics"
    Then she sees the track "Ratios and Rates"
    And she does not see the track "Unfinished Algebra"

  Scenario: An author sees their own draft
    Given the educator "ed@example.com" has a draft track "Unfinished Algebra" in "Grade 6 Mathematics"
    When the educator "ed@example.com" browses "Grade 6 Mathematics"
    Then she sees the track "Unfinished Algebra"
