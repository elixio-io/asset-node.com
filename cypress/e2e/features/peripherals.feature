Feature: Peripherals Management
  As a logged-in user
  I want to manage peripheral devices
  So that I can track monitors, keyboards, mice, and other peripherals

  Background:
    Given I am logged in as admin

  Scenario: View the peripherals page
    When I visit the peripherals page
    Then I should see the peripherals page title
    And I should see a table or empty state

  Scenario: Search peripherals
    When I visit the peripherals page
    And I search for peripherals
    Then I should see filtered results or empty state
