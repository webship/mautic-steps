@emails @mail
Feature: Emails
  As a marketer
  I want emails the site sends, and a quick email to one contact
  So that the people we work with hear from us

  Scenario: An email of one's own to a contact reaches its mailbox
    Given I am a logged in user with the "marketer" user
    When I send the contact "Maya Nasser" an email with the subject "Webship test: our webinar" saying "Thank you for joining."
    Then an email with the subject "Webship test: our webinar" should be sent to "maya.nasser@example.com"
    And the email with the subject "Webship test: our webinar" to "maya.nasser@example.com" should contain "Thank you for joining."
    And the history of the contact "Maya Nasser" should show "Email sent"

  Scenario: A triggered email, made and removed
    Given there is no email "Webship test email"
    And I am a logged in user with the "marketer" user
    When I open the list of emails
    And I click "New"
    Then the dialog "What type of email do you want to create?" should be open
    When I press "Triggered email" in the dialog
    And I set "Subject" to "Webship test: welcome"
    And I set "Internal Name" to "Webship test email"
    Then "Internal Name" should be set to "Webship test email"
    When I save and close the form
    Then the site should say "Webship test email has been created!"
    And there should be an email "Webship test email"
    And there is no email "Webship test email"

  Scenario: The emails of the build
    Given I am a logged in user with the "marketer" user
    When I open the list of emails
    Then the list should show "Welcome email"
