@must-fail @forms @campaigns @mail
Feature: Assertions of the forms, the campaigns and the mail that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read, leave a form or a
  campaign unsaved, or ask for a password reset link (which leaves the password as it was): the site is left as it
  was.

  Scenario: The form builder has no field of another kind
    Fails with: The form offers no field "Favourite colour"
    Given I am a logged in user with the "marketer" user
    When I open the list of forms
    And I click "New"
    And I add a "Favourite colour" field to the form with:
      | Label | Webship test colour |

  Scenario: The form builder has no submit action of another kind
    Fails with: The form offers no submit action "Send a postcard"
    Given I am a logged in user with the "marketer" user
    When I open the list of forms
    And I click "New"
    And I add the submit action "Send a postcard" to the form with:
      | Name | Webship test postcard |

  Scenario: A new form holds no field it was not given
    Fails with: The form does not hold the field "Email"
    Given I am a logged in user with the "marketer" user
    When I open the list of forms
    And I click "New"
    Then the form should hold the field "Email"

  Scenario: There is no public form of another name
    Fails with: There is no form "Webship test: never made" in the list of forms
    Given I am not logged in
    When I open the public form "Webship test: never made"

  Scenario: The login page is not a public form to send
    Fails with: The page shows no public form
    Given I am not logged in
    When I send the public form

  Scenario: A field of the public form that was not sent shows no error
    Fails with: The public form field "Email" shows no error, not "This is required."
    Given I am not logged in
    When I open the public form "Newsletter sign-up"
    Then the public form field "Email" should show the error "This is required."

  Scenario: The results of a form list nobody who did not send it
    Fails with: The results of the form "Newsletter sign-up" do not list "nobody.here@example.com"
    Given I am a logged in user with the "marketer" user
    Then the results of the form "Newsletter sign-up" should list "nobody.here@example.com"

  Scenario: The campaign builder opens on a campaign only
    Fails with: The page has no "Launch Campaign Builder"
    Given I am a logged in user with the "marketer" user
    When I open the list of contacts
    And I open the campaign builder

  Scenario: An action goes into no campaign builder that is closed
    Fails with: The campaign builder is not open
    Given I am a logged in user with the "marketer" user
    When I open the list of campaigns
    And I add the action "Modify contact's tags" to the campaign with:
      | Name     | Webship test: never added |
      | Add tags | webship-test-never        |

  Scenario: A campaign builder that is not open is not closed
    Fails with: The campaign builder is not open
    Given I am a logged in user with the "marketer" user
    When I open the list of campaigns
    And I close the campaign builder

  Scenario: The builder of a new campaign shows nothing of another name
    Fails with: The campaign builder does not show "Webship test: never added"
    Given I am a logged in user with the "marketer" user
    When I open the list of campaigns
    And I click "New"
    And I open the campaign builder
    Then the campaign builder should show "Webship test: never added"

  Scenario: The scheduled tasks give a contact no tag that nothing gives it
    Fails with: The contact "Karim Aziz" did not get the tag "webship-test-never" in 15 seconds
    Given I am a logged in user with the "marketer" user
    Then the contact "Karim Aziz" should have the tag "webship-test-never" once the scheduled tasks have run

  Scenario: A reset link asked for is a mail sent
    Fails with: A mail came to sales@example.com
    When I ask for a password reset link for "sales"
    Then no email should be sent to "sales"

  Scenario: The reset mail says what it says, not another text
    Fails with: The mail "Mautic password reset" to sales@example.com does not say "Webship test: never written"
    When I ask for a password reset link for "sales"
    Then the email with the subject "password reset" to "sales" should contain "Webship test: never written"

  Scenario: The reset mail has no link of another name
    Fails with: The mail "Mautic password reset" to sales@example.com has no link with "webship-test-no-such-link"
    When I ask for a password reset link for "sales"
    And I open the "webship-test-no-such-link" link of the email with the subject "password reset" to "sales"
