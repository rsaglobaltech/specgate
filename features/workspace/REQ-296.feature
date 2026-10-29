Feature: A business story split across repositories

  @REQ-296 @SCN-296a
  Scenario: A story split across three repositories
    Given a workspace truck-flote with fleet, tracking and web
    When the developer runs `specgate workspace propose follow-shipment --repos fleet,tracking,web`
    Then each of the three has the change follow-shipment, whose proposal says it is part of the workspace story truck-flote:follow-shipment, the story lists its three sub-changes, and proposing it again is refused
