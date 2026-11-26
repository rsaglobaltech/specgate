Feature: The hosts each sandbox may reach

  @REQ-699 @SCN-699a
  Scenario: Two hosts opened, twenty-nine from the kit
    Given `allow: [registry.npmjs.org, opencode.ai]`, and a kit whose policy allows 29 hosts
    When the harness creates the sandbox for ausleihe
    Then registry.npmjs.org and opencode.ai are allowed for that sandbox alone, the record names those 2 and the kit's 29, and the run says "sg-draft-ausleihe-ausleihe may reach 31 hosts: 2 yours, 29 from the kit opencode"
