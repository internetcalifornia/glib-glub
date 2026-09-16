Feature: What the tutor is told before it speaks
  A session starts from everything the platform knows: the learner's
  snapshot, the lesson that is due, the track's pedagogy, the last
  session's summary, and who is in the room. The instructions carry all
  of it — and never the raw lesson text as something to read aloud.

  Background:
    Given a learner "maya@example.com" in the age band "6-8" with the snapshot "Loves dinosaurs; visual learner; objective: explain reasoning out loud"
    And a track "Grade 6 Mathematics" with the pedagogy "Never state the answer before two attempts" whose next due lesson is "Unit rates" with the notes "Use price per pencil. Expect dividing the wrong way."

  Scenario: A first solo voice session
    When a solo voice session starts for "maya@example.com"
    Then the instructions mention the lesson "Unit rates"
    And the instructions mention the lesson notes "price per pencil"
    And the instructions mention the pedagogy "Never state the answer before two attempts"
    And the instructions mention the snapshot "dinosaurs" and "explain reasoning out loud"
    And the instructions say the learner is in the age band "6-8"
    And the instructions forbid reading the notes aloud

  Scenario: The previous session's summary is carried forward
    Given the last session for "maya@example.com" was summarised as "Covered unit rates; struggled with dividing in the right direction"
    When a solo voice session starts for "maya@example.com"
    Then the instructions mention the last summary "struggled with dividing in the right direction"

  Scenario: A guardian in the room changes the rules
    When a voice session with the guardian "Maya's dad" starts for "maya@example.com"
    Then the instructions name the participant "Maya's dad" as a "guardian"
    And the instructions say the learner, not the guardian, is being taught
    And the transcription is set to tell speakers apart

  Scenario: An educator in the room makes the tutor an aide
    When a voice session with the educator "Ms Lee" starts for "maya@example.com"
    Then the instructions name the participant "Ms Lee" as an "educator"
    And the instructions tell the tutor to act as a teaching aide

  Scenario: The voice matches the learner and the track
    When a solo voice session starts for "maya@example.com"
    Then the voice speaks at a rate of 0.9
    And turn detection is "azure_semantic_vad"

  Scenario: A Japanese track uses a Japanese voice and multilingual turn detection
    Given a track "Japanese: first steps" in the language "ja" whose next due lesson is "Vowels and the k row" with the notes "Pure vowels."
    When a solo voice session starts for "maya@example.com" on "Japanese: first steps"
    Then the voice is a "ja-JP" voice
    And turn detection is "azure_semantic_vad_multilingual"
