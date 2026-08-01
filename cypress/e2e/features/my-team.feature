Feature: My Team
  As a manager
  I want to view my direct reports and their hardware
  So that I can oversee team asset utilization

  Background:
    Given I am logged in as manager

  Scenario: View my team page
    When I visit the my-team page
    Then I should see the my team page title
    And I should see team members or an empty state

  Scenario: My team page is restricted from employees
    Given I am logged in as employee
    When I visit the my-team page
    Then I should be redirected to the dashboard
