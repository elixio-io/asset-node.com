Feature: Hardware Marketplace
  As a logged-in user
  I want to search for hardware products across suppliers
  So that I can find the best deals for company purchases

  Background:
    Given I am logged in as admin

  Scenario: Display the marketplace page
    When I visit the marketplace page
    Then I should see the marketplace search bar
    And I should see the marketplace title

  Scenario: Search for products
    When I visit the marketplace page
    And I enter "MacBook Pro" in the marketplace search
    And I click the marketplace search button
    Then I should see product results or a loading indicator

  Scenario: Search with too short query
    When I visit the marketplace page
    And I enter "M" in the marketplace search
    Then the marketplace search button should be disabled
