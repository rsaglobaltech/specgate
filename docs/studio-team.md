# The studio for a team

At the end of this page several people use one studio, each with a role: a
reader sees everything and changes nothing, an editor's changes arrive as pull
requests, and nothing is ever committed to your base branch from the studio.

**You need:** the project in git with an `origin` remote, a sign-in proxy your
team already uses (oauth2-proxy with GitHub or GitLab, Cloudflare Access,
Google IAP, an ingress with sign-in…), and a GitHub token that may open pull
requests.

## How sign-in works

Specgate signs nobody in. `specgate studio --team` runs behind your proxy, and
the proxy tells the studio who is asking with a header (`X-Forwarded-User`
unless you name another). The studio keeps no password, no OAuth secret and
no session.

- A request without the header is refused with `sign_in_required`.
- With `SPECGATE_PROXY_SECRET` set, a request must also carry the header
  `X-Specgate-Proxy-Secret` with that value, which your proxy adds. Set it:
  without it, anyone who can reach the studio's port directly can claim to be
  any user, and the studio says so when it starts.

## Roles: `studio.team.yaml`

```yaml
user_header: X-Forwarded-User     # what your proxy sets
email_header: X-Forwarded-Email   # optional: the commit author's address
base: main                        # where pull requests go (default: pr.base)
hosts: [studio.example.com]       # the name the proxy serves it under
origins: [https://studio.example.com]
roles:
  ana: reader
  luis: editor
  marta: admin
```

| Role | Reads | Answers, approves, notes, edits the brief | Builds, runs agents, changes settings |
| --- | --- | --- | --- |
| `reader` | yes | refused (`role_forbidden`) | refused |
| `editor` | yes | yes, as a pull request | refused |
| `admin` | yes | yes, as a pull request | yes |

Anyone the file does not list is a `reader`.

## Edits arrive as pull requests

When an editor answers a question in the change `pdf-invoices`, the studio:

1. writes the answer in a worktree of the branch `studio/<user>/pdf-invoices`,
   started from the base branch;
2. commits it with that user as the author;
3. pushes the branch and opens a pull request to the base, or updates the one
   already open, using the `pr:` block of `alm.config.yaml`:

```yaml
pr:
  provider: github
  repo: acme/shop
  base: main
  token_env: GITHUB_TOKEN
```

The studio's answer carries the pull request's URL. The base branch and the
studio's own working copy are never written. Specgate never merges: the pull
request is reviewed like any other.

## Run it

```bash
SPECGATE_PROXY_SECRET=… GITHUB_TOKEN=… specgate studio --team --port 4173
```

The studio keeps listening on 127.0.0.1. Put the proxy on the same host, in
front of that port. Without `--team`, the studio is the local one, with no
sign-in and no roles.

## Next

- [The studio](studio.md)
- [From a Jira ticket](from-a-ticket.md)
