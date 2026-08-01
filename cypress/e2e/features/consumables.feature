Feature: Consumables Management
  As a logged-in user
  I want to manage consumable inventory
  So that I can track cables, adapters, and other consumable supplies

  Background:
    Given I am logged in as admin

  Scenario: View the consumables page
    When I visit the consumables page
    Then I should see the consumables page title
    And I should see a table or empty state

  Scenario: Search consumables
    When I visit the consumables page
    And I search for consumables
    Then I should see filtered results or empty state
