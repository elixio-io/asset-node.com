Feature: Dashboard
  As a logged-in user
  I want to see an overview of my organization's assets
  So that I can quickly understand the current state of hardware inventory

  Background:
    Given I am logged in as admin
    And I am on the dashboard

  Scenario: Dashboard page loads successfully
    Then I should see the dashboard page
    And I should see the page title "Dashboard"

  Scenario: Dashboard displays KPI summary cards
    Then I should see summary cards with asset statistics

  Scenario: Navigation sidebar is visible
    Then I should see the navigation sidebar

  Scenario: Navigate to hardware page from sidebar
    When I click on "Hardware" in the sidebar
    Then I should be on the hardware page

  Scenario: Navigate to employees page from sidebar
    When I click on "Employees" in the sidebar
    Then I should be on the employees page
