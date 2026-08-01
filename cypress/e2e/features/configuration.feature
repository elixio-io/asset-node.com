Feature: Configuration Pages
  As an admin user
  I want to manage categories, statuses, custom fields, and company profile
  So that I can customize the asset management system for my organization

  Background:
    Given I am logged in as admin

  Scenario: View the categories page
    When I visit the categories page
    Then I should see the categories page title
    And I should see a list of categories or an empty state

  Scenario: View the statuses page
    When I visit the statuses page
    Then I should see the statuses page title
    And I should see a list of statuses or an empty state

  Scenario: View the custom fields page
    When I visit the custom-fields page
    Then I should see the custom fields page title
    And I should see custom field definitions or an empty state

  Scenario: View the company profile page
    When I visit the company-profile page
    Then I should see the company profile page title

  Scenario: Custom fields page is restricted from non-admins
    Given I am logged in as manager
    When I visit the custom-fields page
    Then I should be redirected to the dashboard

  Scenario: Categories page is restricted from employees
    Given I am logged in as employee
    When I visit the categories page
    Then I should be redirected to the dashboard
