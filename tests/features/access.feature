@access
Feature: What each role may open
  As the administrator of the site
  I want each account to see and open only what its role allows
  So that a sales person works with their own contacts, and nobody but the administrators changes the settings

  Scenario: A sales account has only its contacts
    Given I am a logged in user with the "sales" user
    Then the main menu should offer "Contacts"
    And the main menu should not offer "Campaigns"
    And the main menu should not offer "Segments"
    And the settings menu should not offer "Users"
    When I open the list of contacts
    Then the list should show "Lina Haddad"
    And the list should show "Karim Aziz"
    But the list should not show "Omar Saleh"
    And the list should have 2 items

  @js-off
  Scenario Outline: A sales account may not open <path>
    Given I am a logged in user with the "sales" user
    Then I should not be allowed to open "<path>"

    Examples:
      | path            |
      | /s/campaigns    |
      | /s/emails       |
      | /s/segments     |
      | /s/users        |
      | /s/config/edit  |

  Scenario: A marketer works with the marketing tools, not with the settings
    Given I am a logged in user with the "marketer" user
    Then the main menu should offer "Campaigns"
    And the main menu should offer "Emails"
    And the settings menu should offer "Categories"
    But the settings menu should not offer "Users"
    And the settings menu should not offer "Configuration"

  @js-off
  Scenario Outline: A marketer may not open <path>
    Given I am a logged in user with the "marketer" user
    Then I should not be allowed to open "<path>"

    Examples:
      | path           |
      | /s/users       |
      | /s/roles       |
      | /s/config/edit |

  Scenario: The administrator has the settings
    Given I am a logged in user with the "administrator" user
    Then the settings menu should offer "Users"
    And the settings menu should offer "Configuration"
    When I open the list of users
    Then the row of "marketer" should show "Marketer"
    And the row of "sales" should show "Sales"
    And the row of "administrator" should show "Administrator"
