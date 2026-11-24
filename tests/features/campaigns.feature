@campaigns
Feature: Campaigns
  As a marketer
  I want a campaign that acts on the contacts of a segment
  So that each of them is handled the same way, without me

  # A campaign runs in the site's scheduled tasks (its cron): the build of the site runs them; the scenario waits for
  # the action to reach the contacts.

  @scheduled-tasks
  Scenario: A campaign tags the contacts of a segment, then is removed
    Given there is no campaign "Webship test campaign"
    And the contact "Karim Aziz" has no tag "webship-test-onboarded"
    And there is no segment "Webship test Aqaba"
    And I am a logged in user with the "marketer" user
    When I open the list of segments
    And I click "New"
    And I set "Name" to "Webship test Aqaba"
    And I add the filter "City" is equal to "Aqaba"
    And I save and close the form
    Then the segment "Webship test Aqaba" should have 1 contact
    When I open the list of campaigns
    And I click "New"
    And I set "Name" to "Webship test campaign"
    And I open the campaign builder
    And I add the segment "Webship test Aqaba" as the source of the campaign
    And I add the action "Modify contact's tags" to the campaign with:
      | Name     | Webship test: tag the contacts |
      | Add tags | webship-test-onboarded         |
    Then the campaign builder should show "Webship test Aqaba"
    And the campaign builder should show "Webship test: tag the contacts"
    When I close the campaign builder
    And I set "Active" to "Yes"
    And I save and close the form
    Then the page heading should be "Webship test campaign"
    And the contact "Karim Aziz" should have the tag "webship-test-onboarded" once the scheduled tasks have run
    And the history of the contact "Karim Aziz" should show "Campaign action triggered"
    And there is no campaign "Webship test campaign"
    And there is no segment "Webship test Aqaba"
    And there is no tag "webship-test-onboarded"
