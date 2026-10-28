Feature: A check runs in its container

  @REQ-232 @SCN-232a
  Scenario: The container's command line
    Given a check with image `semgrep/semgrep`, `network: false`, env SONAR_TOKEN and a volume `specgate-cache:/cache`
    When its docker command is built for /work/app
    Then it mounts /work/app at /src, works in /src, has `--network none`, `-e SONAR_TOKEN` without a value, `-v specgate-cache:/cache`, and runs the command through sh in the image

  @REQ-232 @SCN-232b
  Scenario: A check really runs in Docker
    Given Docker answers and a check running `test -f /src/marker.txt` in `alpine`
    When the check runs in a project holding marker.txt
    Then it passes, and it fails in a project without it
