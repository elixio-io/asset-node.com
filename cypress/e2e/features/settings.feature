Feature: System Settings
  As an admin user
  I want to manage system settings
  So that I can configure the application for my organization

  Background:
    Given I am logged in as admin

  Scenario: View the settings page
    When I visit the settings page
    Then I should see the settings page title
    And I should see settings tab navigation

  Scenario: View general settings tab
    When I visit the settings page
    Then I should see the general settings form
    And I should see the organization name field

  Scenario: Switch to notifications tab
    When I visit the settings page
    And I click on the notifications settings tab
    Then I should see notification preferences

  Scenario: Switch to API keys tab
    When I visit the settings page
    And I click on the API keys settings tab
    Then I should see the API keys management section

  Scenario: Switch to webhooks tab
    When I visit the settings page
    And I click on the webhooks settings tab
    Then I should see the webhooks management section

  Scenario: Switch to integrations tab
    When I visit the settings page
    And I click on the integrations settings tab
    Then I should see the integrations configuration section

  Scenario: Settings page is restricted from non-admins
    Given I am logged in as employee
    When I visit the settings page
    Then I should be redirected to the dashboard

  Scenario: Settings page is restricted from managers
    Given I am logged in as manager
    When I visit the settings page
    Then I should be redirected to the dashboard
