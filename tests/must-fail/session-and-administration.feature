@must-fail @session
Feature: Assertions of the session and the administration that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read: the site is left as
  it was.

  Scenario: A login that worked is not a refused one
    Fails with: The login was not refused
    Given I am not logged in
    When I log in with the username "marketer" and the password "dD.123123ddd"
    Then the login should be refused with "Invalid login"

  Scenario: A refusal says what it says, not another text
    Fails with: The login page did not refuse the login with "Your account is locked."
    Given I am not logged in
    When I log in with the username "administrator@example.com" and the password "Not-the-password-2"
    Then the login should be refused with "Your account is locked."

  Scenario: The marketer is not the sales account
    Fails with: "marketer" is logged in, not "sales"
    Given I am a logged in user with the "marketer" user
    Then I should be logged in as "sales"

  Scenario: An account that is logged in is not logged out
    Fails with: "marketer" is logged in.
    Given I am a logged in user with the "marketer" user
    Then I should not be logged in

  Scenario: Nobody is logged in to a visitor's browser
    Fails with: Nobody is logged in
    Given I am not logged in
    Then I should be logged in

  Scenario: The dashboard is not the login page
    Fails with: The page is not the login page
    Given I am a logged in user with the "marketer" user
    Then I should be on the login page

  Scenario: An account not in the users registry
    Fails with: The user "nobody" is not in the users registry
    Given I am a logged in user with the "nobody" user

  Scenario: A marketer may open the contacts
    Fails with: The site let this browser open /s/contacts
    Given I am a logged in user with the "marketer" user
    Then I should not be allowed to open "/s/contacts"

  Scenario: The main menu of a marketer offers the contacts
    Fails with: The main menu offers "Contacts"
    Given I am a logged in user with the "marketer" user
    Then the main menu should not offer "Contacts"

  Scenario: The settings menu of a marketer has no users
    Fails with: The settings menu does not offer "Users"
    Given I am a logged in user with the "marketer" user
    Then the settings menu should offer "Users"

  Scenario: The main menu has no item of another name
    Fails with: The main menu has no "Newsletters"
    Given I am a logged in user with the "marketer" user
    When I go to "Newsletters" in the main menu

  Scenario: The heading of the dashboard is not the contacts'
    Fails with: The page heading is "Dashboard", not "Contacts"
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    Then the page heading should be "Contacts"

  Scenario: The site says nothing it was not asked to
    Fails with: The site did not say "has been deleted!"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the site should say "has been deleted!"

  Scenario: No dialog opens by itself
    Fails with: No dialog opened titled "Quick Add"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the dialog "Quick Add" should be open

  Scenario: The site asks nothing before a list is shown
    Fails with: The site asked for no confirmation
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I answer the confirmation with "Delete"

  Scenario: The search of everything does not find what is not there
    Fails with: The search results do not list "Nobody, Here"
    Given I am a logged in user with the "marketer" user
    When I search everything for "Haddad"
    Then the search results should list "Nobody, Here"

  Scenario: An account that is not in the users registry does not log in
    Fails with: The user "nobody" is not in the users registry
    Given I am not logged in
    When I log in as "nobody" with the login form

  Scenario: Nobody logs out of a visitor's browser
    Fails with: Nobody is logged in
    Given I am not logged in
    When I log out

  Scenario: The login page is not the form of a reset link
    Fails with: The page is not the form of a reset link
    Given I am not logged in
    When I set the password of "sales" on the reset page

  Scenario: The login page is not the form of a reset link, with a confirmation either
    Fails with: The page is not the form of a reset link
    Given I am not logged in
    When I set the password of "sales" on the reset page with the confirmation "Something-else-1"

  Scenario: The site asks nothing before a list is shown, so it asks no question
    Fails with: The site asks nothing
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    Then the site should ask "Delete this contact?"

  Scenario: A dialog that is open is not closed
    Fails with: The dialog "Quick Add" is still open
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I click "Quick Add"
    Then the dialog "Quick Add" should be open
    And no dialog should be open

  Scenario: There is no dialog to press a button in
    Fails with: No dialog opened
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I press "Save" in the dialog

  Scenario: A visitor has no search of everything
    Fails with: Nobody is logged in: the site shows its login page
    Given I am not logged in
    When I search everything for "Haddad"
