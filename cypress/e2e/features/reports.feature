Feature: Reports
  As an admin or manager
  I want to access various reports
  So that I can analyze asset utilization, depreciation, and compliance

  Background:
    Given I am logged in as admin

  Scenario: View the reports page
    When I visit the reports page
    Then I should see the reports page title
    And I should see report tab navigation

  Scenario: View asset summary report
    When I visit the reports page
    Then I should see the asset summary tab content

  Scenario: Switch to depreciation report tab
    When I visit the reports page
    And I click on the depreciation tab
    Then I should see the depreciation report content

  Scenario: Export report
    When I visit the reports page
    And I click the export button
    Then the export action should trigger

  Scenario: Reports page is restricted from employees
    Given I am logged in as employee
    When I visit the reports page
    Then I should be redirected to the dashboard
