Feature: A self-directed track from a learner's own material
  A learner without an educator can have a track built from what they
  already uploaded and what they said they want. The track belongs to
  them, starts as a draft, and is published to them alone.

  Scenario: A track is generated from the snapshot
    Given the category "Languages" with the subject "Japanese"
    And "maya@example.com" is a learner whose snapshot says "Studied Japanese for a year; knows hiragana; wants to hold a basic conversation"
    And the model proposes a track "Conversational Japanese refresher" with the units "Greetings, Ordering food"
    When a self-directed track is generated for "maya@example.com" in "Japanese"
    Then the track "Conversational Japanese refresher" exists with the visibility "draft"
    And the track "Conversational Japanese refresher" was authored by "maya@example.com"
    And the track "Conversational Japanese refresher" has the origin "self_directed"
    And the track "Conversational Japanese refresher" has the units "Greetings, Ordering food"

  Scenario: A self-directed track publishes only to its learner
    Given the category "Languages" with the subject "Japanese"
    And "maya@example.com" is a learner whose snapshot says "wants basic Japanese"
    And "sam@example.com" is a learner
    And the model proposes a track "Basics" with the units "Greetings"
    And a self-directed track was generated for "maya@example.com" in "Japanese"
    When "maya@example.com" publishes the track "Basics"
    Then "maya@example.com" is enrolled in "Basics"
    And the learner "sam@example.com" does not see the track "Basics" in "Japanese"
