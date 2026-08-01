Feature: Maintenance Management
  As an admin or manager user
  I want to view maintenance schedules
  So that I can track device servicing and repairs

  Background:
    Given I am logged in as admin

  Scenario: View the maintenance page
    When I visit the maintenance page
    Then I should see the maintenance page title
    And I should see a table or empty state

  Scenario: Maintenance page is restricted from employees
    Given I am logged in as employee
    When I visit the maintenance page
    Then I should be redirected to the dashboard
