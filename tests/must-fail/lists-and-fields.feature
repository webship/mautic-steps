@must-fail @lists
Feature: Assertions of the lists and the fields that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read, or leave a form
  unsaved: the site is left as it was.

  Scenario: The list does not show a contact that is not there
    Fails with: The list does not show "Nobody Here"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the list should show "Nobody Here"

  Scenario: The list shows a contact that is there
    Fails with: The list shows "Lina Haddad"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the list should not show "Lina Haddad"

  Scenario: A search for one contact does not count two
    Fails with: The list says it has 1 item(s), not 2
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I search the list for "Haddad"
    Then the list should have 2 items

  Scenario: The row of a contact does not show another's city
    Fails with: The row of "Lina Haddad" does not show "Irbid"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the row of "Lina Haddad" should show "Irbid"

  Scenario: The contacts sorted by their points do not start with the fewest
    Fails with: The list does not start with "Sara Khalil"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I search the list for "example.com"
    And I sort the list by "Points" in descending order
    Then the list should start with "Sara Khalil"

  Scenario: The options of a row have no action of another name
    Fails with: The options of "Lina Haddad" have no "Archive"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I choose "Archive" in the options of "Lina Haddad"

  Scenario: There is no list of another name
    Fails with: There is no list "newsletters"
    Given I am a logged in user with the "marketer" user
    When I open the list of newsletters

  Scenario: A form has no field of another label
    Fails with: No field labelled "Favourite colour"
    Given I am a logged in user with the "marketer" user
    When I open the contact "Lina Haddad"
    And I click "Edit"
    And I set "Favourite colour" to "Blue"

  Scenario: A field holds what it holds
    Fails with: "City" is set to "Amman", not "Irbid"
    Given I am a logged in user with the "marketer" user
    When I open the contact "Lina Haddad"
    And I click "Edit"
    Then "City" should be set to "Irbid"

  Scenario: A list of a form has no option of another name
    Fails with: The list "Stage" has no option "Partner"
    Given I am a logged in user with the "marketer" user
    When I open the contact "Lina Haddad"
    And I click "Edit"
    And I set "Stage" to "Partner"

  Scenario: A segment has no filter of another name
    Fails with: The filters of "Contact" have no "Favourite colour"
    Given I am a logged in user with the "marketer" user
    When I open the list of segments
    And I click "New"
    And I add the filter "Favourite colour" is equal to "Blue"

  Scenario: The campaign builder is not open on a list
    Fails with: The campaign builder is not open
    Given I am a logged in user with the "marketer" user
    When I open the list of campaigns
    And I add the segment "Newsletter readers" as the source of the campaign

  Scenario: The list has no row of another name to open
    Fails with: The list shows no row with "Nobody Here"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I open "Nobody Here" from the list

  Scenario: The list has no column of another name to sort by
    Fails with: The list cannot be sorted by "Favourite colour"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I sort the list by "Favourite colour"

  Scenario: The dashboard is not a list to search
    Fails with: The page has no list search
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    And I search the list for "Haddad"

  Scenario: A form has no field of another name among several
    Fails with: No field labelled "Favourite colour"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "New"
    And I set the following fields:
      | First Name        | Webship test |
      | Favourite colour  | Blue         |

  Scenario: A form has no field of several values of another name
    Fails with: No field labelled "Favourite colours"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "New"
    And I add "webship-test-tag" to "Favourite colours"

  Scenario: A field that was not sent shows no error
    Fails with: The field "Email" shows no error, not "is invalid."
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "New"
    Then the field "Email" should show the error "is invalid."

  Scenario: A form has no tab of another name
    Fails with: No tab "Favourites"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "New"
    And I open the "Favourites" tab

  Scenario: The dashboard has no form to save
    Fails with: The page has no "Save" button
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    And I save the form

  Scenario: The dashboard has no form to save and close
    Fails with: The page has no "Save & Close" button
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    And I save and close the form

  Scenario: The dashboard has no form to cancel
    Fails with: The page has no "Cancel" button
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    And I cancel the form
