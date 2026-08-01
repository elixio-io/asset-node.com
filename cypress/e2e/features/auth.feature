Feature: Authentication
  As a user of AssetNode
  I want to be able to sign in and sign out
  So that I can securely access my organization's asset management

  Background:
    Given I am on the sign-in page

  Scenario: Display the sign-in page
    Then I should see the sign-in form
    And I should see an email input field
    And I should see a password input field

  Scenario: Successful login with valid credentials
    When I enter "admin@evinsta.com" as the email
    And I enter "password123" as the password
    And I click the sign-in button
    Then I should be redirected to the dashboard

  Scenario: Failed login with invalid credentials
    When I enter "admin@evinsta.com" as the email
    And I enter "wrongpassword" as the password
    And I click the sign-in button
    Then I should see an error message
    And I should remain on the sign-in page

  Scenario: Unauthenticated users are redirected to sign-in
    Given I am not logged in
    When I try to visit the hardware page
    Then I should be redirected to the sign-in page

  Scenario: Logout redirects to sign-in
    Given I am logged in as admin
    And I am on the dashboard
    When I click the logout button
    Then I should be redirected to the sign-in page
