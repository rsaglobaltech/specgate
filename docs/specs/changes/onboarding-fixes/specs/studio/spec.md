# Delta — studio

## ADDED Requirements

### Requirement: REQ-474 — The studio's next step during onboarding says adopt, then specify

The system SHALL, in the studio's Home for a folder that is not a specgate project, name the next step "Adopt this folder" when it holds code — leading to Adopt, which previews the files before writing them — and "Create the project" only when it is empty; and, once the project is adopted with no brief, name "Specify a behaviour you rely on" with the number of areas in `docs/specs/adoption.md`, as `status` does, leading to the change that specifies one.

#### Scenario: SCN-474a — An existing project adopted from the studio

- GIVEN a local Node project with code under `src/auth`, `src/catalog`, `src/orders` and `src/payments`, and no specgate files
- WHEN the developer opens it in the studio, follows the next step to Adopt and adopts it
- THEN Home first says "Adopt this folder", not "Create the project", and after adoption "Specify a behaviour you rely on" with "4 areas in docs/specs/adoption.md"

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
