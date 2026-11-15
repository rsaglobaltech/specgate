/**
 * A change, as a page for people who do not read the repository (REQ-551).
 *
 * The people who decide whether a change is right — a product owner, an
 * operations lead, a client — do not open Markdown in a pull request. They
 * open a file someone mailed them. So the page is one HTML file with nothing
 * outside it: no script, no stylesheet, no font, no image to fetch. It opens
 * from a mail attachment, offline, and it cannot phone home.
 *
 * Every value is escaped: the change's text is the author's, and an author can
 * write `<script>`. Pure: the change in, the page out.
 */

export interface ReviewRequirement {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly status: string;
  readonly scenarios: ReadonlyArray<{ readonly title: string; readonly steps: readonly string[] }>;
}

export interface ReviewQuestion {
  readonly id: string;
  readonly text: string;
  readonly answered: boolean;
}

export interface ReviewPageInput {
  readonly change: string;
  readonly title: string;
  readonly intent: string;
  readonly kind: string;
  readonly requirements: readonly ReviewRequirement[];
  readonly questions: readonly ReviewQuestion[];
  /** Each assumption as one line of text. */
  readonly assumptions: readonly string[];
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** The commit it was made from, or "" outside git. */
  readonly commit: string;
}

/** HTML-escaped, attribute-safe. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `GIVEN a paid invoice` → `Given a paid invoice`. */
const plainStep = (s: string) =>
  s.replace(/^(GIVEN|WHEN|THEN|AND|BUT)\b/i, (k) => k[0].toUpperCase() + k.slice(1).toLowerCase());

/** Markdown emphasis and code marks removed: the page is prose, not source. */
const plain = (s: string) =>
  s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();

const STYLE = `
:root { color-scheme: light dark; --bg:#f7f8fa; --fg:#1a1a1a; --muted:#666; --card:#fff; --line:#e3e5e8; --accent:#2457c5; --warn:#a15c00; }
@media (prefers-color-scheme: dark) { :root { --bg:#16181d; --fg:#e6e6e6; --muted:#9aa0a6; --card:#1f2228; --line:#30343b; --accent:#8ab4f8; --warn:#f0b35a; } }
* { box-sizing: border-box; }
body { margin:0; padding:2rem 1rem; background:var(--bg); color:var(--fg);
  font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
main { max-width: 760px; margin: 0 auto; }
h1 { font-size:1.5rem; margin:0 0 .25rem; } h2 { font-size:1.15rem; margin:2rem 0 .75rem; }
.meta { color:var(--muted); font-size:.85rem; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:1rem 1.25rem; margin:0 0 1rem; }
.card h3 { margin:0 0 .25rem; font-size:1.05rem; }
.status { display:inline-block; font-size:.75rem; padding:.05rem .5rem; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.scenario { margin:.75rem 0 0; } .scenario p { margin:0 0 .25rem; font-weight:600; }
ol { margin:.25rem 0 0 1.25rem; padding:0; }
.open { color:var(--warn); font-weight:600; }
`;

/** The page. */
export function renderReviewPage(r: ReviewPageInput): string {
  const e = escapeHtml;
  const reqs = r.requirements
    .map(
      (q) => `<section class="card">
<h3>${e(q.title || q.id)} <span class="status">${e(q.status || "Draft")}</span></h3>
<p class="meta">${e(q.id)}</p>
${q.text ? `<p>${e(plain(q.text))}</p>` : ""}
${q.scenarios
  .map(
    (s) =>
      `<div class="scenario"><p>${e(plain(s.title))}</p><ol>${s.steps
        .map((x) => `<li>${e(plainStep(plain(x)))}</li>`)
        .join("")}</ol></div>`
  )
  .join("\n")}
</section>`
    )
    .join("\n");
  const open = r.questions.filter((q) => !q.answered);
  const questions = r.questions.length
    ? `<h2>Questions</h2><ul>${r.questions
        .map(
          (q) =>
            `<li>${q.answered ? "" : '<span class="open">Open — </span>'}${e(plain(q.text))} <span class="meta">${e(q.id)}</span></li>`
        )
        .join("")}</ul>`
    : "";
  const assumptions = r.assumptions.length
    ? `<h2>Assumptions</h2><ul>${r.assumptions.map((a) => `<li>${e(plain(a))}</li>`).join("")}</ul>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(r.title || r.change)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${e(r.title || r.change)}</h1>
<p class="meta">${e(r.change)}${r.kind ? ` · ${e(r.kind)}` : ""} · ${e(r.date)}${r.commit ? ` · ${e(r.commit.slice(0, 12))}` : ""}${open.length ? ` · <span class="open">${open.length} open question(s)</span>` : ""}</p>
${r.intent ? `<h2>Why</h2><p>${e(plain(r.intent))}</p>` : ""}
<h2>What it asks for</h2>
${reqs || '<p class="meta">No requirement yet.</p>'}
${questions}
${assumptions}
</main>
</body>
</html>
`;
}
