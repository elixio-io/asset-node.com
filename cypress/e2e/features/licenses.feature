Feature: Software Licenses
  As an admin user
  I want to manage software licenses
  So that I can track license costs, seats, and expiration dates

  Background:
    Given I am logged in as admin

  Scenario: View the licenses list page
    When I visit the licenses page
    Then I should see the licenses page title
    And I should see the add license button

  Scenario: Display license KPI cards
    When I visit the licenses page
    Then I should see license summary statistics

  Scenario: Search for licenses
    When I visit the licenses page
    And I search for a license by name
    Then I should see filtered license results

  Scenario: Open add license dialog
    When I visit the licenses page
    And I click the add license button
    Then I should see the license creation dialog
    And I should see fields for name, publisher, type, and seats

  Scenario: Create a new license
    When I visit the licenses page
    And I click the add license button
    And I fill in the license name "Cypress Test License"
    And I fill in the license publisher "Cypress Corp"
    And I select license type "subscription"
    And I fill in the number of seats "10"
    And I submit the license form
    Then I should see a success confirmation
