Feature: Kits and Components
  As an admin or manager user
  I want to manage asset kits and components
  So that I can group related items and track sub-components

  Background:
    Given I am logged in as admin

  Scenario: View the kits page
    When I visit the kits page
    Then I should see the kits page title
    And I should see a table or empty state

  Scenario: View the components page
    When I visit the components page
    Then I should see the components page title
    And I should see a table or empty state

  Scenario: Kits page is restricted from employees
    Given I am logged in as employee
    When I visit the kits page
    Then I should be redirected to the dashboard

  Scenario: Components page is restricted from employees
    Given I am logged in as employee
    When I visit the components page
    Then I should be redirected to the dashboard
