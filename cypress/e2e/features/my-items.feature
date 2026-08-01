Feature: My Items
  As an employee
  I want to view my assigned hardware
  So that I can see what devices are checked out to me

  Background:
    Given I am logged in as employee

  Scenario: View my assigned items
    When I visit the my-items page
    Then I should see the my items page title
    And I should see my assigned hardware or an empty state

  Scenario: My items page is accessible to all authenticated users
    Given I am logged in as admin
    When I visit the my-items page
    Then I should see the my items page title
