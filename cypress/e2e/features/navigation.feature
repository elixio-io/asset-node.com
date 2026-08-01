Feature: Navigation & Role-Based Access Control
  As a user with a specific role
  I want to access only the pages I am authorized to see
  So that the application enforces proper security boundaries

  Scenario Outline: Admin can access all pages
    Given I am logged in as admin
    When I visit the "<page>" page
    Then I should not be redirected to sign-in
    And I should be on the "<page>" page

    Examples:
      | page            |
      | dashboard       |
      | hardware        |
      | employees       |
      | assignments     |
      | available       |
      | defective       |
      | sales           |
      | licenses        |
      | consumables     |
      | peripherals     |
      | marketplace     |
      | reports         |
      | maintenance     |
      | my-items        |
      | my-team         |
      | labels          |
      | audits          |
      | locations       |
      | departments     |
      | manufacturers   |
      | suppliers       |
      | kits            |
      | components      |
      | import          |
      | recycle-bin      |
      | categories      |
      | statuses        |
      | depreciations   |
      | custom-fields   |
      | settings        |
      | admin           |
      | profile         |
      | company-profile |

  Scenario Outline: Employee cannot access admin/manager pages
    Given I am logged in as employee
    When I visit the "<page>" page
    Then I should be redirected to the dashboard

    Examples:
      | page           |
      | employees      |
      | reports        |
      | maintenance    |
      | labels         |
      | audits         |
      | locations      |
      | departments    |
      | manufacturers  |
      | suppliers      |
      | kits           |
      | components     |
      | import         |
      | recycle-bin     |
      | categories     |
      | statuses       |
      | depreciations  |
      | custom-fields  |
      | settings       |
      | admin          |
      | my-team        |

  Scenario Outline: Manager cannot access admin-only pages
    Given I am logged in as manager
    When I visit the "<page>" page
    Then I should be redirected to the dashboard

    Examples:
      | page          |
      | custom-fields |
      | settings      |
      | admin         |

  Scenario Outline: Employee can access shared pages
    Given I am logged in as employee
    When I visit the "<page>" page
    Then I should not be redirected to sign-in
    And I should be on the "<page>" page

    Examples:
      | page            |
      | dashboard       |
      | hardware        |
      | assignments     |
      | available       |
      | defective       |
      | sales           |
      | licenses        |
      | consumables     |
      | peripherals     |
      | marketplace     |
      | my-items        |
      | profile         |
      | company-profile |
