@points
Feature: Points and stages
  As a marketer
  I want rules that give contacts points, and stages a contact goes through
  So that the most engaged contacts stand out

  Scenario: A point action, made and removed
    Given there is no point action "Webship test: points for a download"
    And I am a logged in user with the "marketer" user
    When I go to "Manage Actions" in the main menu
    And I click "New"
    Then the page heading should be "New Point Action"
    When I set "Name" to "Webship test: points for a download"
    And I set "Change points (+/-)" to "5"
    And I set "Action taken by contact" to "Downloads an asset"
    And I save and close the form
    Then the site should say "Webship test: points for a download"
    And there should be a point action "Webship test: points for a download"
    And there is no point action "Webship test: points for a download"

  Scenario: A stage, made and removed
    Given there is no stage "Webship test stage"
    And I am a logged in user with the "marketer" user
    When I open the list of stages
    Then the list should show "Lead"
    And the list should show "Customer"
    When I click "New"
    And I set "Name" to "Webship test stage"
    And I set "Weight" to "30"
    And I save and close the form
    Then the site should say "Webship test stage"
    When I open the list of stages
    Then the list should show "Webship test stage"
    And there is no stage "Webship test stage"
