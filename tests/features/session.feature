@session
Feature: The session
  As a person who works in the site
  I want to log in with my account, be refused with a wrong password, and log out
  So that only the accounts of the site get into its administration

  # The accounts are the ones the build of the site makes (cucumber.js, worldParameters.users).

  @critical
  Scenario Outline: The <account> account logs in through the login form
    Given I am not logged in
    When I log in as "<account>" with the login form
    Then I should be logged in as "<account>"
    And the page heading should be "Dashboard"

    Examples:
      | account       |
      | administrator |
      | marketer      |
      | sales         |

  # The site refuses every login of a name, as it is typed, for half an hour after three failed ones from one address,
  # and a login that works does not set the count back. So the wrong password is tried with the account's address, a
  # name no other scenario logs in with: the user name the other scenarios use is never locked by it.
  Scenario: A wrong password is refused
    Given I am not logged in
    When I log in with the username "marketer@example.com" and the password "Wrong-password-1"
    Then the login should be refused with "Invalid login. Please verify credentials."
    And I should not be logged in

  Scenario: An account logs in with its address too
    Given I am not logged in
    When I log in with the username "sales@example.com" and the password "dD.123123ddd"
    Then I should be logged in as "sales"

  Scenario: Logging out ends the session
    Given I am a logged in user with the "marketer" user
    When I log out
    Then I should be on the login page
    And I should not be logged in

  @js-off
  Scenario: A visitor is sent to the login page
    Given I am not logged in
    Then I should not be allowed to open "/s/contacts"
    And I should be on the login page
