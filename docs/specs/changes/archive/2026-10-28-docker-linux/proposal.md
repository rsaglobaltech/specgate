# Proposal: docker-linux

## Intent

The first CI run of Specgate on GitHub's Windows runners failed four tests:
Docker answered there, but in Windows containers mode, where no check image
(maven, node, gitleaks, osv-scanner, semgrep) has a manifest. Specgate took
"Docker answers" for "checks can run", reported each check as skipped for a
pull that could not work, and the tests that expected a failure got none. A
person with Docker Desktop on Windows containers would see the same.

## Scope

Docker counts as available only when it runs Linux containers; otherwise the
skip says to switch Docker Desktop to Linux containers.
