Feature: Scoped tokens reach Jira through the gateway

  @REQ-144 @SCN-144a
  Scenario: A scoped token
    Given `alm.config.yaml` with `base_url: https://specgatedemo.atlassian.net` and `cloud_id: auto`, and a site whose `tenant_info` returns cloud id `9e49`
    When the developer runs `specgate alm pull --dry-run`
    Then the search goes to `https://api.atlassian.com/ex/jira/9e49/rest/api/3/search/jql`, the `tenant_info` request carries no `Authorization` header, and each issue's link starts with `https://specgatedemo.atlassian.net/browse/`

  @REQ-144 @SCN-144b
  Scenario: A scoped token sent to the site
    Given the same config without `cloud_id`, and a site that answers HTTP 401
    When the developer runs `specgate alm pull --dry-run`
    Then it exits 1 and the message says to set `cloud_id: auto` for a token created with scopes

  @REQ-144 @SCN-144c
  Scenario: Answered as anonymous
    Given the same config without `cloud_id`, and a site whose search answers HTTP 200 with no issues and `X-Seraph-LoginReason: AUTHENTICATED_FAILED`
    When the developer runs `specgate alm pull --dry-run`
    Then it exits 1 naming `cloud_id: auto`, and does not say "No open issues"
