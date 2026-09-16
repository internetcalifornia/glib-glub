Feature: Username and password login
  A learner or guardian can create an account with an email address and a
  password, and sign in with them later. Passwords are never stored in the
  clear, and a wrong password is refused without saying which half was wrong.

  Scenario: Signing up with a password creates one account
    When "maya@example.com" signs up with the password "correct horse battery"
    Then an account exists for "maya@example.com"
    And "maya@example.com" has exactly 1 linked login
    And that login is a credential login

  Scenario: Signing in with the right password starts a session
    Given "maya@example.com" signed up with the password "correct horse battery"
    When "maya@example.com" signs in with the password "correct horse battery"
    Then a session exists for "maya@example.com"

  Scenario: A wrong password is refused without a session
    Given "maya@example.com" signed up with the password "correct horse battery"
    When "maya@example.com" signs in with the password "wrong"
    Then sign-in fails with INVALID_CREDENTIALS
    And no session exists for "maya@example.com"

  Scenario: Signing up twice with the same email is refused
    Given "maya@example.com" signed up with the password "correct horse battery"
    When "maya@example.com" signs up with the password "another one"
    Then sign-up fails with EMAIL_TAKEN
