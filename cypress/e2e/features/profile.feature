Feature: User Profile
  As a logged-in user
  I want to view and edit my profile
  So that I can keep my personal information up to date

  Background:
    Given I am logged in as admin

  Scenario: View profile page
    When I visit the profile page
    Then I should see my profile information
    And I should see my email address
    And I should see my first and last name

  Scenario: Edit profile information
    When I visit the profile page
    And I update my first name to "Alexander"
    And I save my profile changes
    Then I should see a success message

  Scenario: Open password change dialog
    When I visit the profile page
    And I click the change password button
    Then I should see the password change dialog
    And I should see fields for current and new password
