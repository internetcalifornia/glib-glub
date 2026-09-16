Feature: A learner's bio
  A learner describes themselves — interests, how they like to learn, the
  language they prefer — so the tutor can meet them where they are. A
  guardian writes it for a learner too young to manage their own profile.

  Scenario: A learner writes their own bio
    Given "maya@example.com" is a learner with the age band "adult"
    When "maya@example.com" sets their bio to "I loved geometry in school but fractions still scare me" with learning styles "visual, hands-on"
    Then the bio of "maya@example.com" says "I loved geometry in school but fractions still scare me"
    And the learning styles of "maya@example.com" are "visual, hands-on"

  Scenario: A young learner's guardian writes the bio
    Given "kid@example.com" is a learner with the age band "6-8"
    And "parent@example.com" is an accepted guardian of "kid@example.com"
    When "parent@example.com" sets the bio of "kid@example.com" to "Loves dinosaurs, reads above grade level, gets frustrated by long word problems"
    Then the bio of "kid@example.com" says "Loves dinosaurs, reads above grade level, gets frustrated by long word problems"

  Scenario: A young learner cannot write their own bio
    Given "kid@example.com" is a learner with the age band "6-8"
    When "kid@example.com" sets their bio to "I am secretly forty"
    Then the change fails with FORBIDDEN

  Scenario: A stranger cannot write someone else's bio
    Given "maya@example.com" is a learner with the age band "adult"
    And "sam@example.com" is a learner with the age band "adult"
    When "sam@example.com" sets the bio of "maya@example.com" to "nope"
    Then the change fails with FORBIDDEN
