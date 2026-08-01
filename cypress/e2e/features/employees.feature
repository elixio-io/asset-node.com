Feature: Employee Management
  As an admin user
  I want to manage employee records
  So that I can assign hardware assets to team members

  Background:
    Given I am logged in as admin

  Scenario: Employee list page loads with data
    When I visit the employees page
    Then I should see the employees list
    And I should see employees from the organization

  Scenario: Search for employees
    When I visit the employees page
    And I search for "Sarah"
    Then I should see results containing "Sarah"

  Scenario: Open the create employee dialog
    When I visit the employees page
    And I click the add employee button
    Then I should see the employee creation form

  Scenario: Create a new employee
    When I visit the employees page
    And I click the add employee button
    And I fill in the first name "Cypress"
    And I fill in the last name "BDDUser"
    And I fill in the employee email "cypress.bdd@evinsta.com"
    And I submit the employee form
    Then I should see a success confirmation
