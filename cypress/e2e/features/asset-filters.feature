Feature: Asset Filtering Views
  As a logged-in user
  I want to view assets filtered by status
  So that I can quickly find available, defective, or for-sale items

  Background:
    Given I am logged in as admin

  Scenario: View available assets
    When I visit the available assets page
    Then I should see the page title "Available Assets"
    And I should see a table or empty state message

  Scenario: View defective assets
    When I visit the defective assets page
    Then I should see the page title "Defective Assets"
    And I should see a table or empty state message

  Scenario: View assets for sale
    When I visit the sales page
    Then I should see the page title "For Sale"
    And I should see a table or empty state message
