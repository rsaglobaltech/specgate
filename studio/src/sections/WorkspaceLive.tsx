/**
 * REQ-566 (REQ-320..323, REQ-411): a workspace's Live — each repository's
 * harness, each story's parts and what they wait on, and what it all cost —
 * in the studio, read from `/live/stream` as the workspace's studio pushes it.
 * Each repository leads to its own Live, at `/live/repo/<name>/`.
 */
import { t, type Lang } from "../core/i18n";

export interface WorkspaceCost {
  money: number | null;
  minutes: number;
}

export interface WorkspaceLiveData {
  name: string;
  repos: Array<{
    name: string;
    role: string;
    exists: boolean;
    queue: string[];
    inFlight: {
      req: string;
      title: string;
      attempt: number;
      phase: string;
      agent: { kind: string; target: string } | null;
    } | null;
    requirements: { running: number; pass: number; fail: number };
    cost: WorkspaceCost;
  }>;
  stories: Array<{
    id: string;
    title: string;
    done: boolean;
    subchanges: Array<{
      repo: string;
      change: string;
      state: string;
      requirements: string[];
      blockedBy: string[];
    }>;
    cost: WorkspaceCost;
  }>;
}

const costOf = (lang: Lang, c: WorkspaceCost) =>
  `${c.money === null ? "—" : `$${c.money.toFixed(2)}`} · ${t(lang, "wsMinutes").replace(
    "{N}",
    String(Math.round(c.minutes))
  )}`;

export function WorkspaceLive({ lang, data }: { lang: Lang; data: WorkspaceLiveData }) {
  return (
    <>
      <header class="head">
        <h1>{t(lang, "wsLiveTitle").replace("{NAME}", data.name)}</h1>
        <p class="lead">{t(lang, "wsLiveLead")}</p>
      </header>
      <div class="card">
        <h3>{t(lang, "wsRepos")}</h3>
        {data.repos.map((r) => (
          <div class={`check ${r.exists ? "" : "warn-line"}`}>
            <span aria-hidden="true">{r.inFlight ? "▶" : r.exists ? "·" : "!"}</span>
            <span class="grow">
              <a href={`/live/repo/${encodeURIComponent(r.name)}/`}>
                <strong>{r.name}</strong>
              </a>{" "}
              <span class="faint">{r.role}</span>
              <br />
              {!r.exists ? (
                <span class="faint">{t(lang, "wsMissing")}</span>
              ) : r.inFlight ? (
                <span>
                  {r.inFlight.req} — {r.inFlight.title} · {t(lang, "wsAttempt")}{" "}
                  {r.inFlight.attempt} · {r.inFlight.phase}
                  {r.inFlight.agent ? ` · ${r.inFlight.agent.kind} ${r.inFlight.agent.target}` : ""}
                </span>
              ) : (
                <span class="faint">{t(lang, "wsIdle")}</span>
              )}
              <br />
              <span class="faint">
                {t(lang, "wsCounts")
                  .replace("{Q}", String(r.queue.length))
                  .replace("{P}", String(r.requirements.pass))
                  .replace("{F}", String(r.requirements.fail))}{" "}
                · {costOf(lang, r.cost)}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div class="card">
        <h3>{t(lang, "wsStories")}</h3>
        {data.stories.length === 0 ? <p class="faint">{t(lang, "wsNoStories")}</p> : null}
        {data.stories.map((s) => (
          <div class={`check ${s.done ? "ok-line" : ""}`}>
            <span aria-hidden="true">{s.done ? "✓" : "○"}</span>
            <span class="grow">
              <strong>{s.id}</strong> {s.title}
              <br />
              {s.subchanges.map((p) => (
                <span class="faint">
                  {p.repo}: {p.change} · {p.state}
                  {p.blockedBy.length
                    ? ` · ${t(lang, "wsWaitsOn").replace("{LIST}", p.blockedBy.join(", "))}`
                    : ""}
                  <br />
                </span>
              ))}
              <span class="faint">{costOf(lang, s.cost)}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
