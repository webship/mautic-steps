@session @mail
Feature: The password reset
  As a person who forgot the password of my account
  I want a reset link in my mailbox
  So that I can set a new password and log in again

  # The suite sets the account's password to the one the users registry gives it: the account logs in as before.

  Scenario: The reset link sets a new password
    When I ask for a password reset link for "sales"
    Then I should be on the login page saying "A new password has been generated and will be emailed to you"
    And an email with the subject "password reset" should be sent to "sales"
    And the email with the subject "password reset" to "sales" should contain "You requested a password reset"
    When I open the "passwordresetconfirm" link of the email with the subject "password reset" to "sales"
    And I set the password of "sales" on the reset page
    Then I should be on the login page saying "you have successfully reset your password"
    When I log in as "sales" with the login form
    Then I should be logged in as "sales"

  Scenario: A reset whose passwords differ is refused
    When I ask for a password reset link for "marketer"
    And I open the link of the email with the subject "password reset" to "marketer"
    And I set the password of "marketer" on the reset page with the confirmation "Something-else-1"
    Then the site should say "Passwords do not match."
    And the field "Password" should show the error "Passwords do not match."

  Scenario: An unknown account gets the same answer, and no mail
    When I ask for a password reset link for "nobody@example.com"
    Then I should be on the login page saying "if this user exists"
    And no email should be sent to "nobody@example.com"
