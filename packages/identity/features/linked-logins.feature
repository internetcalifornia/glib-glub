Feature: One account, many logins
  A person may reach the same account through Google, Microsoft, Facebook, a
  password, or a passkey. Logins are linked to the account, listed, and
  unlinked — but never the last one, which would lock the person out.

  Background:
    Given "maya@example.com" signed up with the password "correct horse battery"

  Scenario: A social login links to the signed-in account
    Given "maya@example.com" is signed in
    When she links a "google" login with provider account "g-123"
    Then "maya@example.com" has exactly 2 linked logins
    And one of them is "google" account "g-123"

  Scenario: A second social login links too
    Given "maya@example.com" is signed in
    And she linked a "google" login with provider account "g-123"
    When she links a "microsoft" login with provider account "ms-456"
    Then "maya@example.com" has exactly 3 linked logins

  Scenario: Unlinking a login keeps the account
    Given "maya@example.com" is signed in
    And she linked a "google" login with provider account "g-123"
    When she unlinks the "google" login
    Then "maya@example.com" has exactly 1 linked login
    And an account exists for "maya@example.com"

  Scenario: The last login cannot be unlinked
    Given "maya@example.com" is signed in
    When she unlinks the "credential" login
    Then unlinking fails with LAST_LOGIN
    And "maya@example.com" has exactly 1 linked login

  Scenario: A social sign-in with a trusted provider and a matching email joins the existing account
    When "maya@example.com" signs in through "google" as provider account "g-999"
    Then "maya@example.com" has exactly 2 linked logins
    And there is only one account for "maya@example.com"

  Scenario: A social sign-in with an untrusted provider does not silently join an account
    When "maya@example.com" signs in through "facebook" as provider account "fb-1"
    Then sign-in fails with LINK_REQUIRES_SESSION
    And "maya@example.com" has exactly 1 linked login
