Feature: Age bands keep younger learners safe
  Each learner has an age band: k-5, 6-8, 9-12, university, or adult. The
  band is set by the learner (if an adult) or a guardian, and it decides
  which logins a learner may link and who may change their objectives.

  Scenario Outline: The age band decides who may manage objectives
    Given "kid@example.com" signed up with the password "correct horse battery"
    And "kid@example.com" has the age band "<band>"
    Then "kid@example.com" <may> manage their own objectives

    Examples:
      | band       | may     |
      | k-5        | may not |
      | 6-8        | may not |
      | 9-12       | may     |
      | university | may     |
      | adult      | may     |

  Scenario: A young learner cannot link Facebook themselves
    Given "kid@example.com" signed up with the password "correct horse battery"
    And "kid@example.com" has the age band "6-8"
    And "kid@example.com" is signed in
    When she links a "facebook" login with provider account "fb-77"
    Then linking fails with PROVIDER_NOT_ALLOWED_FOR_AGE
    And "kid@example.com" has exactly 1 linked login

  Scenario: A guardian may link Facebook for a young learner
    Given "kid@example.com" signed up with the password "correct horse battery"
    And "kid@example.com" has the age band "6-8"
    And "parent@example.com" is an accepted guardian of "kid@example.com"
    When "parent@example.com" links a "facebook" login with provider account "fb-77" for "kid@example.com"
    Then "kid@example.com" has exactly 2 linked logins

  Scenario: An adult learner may link Facebook
    Given "maya@example.com" signed up with the password "correct horse battery"
    And "maya@example.com" has the age band "adult"
    And "maya@example.com" is signed in
    When she links a "facebook" login with provider account "fb-77"
    Then "maya@example.com" has exactly 2 linked logins
