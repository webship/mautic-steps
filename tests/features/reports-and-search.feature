@reports
Feature: Reports, the dashboard and the search
  As a marketer
  I want the figures of the site and a search over everything
  So that I see what is happening, and find any record

  Scenario: A report lists the forms and their submissions
    Given I am a logged in user with the "marketer" user
    When I open the list of reports
    And I open "Submissions of published Forms" from the list
    Then the page heading should be "View Report - Submissions of published Forms"
    And the report should list "Newsletter sign-up" under "Title"

  Scenario: The dashboard shows its widgets
    Given I am a logged in user with the "marketer" user
    When I go to "Dashboard" in the main menu
    Then the dashboard should show the widget "Contacts Created"
    And the dashboard should show the widget "Upcoming Emails" saying "No emails are scheduled to be sent."

  Scenario: The search of everything finds a contact
    Given I am a logged in user with the "marketer" user
    When I search everything for "Haddad"
    Then the search results should list "Haddad, Lina" under "Contacts"
    And the search results should not list "Saleh, Omar"

  Scenario: A sales account finds only its own contacts
    Given I am a logged in user with the "sales" user
    When I search everything for "Saleh"
    Then the search results should not list "Saleh, Omar"
