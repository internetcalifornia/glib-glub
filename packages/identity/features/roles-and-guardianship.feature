Feature: Roles and guardianship
  Every account holds one or more roles. A guardian is linked to a learner
  through an invitation the learner (or the learner's existing guardian)
  accepts; once accepted the guardian can set objectives and sit in on
  sessions.

  Scenario: A new account is a learner by default
    When "sam@example.com" signs up with the password "correct horse battery"
    Then "sam@example.com" has the role "learner"
    And "sam@example.com" does not have the role "educator"

  Scenario: An admin grants the educator role
    Given "sam@example.com" signed up with the password "correct horse battery"
    And "admin@example.com" is an admin
    When "admin@example.com" grants "sam@example.com" the role "educator"
    Then "sam@example.com" has the role "educator"

  Scenario: A learner cannot grant roles
    Given "sam@example.com" signed up with the password "correct horse battery"
    And "kim@example.com" signed up with the password "correct horse battery"
    When "sam@example.com" grants "kim@example.com" the role "educator"
    Then granting fails with FORBIDDEN

  Scenario: A guardian invites a learner and the learner accepts
    Given "parent@example.com" signed up with the password "correct horse battery"
    And "kid@example.com" signed up with the password "correct horse battery"
    When "parent@example.com" invites "kid@example.com" as their learner
    Then the guardianship between "parent@example.com" and "kid@example.com" is "invited"
    When "kid@example.com" accepts the guardianship from "parent@example.com"
    Then the guardianship between "parent@example.com" and "kid@example.com" is "accepted"
    And "parent@example.com" has the role "guardian"
    And "parent@example.com" is a guardian of "kid@example.com"

  Scenario: An unaccepted invitation grants nothing
    Given "parent@example.com" signed up with the password "correct horse battery"
    And "kid@example.com" signed up with the password "correct horse battery"
    And "parent@example.com" invited "kid@example.com" as their learner
    Then "parent@example.com" is not a guardian of "kid@example.com"
