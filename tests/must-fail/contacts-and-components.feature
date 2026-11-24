@must-fail @contacts
Feature: Assertions of the contacts, segments, forms and components that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read: the site is left as
  it was.

  Scenario: A contact has the points it has
    Fails with: The contact "Lina Haddad" has 25 points, not 30
    Given I am a logged in user with the "marketer" user
    Then the contact "Lina Haddad" should have 30 points

  Scenario: A contact without a tag does not have it
    Fails with: The contact "Sara Khalil" does not have the tag "newsletter"
    Given I am a logged in user with the "marketer" user
    Then the contact "Sara Khalil" should have the tag "newsletter"

  Scenario: A contact out of a segment is not in it
    Fails with: The contact "Omar Saleh" is not in the segment "Amman contacts"
    Given I am a logged in user with the "marketer" user
    Then the contact "Omar Saleh" should be in the segment "Amman contacts"

  Scenario: A contact of no company is not at one
    Fails with: The contact "Sara Khalil" is not at the company "Example Trading"
    Given I am a logged in user with the "marketer" user
    Then the contact "Sara Khalil" should be at the company "Example Trading"

  Scenario: A contact's owner is the one it has
    Fails with: The "Contact owner" of the contact "Lina Haddad" is "Sales Test", not "Marketer Test"
    Given I am a logged in user with the "marketer" user
    Then the "Contact owner" of the contact "Lina Haddad" should be "Marketer Test"

  Scenario: A contact's history does not show what did not happen
    Fails with: The history of the contact "Sara Khalil" does not show "Form submitted"
    Given I am a logged in user with the "marketer" user
    Then the history of the contact "Sara Khalil" should show "Form submitted"

  Scenario: A contact's notes do not list a note it does not have
    Fails with: The notes of the contact "Sara Khalil" do not list "Webship test: never written"
    Given I am a logged in user with the "marketer" user
    Then the notes of the contact "Sara Khalil" should list "Webship test: never written"

  Scenario: A segment counts the contacts it has
    Fails with: The segment "Newsletter readers" shows "View 2 Contacts", not 5 contact(s)
    Given I am a logged in user with the "marketer" user
    Then the segment "Newsletter readers" should have 5 contacts

  Scenario: A public form does not say what it does not say
    Fails with: The public form does not say "Welcome aboard!"
    Given I am not logged in
    When I open the public form "Newsletter sign-up"
    And I fill in "First name" with "Webship test"
    And I send the public form
    Then the public form should say "Welcome aboard!"

  Scenario: An asset downloads with its own file name
    Fails with: with the file "product-brochure.txt", not "brochure.pdf"
    Given I am a logged in user with the "marketer" user
    Then the asset "Product brochure" should download as "brochure.pdf"

  Scenario: The login page loads no tracking script
    Fails with: The page does not load the tracking script
    Given I am not logged in
    Then the page should load the tracking script

  Scenario: A report does not list a form that is not there
    Fails with: The report does not list "Webship test: never made" under "Title"
    Given I am a logged in user with the "marketer" user
    When I open the list of reports
    And I open "Submissions of published Forms" from the list
    Then the report should list "Webship test: never made" under "Title"

  Scenario: The dashboard has no widget of another name
    Fails with: The dashboard shows no widget "Revenue"
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    Then the dashboard should show the widget "Revenue"

  Scenario: No mail came that was not sent
    Fails with: No mail "Webship test: never sent" came to sales@example.com
    Given I am a logged in user with the "marketer" user
    Then an email with the subject "Webship test: never sent" should be sent to "sales"

  Scenario: There is no form of another name
    Fails with: There is no form "Webship test: never made"
    Given I am a logged in user with the "marketer" user
    Then there should be a form "Webship test: never made"

  Scenario: There is no contact of another name to open
    Fails with: No contact "Nobody Here" in the list of contacts
    Given I am a logged in user with the "marketer" user
    When I open the contact "Nobody Here"

  Scenario: A note goes to no contact that is not there
    Fails with: No contact "Nobody Here" in the list of contacts
    Given I am a logged in user with the "marketer" user
    When I add the note "Webship test: never written" to the contact "Nobody Here"

  Scenario: A tag the contact does not have is not taken off
    Fails with: The contact "Lina Haddad" has no tag "vip" to remove
    Given I am a logged in user with the "marketer" user
    When I remove the tag "vip" from the contact "Lina Haddad"

  Scenario: An email goes to no contact that is not there
    Fails with: No contact "Nobody Here" in the list of contacts
    Given I am a logged in user with the "marketer" user
    When I send the contact "Nobody Here" an email with the subject "Webship test: never sent" saying "Never."

  Scenario: A contact that is not there has no note to look through
    Fails with: There is no contact "Nobody Here" for the managing account
    Given the contact "Nobody Here" has no note "Webship test"

  Scenario: A contact that is not there has no tag to look through
    Fails with: There is no contact "Nobody Here" for the managing account
    Given the contact "Nobody Here" has no tag "webship-test-tag"

  Scenario: A file that is not there is not uploaded
    Fails with: The file "webship-test-no-such-file.txt" was not found
    Given I am a logged in user with the "marketer" user
    When I open the list of assets
    And I click "New"
    And I upload the file "webship-test-no-such-file.txt" to the asset
