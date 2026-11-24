@segments
Feature: Segments
  As a marketer
  I want segments of contacts that match filters
  So that a campaign or an email reaches the right people

  # A segment of filters is built by the site's scheduled tasks (its cron): the build of the site runs them, and the
  # steps that read a count wait for them.

  @critical
  Scenario: The segments of the build count their contacts
    Given I am a logged in user with the "marketer" user
    Then the segment "Newsletter readers" should have 2 contacts
    And the segment "Amman contacts" should have 2 contacts

  Scenario: A segment's page lists its contacts
    Given I am a logged in user with the "marketer" user
    When I open the list of segments
    And I open "Newsletter readers" from the list
    Then the page heading should be "Newsletter readers"
    And I should see "Lina Haddad"
    And I should see "Omar Saleh"
    But I should not see "Sara Khalil"

  @scheduled-tasks
  Scenario: A new segment of filters is built by the scheduled tasks, then removed
    Given there is no segment "Webship test segment"
    And I am a logged in user with the "marketer" user
    When I open the list of segments
    And I click "New"
    And I set "Name" to "Webship test segment"
    And I add the filter "City" is equal to "Aqaba"
    And I save and close the form
    Then the site should say "Webship test segment"
    And the list should show "Webship test segment"
    And the segment "Webship test segment" should have 1 contact
    When I open the list of segments
    And I choose "Delete" in the options of "Webship test segment"
    Then the site should ask "Delete the segment, Webship test segment"
    When I answer the confirmation with "Delete"
    Then the list should not show "Webship test segment"

  Scenario: A segment's filters, by tag
    Given there is no segment "Webship test tag segment"
    And I am a logged in user with the "marketer" user
    When I open the list of segments
    And I click "New"
    And I set "Name" to "Webship test tag segment"
    And I add the filter "Tags" includes any of "vip"
    And I save the form
    Then the page heading should be "Edit Segment - Webship test tag segment"
    When I cancel the form
    Then the page heading should be "Webship test tag segment"
    And I should see "Dynamic segment"
    And there is no segment "Webship test tag segment"
