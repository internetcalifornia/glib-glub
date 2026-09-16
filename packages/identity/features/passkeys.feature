Feature: Passkeys
  A signed-in person can register a passkey on their device and use it to
  sign in without a password. A passkey is a login like any other: it is
  listed with the account's logins and cannot be removed if it is the last.

  Scenario: Registering a passkey adds a login
    Given "maya@example.com" signed up with the password "correct horse battery"
    And "maya@example.com" is signed in
    When she registers a passkey named "Phone"
    Then "maya@example.com" has a passkey named "Phone"

  Scenario: A passkey signs in without a password
    Given "maya@example.com" signed up with the password "correct horse battery"
    And "maya@example.com" registered a passkey named "Phone"
    When "maya@example.com" signs in with the passkey "Phone"
    Then a session exists for "maya@example.com"

  Scenario: The passkey list belongs to the signed-in person only
    Given "maya@example.com" signed up with the password "correct horse battery"
    And "sam@example.com" signed up with the password "correct horse battery"
    And "maya@example.com" registered a passkey named "Phone"
    When "sam@example.com" lists their passkeys
    Then the list is empty
