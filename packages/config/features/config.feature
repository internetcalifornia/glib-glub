Feature: Validated configuration
  Every process reads its environment exactly once, at startup, through a
  schema. A missing or malformed variable is reported by name before anything
  else runs, instead of surfacing later as an opaque connection error.

  Scenario: A complete environment loads
    Given the environment sets DATABASE_URL to "postgres://u:p@localhost:5432/db"
    When the database configuration is loaded
    Then loading succeeds
    And the database URL is "postgres://u:p@localhost:5432/db"

  Scenario: A missing required variable is named in the failure
    Given the environment does not set DATABASE_URL
    When the database configuration is loaded
    Then loading fails with INVALID_ENV
    And the failure message mentions "DATABASE_URL"

  Scenario: A malformed variable is named in the failure
    Given the environment sets APP_ORIGIN to "not a url"
    And the environment sets AUTH_SECRET to "0123456789abcdef0123456789abcdef"
    When the web configuration is loaded
    Then loading fails with INVALID_ENV
    And the failure message mentions "APP_ORIGIN"

  Scenario: Optional providers are disabled when their credentials are absent
    Given the environment sets APP_ORIGIN to "http://localhost:3000"
    And the environment sets AUTH_SECRET to "0123456789abcdef0123456789abcdef"
    And the environment does not set GOOGLE_CLIENT_ID
    When the web configuration is loaded
    Then loading succeeds
    And the google provider is disabled

  Scenario: The fake Voice Live flag turns on the in-process server
    Given the environment sets VOICE_LIVE_FAKE to "1"
    When the voice gateway configuration is loaded
    Then loading succeeds
    And the gateway uses the fake Voice Live server
