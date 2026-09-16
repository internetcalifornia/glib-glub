Feature: Telling speakers apart
  In a session with a parent or an educator, the transcription labels
  speakers; the platform maps those labels to the people who declared
  themselves at the start.

  Scenario: Speakers are mapped by their calibration phrase
    Given a session with the participants "Maya (learner), Maya's dad (guardian)"
    When "speaker_0" says "Hi, I'm Maya"
    And "speaker_1" replies "I am Maya's dad"
    Then "speaker_0" is "Maya"
    And "speaker_1" is recognised as "Maya's dad"

  Scenario: An unmapped speaker is recorded as unknown, never guessed
    Given a session with the participants "Maya (learner), Maya's dad (guardian)"
    When "speaker_2" says "What is a ratio?"
    Then the turn is attributed to "unknown"

  Scenario: A solo session attributes everything to the learner
    Given a session with the participants "Maya (learner)"
    When "speaker_0" says "What is a ratio?"
    Then the turn is attributed to "Maya"
