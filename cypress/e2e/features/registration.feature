Feature: User Registration
  As a new user
  I want to create an account on AssetNode
  So that I can start managing my organization's hardware assets

  Scenario: Display the registration page
    Given I am on the sign-up page
    Then I should see the registration form
    And I should see fields for first name, last name, email, and password

  Scenario: Successful registration with valid data
    Given I am on the sign-up page
    When I fill in the registration form with valid data
    And I submit the registration form
    Then I should be redirected to the dashboard

  Scenario: Registration fails with missing required fields
    Given I am on the sign-up page
    When I submit the registration form without filling in required fields
    Then I should see validation errors
    And I should remain on the sign-up page

  Scenario: Registration fails with existing email
    Given I am on the sign-up page
    When I fill in the registration form with email "admin@evinsta.com"
    And I submit the registration form
    Then I should see an error about the email already being in use
