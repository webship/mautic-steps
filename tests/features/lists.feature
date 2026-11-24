@lists
Feature: The lists of the administration
  As a marketer
  I want to search, count and sort the lists
  So that I find the record I need among many

  Scenario: Searching the contacts
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I search the list for "Haddad"
    Then the list should show "Lina Haddad"
    And the list should not show "Omar Saleh"
    And the list should have 1 item
    When I search the list for "nothing-matches-this"
    Then the list should have 0 items
    When I open the list of contacts
    Then the list should show "Omar Saleh"

  Scenario: Sorting the contacts by their points
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I search the list for "example.com"
    And I sort the list by "Points" in descending order
    Then the list should start with "Omar Saleh", "Lina Haddad", "Karim Aziz"
    When I sort the list by "Points" in ascending order
    Then the list should start with "Sara Khalil", "Maya Nasser"

  Scenario: The row of a contact shows its details
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the row of "Lina Haddad" should show "lina.haddad@example.com"
    And the row of "Lina Haddad" should show "Amman"
    And the row of "Omar Saleh" should show "Customer"

  Scenario: The tags list counts their contacts
    Given I am a logged in user with the "marketer" user
    When I open the list of tags
    Then the row of "newsletter" should show "View 2 Contacts"
    And the row of "vip" should show "View 2 Contacts"
