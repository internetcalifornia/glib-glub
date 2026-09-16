Feature: A tutoring session through the voice gateway
  The browser proves who it is with a ticket from the web app, the gateway
  starts the session, negotiates the call with the voice service, records
  what everyone says, runs the tutor's tool calls against the platform,
  and closes the session out with a summary — whoever leaves first.

  Background:
    Given a learner "maya@example.com" whose next lesson on "Grade 6 Mathematics" is "Unit rates"

  Scenario: Starting a session with a valid ticket
    When the browser starts a voice session with a valid ticket
    Then the browser is told the session started on "Unit rates"
    And the gateway is "starting"

  Scenario: Negotiating the call
    Given the browser started a voice session with a valid ticket
    When the browser sends the SDP offer "v=0 offer"
    Then the voice service receives "rtc.call.sdp.create" carrying the tutor's instructions
    And the browser receives the SDP answer
    And the gateway is "live"

  Scenario: A ticket signed with another secret is refused
    When the browser starts a voice session with a forged ticket
    Then the browser receives the fatal error "INVALID_TICKET"
    And the gateway is "failed"

  Scenario: What the learner says is recorded and shown
    Given a live voice session
    When the voice service transcribes "Is it 2.50?" from "speaker_0"
    Then the transcript shows the "learner" saying "Is it 2.50?"
    And the session has 1 recorded turn

  Scenario: What the tutor says is recorded too
    Given a live voice session
    When the voice service speaks "What does each number count?"
    Then the transcript shows the "tutor" saying "What does each number count?"

  Scenario: The tutor's tool calls run against the platform
    Given a live voice session
    When the voice service calls "tutor_present_problem" with the problem "5 pencils cost $2.50" and the answer "0.50"
    And the voice service calls "tutor_record_attempt" with the attempt "2.50"
    Then the voice service receives a function output whose next move is "clarify"
    And the browser sees the tool "tutor_record_attempt"

  Scenario: Ending the session writes a summary
    Given a live voice session
    When the browser ends the session
    Then the browser receives the summary
    And the gateway is "ended"
    And the session is "ended"

  Scenario: The tutor can end the session itself
    Given a live voice session
    When the voice service calls "tutor_end_session"
    Then the browser receives the summary
    And the gateway is "ended"

  Scenario: A text session needs no call
    When the browser starts a text session with a valid ticket
    Then the voice service receives "session.update" with text only
    And the gateway is "live"
    When the browser types "What is a unit rate?"
    Then the voice service receives the user text "What is a unit rate?"
    And the transcript shows the "learner" saying "What is a unit rate?"

  Scenario: The voice service dropping fails the session
    Given a live voice session
    When the voice service closes
    Then the browser receives the fatal error "VOICE_LIVE_CLOSED"
    And the session is "failed"

  Scenario: The browser leaving closes out the session
    Given a live voice session
    When the browser disconnects
    Then the session is "ended"

  Scenario: An offer before a session is refused, not fatal
    When the browser sends the SDP offer "v=0 offer"
    Then the browser receives the error "INVALID_TRANSITION"
    And the gateway is "idle"
