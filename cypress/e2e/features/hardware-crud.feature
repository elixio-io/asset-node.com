Feature: Hardware Asset Management
  As an admin user
  I want to manage hardware assets in the inventory
  So that I can track all company devices and their status

  Background:
    Given I am logged in as admin

  Scenario: Hardware list page loads with assets
    When I visit the hardware page
    Then I should see the hardware list
    And I should see hardware assets from the inventory

  Scenario: Search for hardware assets
    When I visit the hardware page
    And I search for "MacBook"
    Then I should see results containing "MacBook"

  Scenario: Open the create hardware dialog
    When I visit the hardware page
    And I click the add hardware button
    Then I should see the hardware creation form

  Scenario: Create a new hardware asset
    When I visit the hardware page
    And I click the add hardware button
    And I fill in the serial number "CY-BDD-001"
    And I fill in the model "Cypress BDD Test Laptop"
    And I submit the hardware form
    Then I should see a success confirmation
