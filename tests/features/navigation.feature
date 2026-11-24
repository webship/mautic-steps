@navigation
Feature: The menus
  As a person who works in the site
  I want the main menu and the settings menu to take me to each part
  So that I find my way without knowing the addresses

  Scenario Outline: The main menu opens <item>
    Given I am a logged in user with the "administrator" user
    When I go to "<item>" in the main menu
    Then the page heading should be "<heading>"

    Examples:
      | item               | heading             |
      | Contacts           | Contacts            |
      | Companies          | Companies           |
      | Segments           | Contact Segments    |
      | Forms              | Forms               |
      | Landing Pages      | Landing Pages       |
      | Assets             | Assets              |
      | Emails             | Emails              |
      | Campaigns          | Campaigns           |
      | Manage Actions     | Points              |
      | Stages             | Stages              |
      | Reports            | Reports             |
      | Tags               | Tags                |

  Scenario Outline: The settings menu opens <item>
    Given I am a logged in user with the "administrator" user
    When I go to "<item>" in the settings menu
    Then the page heading should be "<heading>"

    Examples:
      | item          | heading       |
      | Users         | Users         |
      | Roles         | Roles         |
      | Custom Fields | Custom Fields |
      | Configuration | Configuration |
      | Categories    | Categories    |

  @js-off
  Scenario: An address the site does not have
    Given I am a logged in user with the "marketer" user
    When I go to "/s/no-such-page"
    Then the response status code should be 404
    And I should see "I'm sorry! I couldn't find the page you were looking for."
