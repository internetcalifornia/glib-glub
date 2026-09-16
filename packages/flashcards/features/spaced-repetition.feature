Feature: Flashcards with spaced repetition
  A learner's deck schedules each card by how well they remembered it last
  time. A new card is due now; a card recalled easily comes back later; a
  card forgotten comes back tomorrow.

  Background:
    Given "maya@example.com" is a learner with a deck "Fractions"
    And the deck has the cards "1/2 as a decimal=0.5; 3/4 as a percent=75%; 1/3 as a decimal=0.333"

  Scenario: New cards are all due
    When the due cards are computed on "2026-09-16"
    Then 3 cards are due

  Scenario Outline: A card recalled well is scheduled further out each time
    Given "1/2 as a decimal" was reviewed with quality 5 on the days "<days>"
    Then "1/2 as a decimal" is next due on "<due>"

    Examples:
      | days                             | due        |
      | 2026-09-16                       | 2026-09-17 |
      | 2026-09-16, 2026-09-17           | 2026-09-23 |
      | 2026-09-16, 2026-09-17, 2026-09-23 | 2026-10-10 |

  Scenario: A forgotten card starts over
    Given "3/4 as a percent" was reviewed with quality 5 on the days "2026-09-16, 2026-09-17"
    When "3/4 as a percent" is reviewed with quality 1 on "2026-09-23"
    Then "3/4 as a percent" is next due on "2026-09-24"
    And "3/4 as a percent" has 0 successful repetitions

  Scenario: Only due cards are offered
    Given "1/2 as a decimal" was reviewed with quality 5 on the days "2026-09-16"
    When the due cards are computed on "2026-09-16"
    Then 2 cards are due
    And "1/2 as a decimal" is not among them

  Scenario: The tutor adds a card from a session
    When the tutor adds the card "5/10 simplified" with the back "1/2" to the deck "Fractions"
    Then the deck has 4 cards
    And "5/10 simplified" is due now
