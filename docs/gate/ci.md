# The gate in CI

A gate that only runs on laptops is a suggestion. At the end of this page the
gate runs on every pull request in your CI, a red gate blocks the merge, and
you know what each line of the generated job does and how to keep it current.

**You need:** the gate passing on your machine ([On your machine](local.md))
and a repository on GitHub, GitLab, Azure DevOps or Jenkins.

## Write the job

`specgate init` and `specgate adopt` already wrote it, for the CI the
repository shows. Write it again, or for another CI:

```bash
specgate ci init                       # the provider the repository shows
specgate ci init --provider gitlab     # github | gitlab | azure | jenkins
specgate ci init --stdout              # print it, write nothing
specgate ci init --force               # overwrite the file that is there
```

| Provider | File | Paste-in |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/spec-gate.yml` | its own workflow |
| GitLab CI | `.gitlab-ci.yml` | a `spec-gate` job — paste it into yours if you have one |
| Azure Pipelines | `azure-pipelines.yml` | steps — paste them into yours if you have one |
| Jenkins | `Jenkinsfile` | a `Spec gate` stage — paste it into yours if you have one |

Then ask what it checks, and what it lacks:

```bash
specgate ci status
```

```text
  ◆ specgate · ci status   .github/workflows/spec-gate.yml

  ✔  the specification (validate --strict)
  ✔  the project's tests (check runs test_cmd)
  ✔  the architecture check (check runs arch_cmd)
  ✔  Ubuntu, macOS and Windows
  ✔  the requirement ids against the base branch (check --base)
  ✔  the quality checks (quality run)
  ✔  the pack drift (validate --against-lock)
  ✔  the pending-work plan (plan --format json)

  ✔  Everything specgate can check runs in CI.
```

## GitHub Actions, step by step

The GitHub job is the complete one. Each step says in the YAML what it checks
and what to delete to remove it:

| Step | What it does | Remove it? |
| --- | --- | --- |
| Ubuntu, macOS, Windows | The same gate on the three, because paths, line endings and shells differ | Delete two entries of `os:` to keep one |
| `checkout` with `fetch-depth: 0` | The whole history, so the ids can be compared with the base branch | Only with `--base` below |
| Toolchain and dependencies | Node, or a JDK for Maven and Gradle, and the project's dependencies, for its tests | No |
| **The gate** | `check --base origin/<base>`: ids, specification, architecture, tests | Never — this is the gate |
| Quality checks | `quality run --stage ci`, on Ubuntu only, because the checks run in Docker. Not configured: says how, and passes | Delete the step |
| Pack drift | `validate --against-lock`: the domain packs still match `.specops.lock`. No packs: skipped | Delete the step |
| Pending-work plan | `plan --format json`, kept as the `spec-plan` artifact of the run | Delete both steps |

A step whose tool is not configured yet — no `test_cmd`, no quality checks,
no packs — says so in the log and passes, so the job is green on day one and
checks more as you configure more.

One job on Ubuntu running only the gate, if that is all you want:

```bash
specgate ci init --provider github --minimal --force
```

## GitLab, Azure and Jenkins

Their jobs run the gate, the pack drift and the plan, on one Linux image.
This is GitLab's, as `specgate ci init --provider gitlab --stdout` writes it:

```yaml
spec-gate:
  image: node:22
  stage: test
  script:
    - npm install
    # The gate: the specification and the project's tests.
    - |
      npx @rsaglobaltech/specgate@1.5.0 check .
    # Supply-chain gate: fails when rendered pack content no longer matches the
    # digest pinned in .specops.lock. Skipped when no packs are installed.
    - >
      if [ -f .specops.lock ]; then
        npx @rsaglobaltech/specgate@1.5.0 validate . --against-lock;
      else
        echo "No .specops.lock — no packs installed, nothing to check.";
      fi
    - npx @rsaglobaltech/specgate@1.5.0 plan --project-dir . --format json > spec-plan.json
  artifacts:
    when: always
    paths:
      - spec-plan.json
```

Azure's runs the same three as steps on `ubuntu-latest`, publishing the plan
as a build artifact; Jenkins' as a declarative pipeline in a `node:22`
container, archiving the plan in `post { always }`.

**What they do not do yet**, compared with GitHub's: compare the ids with the
base branch, and run the `ci`-stage quality checks. Add both by hand: fetch
the branch the merge request targets, then pass it as `--base`. In GitLab, in
a merge request pipeline:

```yaml
spec-gate:
  variables:
    GIT_DEPTH: 0
  script:
    - npm install
    - git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx @rsaglobaltech/specgate@1.5.0 check . --base "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx @rsaglobaltech/specgate@1.5.0 quality run --stage ci --base "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
```

The target branch is `$(System.PullRequest.TargetBranchName)` in Azure
Pipelines and `$CHANGE_TARGET` in a Jenkins multibranch pipeline; fetch it the
same way. The quality checks run in Docker, so the job needs one: a
`docker:dind` service in GitLab, a Docker-capable agent in Jenkins; Azure's
`ubuntu-latest` has it.

## Make it a required check

A failing job does not stop a merge on its own:

| Provider | Where | What to turn on |
| --- | --- | --- |
| GitHub | Settings → Rules → Rulesets (or Branches) | **Require status checks to pass** and select `spec-gate`. Push a branch once first, so GitHub has seen the job. |
| GitLab | Settings → Merge requests | **Pipelines must succeed** |
| Azure DevOps | Repos → Branches → your branch → Branch policies | **Build validation** with the pipeline, set to **Required** |
| Jenkins | Your SCM's branch protection | Require the status Jenkins reports for the `Spec gate` stage — the GitHub or Bitbucket Branch Source plugin reports it |

Protect `develop` too if you merge features into it.
[Your team's first pull request](../first-pr.md) covers what the author and
the reviewer do once the check is in place.

## Pin the version, and move it on purpose

Every generated command runs `@rsaglobaltech/specgate@<version>`, the version
that wrote it. A release can make the gate stricter, and a pipeline must not
change under a green branch. To move to a new version:

1. Upgrade locally and run `specgate check`. Fix what the new version finds,
   or record it ([Adopt it without a red build](baselines.md)).
2. Change the version in the CI file — one search and replace — or write the
   job again with `specgate ci init --force` if you never edited it.
3. Open a pull request with both: CI proves the new gate on the same code.

`specgate update` refreshes the agent files after an upgrade; it does not
touch the CI file, which is yours.

## Secrets and caches

- **Private domain packs**: a `SPECOPS_TOKEN` secret with read access to their
  repository. The GitHub job passes it to the pack-drift step.
- **Quality checks** get environment variable *names* through `env:` in
  `harness.config.yaml` — `SONAR_TOKEN`, a registry token — and read their
  values from the CI's secrets. A value written in the file is refused.
- **Docker images**: `specgate quality doctor --pull` fetches every check's
  image ahead of the run. Cache them, or the dependency volumes
  (`specgate-m2`, `specgate-gradle`, `specgate-npm`), with your CI's cache.

## Several projects

- **A monorepo**: list its projects under `projects:` in
  `specops.config.yaml`, and `validate` at the root validates each one and
  fails with a summary per project.
- **Several repositories of one product**: one gate across them — see
  [Workspace](../workspace.md).

## Your own pipeline

Every gate command takes `--json`: one document on standard output with each
stage, its command, its result and its findings, each with a stable `code`
and a `fix`. Branch on `code`, never on the message. Exit codes are `0`,
`1` and `2`. The full contract: [The JSON contract](../agents.md#the-json-contract).

```bash
npx @rsaglobaltech/specgate@1.5.0 check . --ci --json > gate.json
```

## Next

- [Adopt it without a red build](baselines.md)
