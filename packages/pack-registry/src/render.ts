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
  auth: { icon: "🔐", tagline: "Authentication, JWT, OAuth2, RBAC & MFA" },
  billing: { icon: "💳", tagline: "Subscriptions, invoicing & payment processing" },
  "audit-log": { icon: "📋", tagline: "Immutable event trail, GDPR-compliant queries" },
  notifications: { icon: "🔔", tagline: "Email, SMS, push & in-app delivery channels" },
  "feature-flags": { icon: "🚩", tagline: "Gradual rollouts, A/B targeting & kill-switches" },
  "multi-tenant": { icon: "🏢", tagline: "Tenant isolation, row-level security & onboarding" },
  "file-storage": { icon: "📁", tagline: "Upload pipeline, CDN delivery & virus scanning" },
  search: { icon: "🔍", tagline: "Full-text, facets, elasticsearch/pgvector adapters" },
  reporting: { icon: "📊", tagline: "Scheduled reports, export formats & dashboards" },
  webhooks: { icon: "🪝", tagline: "Event delivery, retry logic & HMAC signing" },
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

function renderCard(pack, version = "0.0.0") {
  const dm = DOMAIN_META[pack.domain] || { icon: "📦", tagline: pack.description || "" };
  const tagline = dm.tagline || pack.description || "";
  const expandCmd = installCommand(pack, version);

  const lintSection =
    pack.lintMessages.length > 0
      ? `<details class="lint-details"><summary>${pack.lintMessages.length} lint message(s)</summary><ul class="lint-list">${pack.lintMessages.map((m) => `<li>${escape(m)}</li>`).join("")}</ul></details>`
      : "";

  return `
<article class="card" data-name="${escape(shortName(pack.name).toLowerCase())}" data-id="${escape(pack.id.toLowerCase())}">
  <div class="card__head">
    <span class="card__icon">${dm.icon}</span>
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
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
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
  /*
   * The registry is a card grid, so it needs layout of its own — but the
   * header, footer, colours, fonts and theme all come from assets/docs.css,
   * the same file every documentation page uses. It used to carry a second
   * palette and a second top bar, which is what made it read as a different
   * site.
   */

  .registry { padding: 2.5rem 0 4rem; }

  .registry h1 {
    font-size: clamp(1.8rem, 4vw, 2.4rem);
    letter-spacing: -0.02em;
    margin: 0 0 0.75rem;
  }

  .registry__lede {
    max-width: 42rem;
    color: var(--fg-soft);
    line-height: 1.7;
    margin: 0 0 2rem;
  }
  .registry__lede code {
    font-family: var(--mono);
    font-size: 0.86em;
    background: var(--bg-code);
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 0.1em 0.35em;
    color: var(--fg);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 1.25rem;
    margin: 0 0 3rem;
    padding: 1.5rem 0;
    border-block: 1px solid var(--line);
  }
  .stats div { text-align: center; }
  .stats dt {
    font-family: var(--mono);
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--accent);
    line-height: 1;
  }
  .stats dd { margin: 0.35rem 0 0; font-size: 0.8rem; color: var(--fg-soft); }

  .grid-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.1rem;
  }
  .grid-header h2 { font-size: 1.2rem; margin: 0; }
  .count-badge {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--fg-soft);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
    gap: 1rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.15rem;
    background: var(--bg-soft);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .card:hover { border-color: var(--accent); }
  .card.hidden { display: none; }

  .card__head { display: flex; align-items: flex-start; gap: 0.7rem; }
  .card__icon { font-size: 1.3rem; line-height: 1.2; }
  .card__title-block { flex: 1; min-width: 0; }
  .card__name { font-size: 1rem; margin: 0; }
  .card__id {
    font-family: var(--mono);
    font-size: 0.74rem;
    color: var(--fg-faint);
  }

  .badge {
    font-family: var(--mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 999px;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--line);
    color: var(--fg-soft);
    white-space: nowrap;
  }
  .badge--pass { color: var(--green); border-color: color-mix(in srgb, var(--green) 45%, transparent); }
  .badge--warn { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 45%, transparent); }
  .badge--fail { color: var(--red); border-color: color-mix(in srgb, var(--red) 45%, transparent); }

  .card__tagline { margin: 0; font-size: 0.88rem; color: var(--fg-soft); line-height: 1.55; }

  .card__stats { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
  .stat { font-size: 0.78rem; color: var(--fg-soft); }
  .stat__val { font-family: var(--mono); font-weight: 600; color: var(--fg); }
  .stat__label { margin-left: 0.25rem; }

  .card__cmd-wrap { position: relative; margin-top: auto; }
  .card__cmd {
    margin: 0;
    padding: 0.6rem 4rem 0.6rem 0.7rem;
    background: var(--bg-code);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--mono);
    font-size: 0.74rem;
    overflow-x: auto;
    white-space: pre;
    color: var(--fg);
  }
  .card__copy {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--fg-soft);
    cursor: pointer;
    font-family: var(--sans);
    font-size: 0.7rem;
    padding: 0.15rem 0.45rem;
  }
  .card__copy:hover { color: var(--fg); border-color: var(--accent); }
  .card__copy.copied { color: var(--green); border-color: var(--green); }

  .card__foot {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding-top: 0.6rem;
    border-top: 1px solid var(--line);
  }
  .card__ver, .card__lang, .card__type {
    font-family: var(--mono);
    font-size: 0.68rem;
    color: var(--fg-faint);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.05rem 0.35rem;
  }

  .lint-details { font-size: 0.8rem; color: var(--fg-soft); }
  .lint-details summary { cursor: pointer; }
  .lint-list { margin: 0.5rem 0 0; padding-left: 1.1rem; }

  .no-results { display: none; color: var(--fg-soft); grid-column: 1 / -1; }
  .no-results.visible { display: block; }

  @media (max-width: 700px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<a class="skip" href="#packs">Skip to the packs</a>

<header class="top">
  <a class="top__brand" href="../index.html"><span aria-hidden="true">⬡</span> Specgate</a>
  <div class="top__search">
    <input type="search" id="search" placeholder="Search packs…" aria-label="Search packs" autocomplete="off">
  </div>
  <nav class="top__links">
    <a href="../docs.html">Docs</a>
    <a href="../domain-packs.html">Using packs</a>
    <a href="https://github.com/rsaglobaltech/specgate" target="_blank" rel="noreferrer">GitHub</a>
  </nav>
  <button class="top__theme" type="button" aria-label="Switch theme">◐</button>
</header>

<main class="wrap registry" id="packs">
  <h1>${escape(title)}</h1>
  <p class="registry__lede">
    Curated domain packs for <code>specgate</code>. Each ships
    requirements, use cases, aggregates, events and Gherkin scenarios, ready to
    expand into a project — see <a href="../domain-packs.html">Domain packs</a>
    for what that means and how to write your own.
  </p>

  <dl class="stats">
    <div><dt>${packs.length}</dt><dd>packs</dd></div>
    <div><dt>${passed}</dt><dd>passing lint</dd></div>
    <div><dt>${totalReqs}</dt><dd>requirements</dd></div>
    <div><dt>${totalScenarios}</dt><dd>scenarios</dd></div>
  </dl>

  <div class="grid-header">
    <h2>All packs</h2>
    <span class="count-badge" id="visible-count">${packs.length} shown</span>
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
