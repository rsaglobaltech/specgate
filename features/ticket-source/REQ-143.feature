Feature: Jira is searched through the enhanced search API

  @REQ-143 @SCN-143a
  Scenario: Two pages of labelled issues
    Given a Jira that answers HTTP 410 on `/rest/api/3/search` and returns KAN-13 on a first `/rest/api/3/search/jql` page with a `nextPageToken`, and KAN-16 on a second page marked `isLast`
    When the developer runs `specgate alm pull --label spec-driven --dry-run`
    Then it lists KAN-13 and KAN-16, and no request went to `/rest/api/3/search?`
