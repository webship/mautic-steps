@forms
Feature: Forms
  As a marketer
  I want forms that visitors fill in on the site
  So that a new contact comes in with their details, a tag and points

  # The build of the site makes the form "Newsletter sign-up": Email (required) and First name; a visitor who signs
  # up gets the tag "newsletter" and ten points, and reads "Thank you for signing up.".

  @critical
  Scenario: A visitor signs up through the public form and becomes a contact
    Given there is no contact "webship-test-signup@example.com"
    And I am not logged in
    When I open the public form "Newsletter sign-up"
    And I fill in "Email" with "webship-test-signup@example.com"
    And I fill in "First name" with "Webship test signup"
    And I send the public form
    Then the public form should say "Thank you for signing up."
    Given I am a logged in user with the "marketer" user
    Then the contact "webship-test-signup@example.com" should have 10 points
    And the contact "webship-test-signup@example.com" should have the tag "newsletter"
    And the history of the contact "webship-test-signup@example.com" should show "Form submitted"
    And the results of the form "Newsletter sign-up" should list "webship-test-signup@example.com"
    And there is no contact "webship-test-signup@example.com"

  Scenario: The public form refuses an empty required field
    Given I am not logged in
    When I open the public form "Newsletter sign-up"
    And I fill in "First name" with "Webship test"
    And I send the public form
    Then the public form field "Email" should show the error "This is required."

  Scenario: A form made in the builder, with a field and a submit action
    Given there is no form "Webship test form"
    And I am a logged in user with the "marketer" user
    When I open the list of forms
    And I click "New"
    And I set "Name" to "Webship test form"
    And I set "Redirect URL/Message" to "Thank you for your interest."
    And I add a "Email" field to the form with:
      | Label | Your email |
    And I add a "Text: Short answer" field to the form with:
      | Label          | Your city |
      | Matching field | City      |
    And I add the submit action "Adjust contact's points" to the form with:
      | Name                        | Webship test: five points |
      | Amount to change points by  | 5                         |
    Then the form should hold the field "Your email"
    And the form should hold the field "Your city"
    And the form should hold the action "Webship test: five points"
    When I save and close the form
    Then the site should say "Webship test form has been created!"
    And the page heading should be "Webship test form"
    And there should be a form "Webship test form"
    And there is no form "Webship test form"

  Scenario: A form without its message is refused
    Given I am a logged in user with the "marketer" user
    When I open the list of forms
    And I click "New"
    And I set "Name" to "Webship test form without a message"
    And I save and close the form
    Then the field "Redirect URL/Message" should show the error "Fill in a message to display."
    When I cancel the form
    Then the page heading should be "Forms"
