Feature: Asset Assignments
  As an admin user
  I want to manage hardware assignments
  So that I can track which employee has which device

  Background:
    Given I am logged in as admin

  Scenario: View the assignments list
    When I visit the assignments page
    Then I should see the assignments table
    And I should see assigned hardware with employee names

  Scenario: Reassign hardware to another employee
    When I visit the assignments page
    And I click the edit button on the first assignment
    Then I should see an employee selection dropdown

  Scenario: Return a hardware assignment
    When I visit the assignments page
    And I click the return button on an assignment
    Then the assignment should be removed from the list
