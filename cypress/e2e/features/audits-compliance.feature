Feature: Audits and Compliance
  As an admin or manager
  I want to view audit trails and compliance data
  So that I can ensure regulatory requirements are met

  Background:
    Given I am logged in as admin

  Scenario: View the audits page
    When I visit the audits page
    Then I should see the audits page title
    And I should see audit log entries or an empty state

  Scenario: View the labels page
    When I visit the labels page
    Then I should see the labels page title

  Scenario: View the depreciations page
    When I visit the depreciations page
    Then I should see the depreciations page title

  Scenario: View the import page
    When I visit the import page
    Then I should see the import page title

  Scenario: View the recycle bin page
    When I visit the recycle-bin page
    Then I should see the recycle bin page title
