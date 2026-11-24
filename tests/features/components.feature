@components
Feature: Landing pages and assets
  As a marketer
  I want pages and files that visitors open on the site
  So that a campaign has somewhere to send people, and something to give them

  # The build of the site makes the landing page "Spring webinar" (/spring-webinar) and the asset "Product brochure".

  @critical
  Scenario: A visitor reads a landing page
    Given I am not logged in
    When I go to "/spring-webinar"
    Then the response status code should be 200
    And I should see "Spring webinar"
    And I should see "Join our free webinar on marketing automation."
    And the page should load the tracking script

  Scenario: The landing pages list holds the page
    Given I am a logged in user with the "marketer" user
    When I open the list of landing pages
    Then the list should show "Spring webinar"

  Scenario: A visitor downloads an asset
    Given I am a logged in user with the "marketer" user
    Then the asset "Product brochure" should download as "product-brochure.txt" with "A sample file of the test site"

  Scenario: A new asset from a file, downloaded, then removed
    Given there is no asset "Webship test notes"
    And I am a logged in user with the "marketer" user
    When I open the list of assets
    And I click "New"
    And I upload the file "webship-test-notes.txt" to the asset
    Then "Title" should be set to "webship-test-notes.txt"
    When I set "Title" to "Webship test notes"
    And I save and close the form
    Then the site should say "Webship test notes has been created!"
    And the asset "Webship test notes" should download as "webship-test-notes.txt" with "Webship test notes"
    And there is no asset "Webship test notes"

  Scenario: A new landing page, at its own address, then removed
    Given there is no landing page "Webship test page"
    And I am a logged in user with the "marketer" user
    When I open the list of landing pages
    And I click "New"
    And I set "Title" to "Webship test page"
    And I set "Alias" to "webship-test-page"
    And I save and close the form
    Then the site should say "Webship test page has been created!"
    Given I am not logged in
    When I go to "/webship-test-page"
    Then the response status code should be 200
    And the page should load the tracking script
    And there is no landing page "Webship test page"
