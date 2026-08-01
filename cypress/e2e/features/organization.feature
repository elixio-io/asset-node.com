Feature: Organization Management
  As an admin or manager
  I want to manage locations, departments, manufacturers, and suppliers
  So that I can organize hardware assets properly

  Background:
    Given I am logged in as admin

  Scenario: View the locations page
    When I visit the locations page
    Then I should see the locations page title
    And I should see a list of locations or an empty state

  Scenario: View the departments page
    When I visit the departments page
    Then I should see the departments page title
    And I should see a list of departments or an empty state

  Scenario: View the manufacturers page
    When I visit the manufacturers page
    Then I should see the manufacturers page title
    And I should see a list of manufacturers or an empty state

  Scenario: View the suppliers page
    When I visit the suppliers page
    Then I should see the suppliers page title
    And I should see a list of suppliers or an empty state

  Scenario: Organization pages are restricted from employees
    Given I am logged in as employee
    When I visit the locations page
    Then I should be redirected to the dashboard
