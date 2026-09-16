Feature: Uploading prior work
  A learner or guardian uploads essays, tests and notes. The platform keeps
  the file, extracts its text, screens it, and summarises it so the tutor
  can build on what the learner has already done — without ever reading
  the raw file into a prompt.

  Background:
    Given "maya@example.com" is a learner with the age band "adult"

  Scenario: An upload is extracted and summarised
    When "maya@example.com" uploads "fractions-test.pdf" containing "Q1 3/4 + 1/8 = 7/8 correct. Q2 2/3 - 1/6 = 1/3 wrong, wrote 1/2."
    Then the upload "fractions-test.pdf" of "maya@example.com" has the status "extracted"
    And its summary mentions "fractions"
    And its tags include "fractions"
    And the file is stored in the blob store

  Scenario: Unsafe content is rejected and not kept
    When "maya@example.com" uploads "notes.txt" containing "[unsafe content]"
    Then the upload "notes.txt" of "maya@example.com" has the status "rejected"
    And no text is kept for "notes.txt"

  Scenario: A guardian uploads for a young learner
    Given "kid@example.com" is a learner with the age band "6-8"
    And "parent@example.com" is an accepted guardian of "kid@example.com"
    When "parent@example.com" uploads "spelling.txt" for "kid@example.com" containing "Week 3 spelling: 8/10. Missed 'necessary' and 'rhythm'."
    Then the upload "spelling.txt" of "kid@example.com" has the status "extracted"

  Scenario: A stranger cannot upload for someone else
    Given "sam@example.com" is a learner with the age band "adult"
    When "sam@example.com" uploads "x.txt" for "maya@example.com" containing "anything"
    Then the change fails with FORBIDDEN

  Scenario: Deleting an upload removes the file and the text
    Given "maya@example.com" uploaded "old.txt" containing "old notes about decimals"
    When "maya@example.com" deletes the upload "old.txt"
    Then "maya@example.com" has 0 uploads
    And the blob store is empty
