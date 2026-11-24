@contacts
Feature: Contacts
  As a marketer
  I want to find, add, change and remove contacts, and read what the site knows of each
  So that every person we talk to is one record with their points, tags, segments and company

  # The build of the site makes five contacts (Lina Haddad, Omar Saleh, Maya Nasser, Karim Aziz, Sara Khalil), with
  # their owners, points, tags, stages and company. A scenario that adds a contact removes it.

  @critical
  Scenario: A contact's page shows what the site knows of the person
    Given I am a logged in user with the "marketer" user
    Then the contact "Lina Haddad" should have 25 points
    And the contact "Lina Haddad" should have the tag "newsletter"
    And the contact "Lina Haddad" should be at the company "Example Trading"
    And the "Contact owner" of the contact "Lina Haddad" should be "Sales Test"
    And the "Email" of the contact "Lina Haddad" should be "lina.haddad@example.com"
    And the "Address" of the contact "Lina Haddad" should be "Amman"

  Scenario: A contact is in the segments its filters match
    Given I am a logged in user with the "marketer" user
    Then the contact "Lina Haddad" should be in the segment "Newsletter readers"
    And the contact "Lina Haddad" should be in the segment "Amman contacts"
    And the contact "Omar Saleh" should be in the segment "Newsletter readers"
    But the contact "Omar Saleh" should not be in the segment "Amman contacts"
    And the contact "Sara Khalil" should not be in the segment "Newsletter readers"

  Scenario: A new contact, with a tag, then removed
    Given there is no contact "Webship test contact"
    And there is no tag "webship-test-tag"
    And I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "New"
    Then the page heading should be "New Contact"
    When I set the following fields:
      | First Name | Webship test               |
      | Last Name  | contact                    |
      | Email      | webship-test-contact@example.com |
      | City       | Madaba                     |
      | Stage      | Lead                       |
    And I add "webship-test-tag" to "Tags"
    And I save and close the form
    Then the site should say "Webship test contact has been created!"
    And the page heading should be "Webship test contact"
    And the contact "Webship test contact" should have the tag "webship-test-tag"
    And the "Address" of the contact "webship-test-contact@example.com" should be "Madaba"
    When I open the list of contacts
    And I search the list for "Webship test"
    And I choose "Delete" in the options of "Webship test contact"
    Then the site should ask "Delete this contact?"
    When I answer the confirmation with "Delete"
    Then the site should say "Webship test contact has been deleted!"
    And the list should not show "Webship test contact"
    And there is no tag "webship-test-tag"

  Scenario: An address that is not one is refused by the quick add
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "Quick Add"
    Then the dialog "Quick Add" should be open
    When I set "First Name" to "Webship test"
    And I set "Email" to "not-an-email"
    And I press "Save" in the dialog
    Then the dialog "Quick Add" should be open
    And the field "Email" should show the error "is invalid."
    When I press "Cancel" in the dialog
    Then no dialog should be open

  Scenario: A contact's details are changed and put back
    Given I am a logged in user with the "marketer" user
    When I open the contact "Maya Nasser"
    And I click "Edit"
    And I set "City" to "Salt"
    And I save and close the form
    Then the site should say "Maya Nasser has been updated!"
    And the "Address" of the contact "Maya Nasser" should be "Salt"
    When I open the contact "Maya Nasser"
    And I click "Edit"
    And I set "City" to "Amman"
    And I save and close the form
    Then the "Address" of the contact "Maya Nasser" should be "Amman"

  Scenario: A note on a contact
    Given the contact "Omar Saleh" has no note "Webship test"
    And I am a logged in user with the "marketer" user
    When I add the note "Webship test: sent the brochure" to the contact "Omar Saleh"
    Then the site should say "Note created successfully"
    And the notes of the contact "Omar Saleh" should list "Webship test: sent the brochure"
    Given the contact "Omar Saleh" has no note "Webship test"
    Then the notes of the contact "Omar Saleh" should not list "Webship test: sent the brochure"

  Scenario: A tag taken off a contact
    Given the contact "Karim Aziz" has no tag "webship-test-tag"
    And I am a logged in user with the "marketer" user
    When I open the contact "Karim Aziz"
    And I click "Edit"
    And I add "webship-test-tag" to "Tags"
    And I save and close the form
    Then the contact "Karim Aziz" should have the tag "webship-test-tag"
    When I remove the tag "webship-test-tag" from the contact "Karim Aziz"
    Then the contact "Karim Aziz" should not have the tag "webship-test-tag"
    And there is no tag "webship-test-tag"
