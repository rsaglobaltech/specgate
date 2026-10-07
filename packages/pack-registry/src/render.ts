"use strict";

/**
 * Pure module — renders pack metadata to HTML strings.
 * No fs or DOM dependency.
 */

function escape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOMAIN_META = {
  auth: { tagline: "Authentication, JWT, OAuth2, RBAC & MFA" },
  billing: { tagline: "Subscriptions, invoicing & payment processing" },
  "audit-log": { tagline: "Immutable event trail, GDPR-compliant queries" },
  notifications: { tagline: "Email, SMS, push & in-app delivery channels" },
  "feature-flags": { tagline: "Gradual rollouts, A/B targeting & kill-switches" },
  "multi-tenant": { tagline: "Tenant isolation, row-level security & onboarding" },
  "file-storage": { tagline: "Upload pipeline, CDN delivery & virus scanning" },
  search: { tagline: "Full-text, facets, elasticsearch/pgvector adapters" },
  reporting: { tagline: "Scheduled reports, export formats & dashboards" },
  webhooks: { tagline: "Event delivery, retry logic & HMAC signing" },
};

/**
 * Lint status as a word, not as a colour.
 *
 * These used to carry hard-coded dark-mode hexes inline, which won on
 * specificity over the stylesheet and made the badges the only thing on the
 * site that ignored the theme. The colour now comes from the same tokens as
 * everything else.
 */
const STATUS_LABELS = {
  pass: "verified",
  warn: "warnings",
  fail: "failed",
};

function renderBadge(status) {
  const label = STATUS_LABELS[status] || status;
  const known = Object.prototype.hasOwnProperty.call(STATUS_LABELS, status);
  const cls = known ? ` badge--${status}` : "";
  return `<span class="badge${cls}">${escape(label)}</span>`;
}

function renderStat(label, value) {
  return `<div class="stat"><span class="stat__val">${escape(String(value))}</span><span class="stat__label">${escape(label)}</span></div>`;
}

function shortName(fullName) {
  return fullName
    .replace(/\s+Backend Domain Pack$/i, "")
    .replace(/\s+Domain Pack$/i, "")
    .trim();
}

/**
 * The command a reader copies. It installs the pack from this repository,
 * pinned to a release tag, the way `specops add` pins any pack. It used to be
 * `npx create-spec-driven-app expand --pack-root ./packs …` — the tool's old
 * name, which installs a different package, against a `./packs` folder the
 * reader does not have.
 */
function installCommand(pack, version) {
  return `specgate specops add \\
  --pack-repo https://github.com/rsaglobaltech/specgate.git \\
  --pack-version v${escape(version)} \\
  --pack packs/${escape(pack.id)} \\
  --var PROJECT_NAME="My App" \\
  --var PROJECT_SLUG=my-app \\
  --var DOMAIN="${escape(pack.domain)}"`;
}

/** Two letters for a domain: `audit-log` → "AL", `search` → "SE". No emoji. */
function monogram(domain) {
  const parts = String(domain || "?")
    .split(/[-_\s]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

function renderCard(pack, version = "0.0.0") {
  const dm = DOMAIN_META[pack.domain] || { tagline: pack.description || "" };
  const tagline = dm.tagline || pack.description || "";
  const expandCmd = installCommand(pack, version);

  const lintSection =
    pack.lintMessages.length > 0
      ? `<details class="lint-details"><summary>${pack.lintMessages.length} lint message(s)</summary><ul class="lint-list">${pack.lintMessages.map((m) => `<li>${escape(m)}</li>`).join("")}</ul></details>`
      : "";

  return `
<article class="card" data-name="${escape(shortName(pack.name).toLowerCase())}" data-id="${escape(pack.id.toLowerCase())}">
  <div class="card__head">
    <span class="card__mono" aria-hidden="true">${escape(monogram(pack.domain))}</span>
    <div class="card__title-block">
      <h2 class="card__name">${escape(shortName(pack.name))}</h2>
      <span class="card__id">${escape(pack.id)}</span>
    </div>
    ${renderBadge(pack.lintStatus)}
  </div>
  <p class="card__tagline">${escape(tagline)}</p>
  <div class="card__stats">
    ${renderStat("req", pack.requirements)}
    ${renderStat("use cases", pack.useCases)}
    ${renderStat("aggregates", pack.aggregates)}
    ${renderStat("events", pack.events)}
    ${renderStat("scenarios", pack.scenarios)}
  </div>
  <div class="card__cmd-wrap">
    <pre class="card__cmd" id="cmd-${escape(pack.id.replace("/", "-"))}">${expandCmd}</pre>
    <button class="card__copy" data-target="cmd-${escape(pack.id.replace("/", "-"))}" aria-label="Copy expand command">Copy</button>
  </div>
  <div class="card__foot">
    <span class="card__ver">v${escape(pack.version)}</span>
    <span class="card__lang">${escape(pack.language.toUpperCase())}</span>
    <span class="card__type">${escape(pack.project_type)}</span>
  </div>
  ${lintSection}
</article>`;
}

function renderIndex(packs, options: any = {}) {
  const title = options.title || "Specgate domain packs";
  const generated = options.generated || new Date().toISOString();
  const passed = packs.filter((p) => p.lintStatus === "pass").length;
  const totalReqs = packs.reduce((s, p) => s + p.requirements, 0);
  const totalScenarios = packs.reduce((s, p) => s + p.scenarios, 0);

  const cards = packs.map((p) => renderCard(p, options.version)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escape(title)}</title>
<meta name="description" content="Browse ${packs.length} curated domain packs for Specgate. Each pack ships requirements, use cases, DDD aggregates, events, and Gherkin scenarios.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${escape(title)}">
<meta property="og:image" content="https://rsaglobaltech.github.io/specgate/assets/og-card.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/docs.css">
<script>
  // Same pre-paint theme read as the rest of the site, so following a link here
  // does not flip from light to dark.
  (function () {
    var t = localStorage.getItem("csda-theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  })();
</script>
<style>
  /* The pack gallery, in the site's Editorial direction. Every colour is a
     docs.css token, so both themes follow. */
  .registry { width: 100%; max-width: 76rem; margin: 0 auto; padding: clamp(3rem, 7vw, 5rem) clamp(1rem, 4vw, 2.5rem) 4rem; }
  .registry__eyebrow { margin: 0 0 1rem; font-size: 0.75rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
  .registry h1 { margin: 0; font-family: var(--serif); font-weight: 400; font-size: clamp(2.5rem, 5vw, 4rem); line-height: 1.04; letter-spacing: -0.025em; }
  .registry__lede { max-width: 42rem; margin: 1.25rem 0 0; font-size: 1.12rem; color: var(--fg-soft); }

  .stats { margin: 2.5rem 0 0; padding: 1.5rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
           display: grid; grid-template-columns: repeat(auto-fit, minmax(min(9rem, 100%), 1fr)); gap: 1.5rem; }
  .stats div { display: flex; align-items: baseline; gap: .6rem; }
  .stats dt { font-family: var(--serif); font-size: 2.2rem; line-height: 1; color: var(--accent); }
  .stats dd { margin: 0; color: var(--fg-soft); font-size: .85rem; }

  .toolbar { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; margin: 3rem 0 1.5rem; }
  .toolbar h2 { margin: 0; font-family: var(--serif); font-weight: 400; font-size: 1.8rem; }
  .toolbar__right { display: flex; gap: .75rem; align-items: center; }
  .toolbar input[type="search"] {
    min-width: min(20rem, 70vw); min-height: 2.75rem; padding: 0 1rem;
    border: 1px solid var(--line-strong); border-radius: 999px; background: var(--bg-raised);
    color: var(--fg); font: inherit;
  }
  .toolbar input[type="search"]:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
  .count-badge { font-size: .8rem; color: var(--fg-faint); white-space: nowrap; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(21rem, 100%), 1fr)); gap: 1rem; }
  .card {
    display: flex; flex-direction: column; gap: .9rem; min-width: 0;
    padding: 1.5rem; background: var(--bg-raised); border: 1px solid var(--line); border-radius: 16px;
    transition: transform .25s, box-shadow .25s;
  }
  .card:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
  .card.hidden { display: none; }
  .card__head { display: flex; gap: .85rem; align-items: center; }
  .card__mono {
    display: inline-grid; place-items: center; flex: none; width: 2.6rem; height: 2.6rem; border-radius: 10px;
    background: var(--accent-soft); color: var(--accent); font-family: var(--mono); font-size: .8rem; font-weight: 500;
  }
  .card__title-block { display: flex; flex-direction: column; min-width: 0; flex-grow: 1; }
  .card__name { margin: 0; font-family: var(--serif); font-weight: 500; font-size: 1.35rem; line-height: 1.2; }
  .card__id { font-family: var(--mono); font-size: .75rem; color: var(--fg-faint); }
  .card__tagline { margin: 0; color: var(--fg-soft); }
  .card__stats { display: flex; flex-wrap: wrap; gap: .35rem 1rem; font-size: .82rem; color: var(--fg-soft); }
  .stat { display: inline-flex; gap: .3rem; }
  .stat__val { font-weight: 600; color: var(--fg); }

  .badge { flex: none; font-size: .68rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
           padding: .2rem .55rem; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--fg-soft); }
  .badge--pass { color: var(--green); border-color: currentColor; }
  .badge--warn { color: var(--amber); border-color: currentColor; }
  .badge--fail { color: var(--red); border-color: currentColor; }

  .card__cmd-wrap { position: relative; margin-top: auto; }
  .card__cmd {
    margin: 0; padding: 2.9rem 1rem .9rem; overflow-x: auto;
    background: var(--bg-code); border: 1px solid var(--line); border-radius: 10px;
    font-family: var(--mono); font-size: .72rem; line-height: 1.6; color: var(--fg);
  }
  .card__copy {
    position: absolute; top: .5rem; right: .5rem; min-height: 2rem; padding: 0 .75rem;
    border: 1px solid var(--line-strong); border-radius: 999px; background: var(--bg-raised);
    color: var(--fg-soft); font: inherit; font-size: .75rem; cursor: pointer;
  }
  .card__copy:hover, .card__copy.copied { color: var(--accent); border-color: var(--accent); }
  .card__foot { display: flex; gap: .4rem; flex-wrap: wrap; }
  .card__ver, .card__lang, .card__type {
    font-family: var(--mono); font-size: .68rem; color: var(--fg-faint);
    border: 1px solid var(--line); border-radius: 999px; padding: .1rem .55rem;
  }

  .lint-details { font-size: .8rem; color: var(--fg-soft); }
  .lint-details summary { cursor: pointer; }
  .lint-list { margin: .5rem 0 0; padding-left: 1.1rem; }

  .top__links { margin-left: auto; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .no-results { display: none; color: var(--fg-soft); grid-column: 1 / -1; }
  .no-results.visible { display: block; }

  .foot { border-top: 1px solid var(--line); }
  .foot .wrap { max-width: 76rem; margin: 0 auto; padding: 2rem clamp(1rem, 4vw, 2.5rem); font-size: .85rem; color: var(--fg-soft); }
  .foot__note { color: var(--fg-faint); font-size: .78rem; }
</style>
</head>
<body>

<a class="skip" href="#packs">Skip to the packs</a>

<header class="top">
  <a class="top__brand" href="../index.html"><span aria-hidden="true">⬡</span> Specgate</a>
  <nav class="top__links">
    <a href="../docs.html">Docs</a>
    <a href="../domain-packs.html">Using packs</a>
    <a href="https://github.com/rsaglobaltech/specgate" target="_blank" rel="noreferrer">GitHub</a>
  </nav>
  <button class="top__theme" type="button" aria-label="Switch theme">◐</button>
</header>

<main class="registry" id="packs">
  <p class="registry__eyebrow">Domain knowledge as a dependency</p>
  <h1>${escape(title)}</h1>
  <p class="registry__lede">
    Curated, versioned requirement sets — use cases, aggregates, events and
    Gherkin scenarios — that you install like a dependency, pin by tag and
    upgrade through a reviewable diff. <a href="../domain-packs.html">How packs work →</a>
  </p>

  <dl class="stats">
    <div><dt>${packs.length}</dt><dd>packs</dd></div>
    <div><dt>${passed}</dt><dd>passing lint</dd></div>
    <div><dt>${totalReqs}</dt><dd>requirements</dd></div>
    <div><dt>${totalScenarios}</dt><dd>scenarios</dd></div>
  </dl>

  <div class="toolbar">
    <h2>All packs</h2>
    <div class="toolbar__right">
      <label class="sr-only" for="search">Search packs</label>
      <input type="search" id="search" placeholder="Search packs…" autocomplete="off">
      <span class="count-badge" id="visible-count">${packs.length} shown</span>
    </div>
  </div>
  <div class="grid" id="pack-grid">
${cards}
    <p class="no-results" id="no-results">No packs match your search.</p>
  </div>
</main>

<footer class="foot">
  <div class="wrap">
    <p>
      <strong>Specgate</strong> ·
      <a href="../docs.html">Docs</a> ·
      <a href="./manifest.json">manifest.json</a> ·
    <a href="https://github.com/rsaglobaltech/specgate" target="_blank" rel="noreferrer">GitHub</a>
    </p>
    <p class="foot__note">
      Generated ${escape(generated)} from <code>packs/&lt;domain&gt;/&lt;type&gt;/pack.yaml</code>.
      Submit a pack by opening a pull request that adds one.
    </p>
  </div>
</footer>

<!-- The theme toggle and the pre-paint read come from the site's own script;
     what follows is the pack filter, which only this page has. -->
<script src="../assets/docs.js" defer></script>
<script>
(function () {
  const input = document.getElementById('search');
  const grid  = document.getElementById('pack-grid');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const noRes = document.getElementById('no-results');
  const countEl = document.getElementById('visible-count');

  function filterCards(q) {
    const term = q.trim().toLowerCase();
    let visible = 0;
    cards.forEach(function (card) {
      const match = !term
        || card.dataset.name.includes(term)
        || card.dataset.id.includes(term);
      card.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    countEl.textContent = visible + ' shown';
    noRes.classList.toggle('visible', visible === 0);
  }

  input.addEventListener('input', function () { filterCards(input.value); });

  // Copy-to-clipboard
  grid.addEventListener('click', function (e) {
    const btn = e.target.closest('.card__copy');
    if (!btn) return;
    const pre = document.getElementById(btn.dataset.target);
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent).then(function () {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 1500);
    }).catch(function () {
      btn.textContent = 'Copy manually';
    });
  });
})();
</script>
</body>
</html>`;
}

export { renderIndex, renderCard, escape };
