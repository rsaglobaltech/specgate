# VHS-Tape — Spec-driven Liefer-Loop auf Deutsch, Java + Spring.
#
# Rendern mit:  bash scripts/demo/de/build-video.sh --real-agent
# build-video.sh setzt `specgate` (npx create-spec-driven-app@0.1.3) auf den
# PATH, wärmt den Pack- und Maven-Cache vor und exportiert die SPECGATE_*
# Variablen, die dieses Tape liest. Der Platzhalter %%HARNESS_SLEEP%% wird
# durch das Skript ersetzt (kürzere Wartezeit beim Stub, längere bei
# --real-agent / opencode).

Output scripts/demo/de/out/demo.mp4
Output scripts/demo/de/out/demo.gif

Require specgate

Set Shell bash
Set FontSize 22
Set Width 1920
Set Height 1080
Set Padding 32
Set Margin 0
Set Theme "Catppuccin Mocha"
Set TypingSpeed 75ms
Set PlaybackSpeed 1.0

# ── Vorbereitung (versteckt): isoliertes Arbeitsverzeichnis ──────────────────
Hide
Type "cd $(mktemp -d) && clear" Enter
Show
Sleep 1s

# ════════════════════════════════════════════════════════════════════════════
#  Intro
# ════════════════════════════════════════════════════════════════════════════
Type "# Spec-driven Lieferung — Spezifikation führt, KI-Agent implementiert, Gate entscheidet." Enter
Sleep 3.5s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 1 — Projekt anlegen (init)
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 1: Projekt aus einer YAML-Konfig anlegen (Java + Spring Boot)." Enter
Sleep 2s
Type "cat > smart-parking.yaml <<'EOF'" Enter
Type "PROJECT_NAME: Smart Parking" Enter
Type "PROJECT_SLUG: smart-parking" Enter
Type "PROJECT_TYPE: backend" Enter
Type "DOMAIN: parking operations" Enter
Type "STACK: Spring Boot 3.2, Java 21, Maven" Enter
Type "API_STYLE: REST with DTO boundaries" Enter
Type "TESTING: JUnit 5" Enter
Type "EOF" Enter
Sleep 1.2s
Type "specgate init --config ./smart-parking.yaml --out . --no-git" Enter
Sleep 4s
Type "cd smart-parking" Enter
Sleep 700ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 2 — Domain-Pack einbinden (specops add)
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 2: Domain-Pack einbinden — wie `npm install`, aber für Specs." Enter
Sleep 2s
Type "specgate specops add --pack-repo $SPECGATE_PACK_REPO --pack-version $SPECGATE_PACK_V1 \" Enter
Type "  --pack $SPECGATE_PACK_ID --cache-dir $SPECGATE_CACHE_DIR \" Enter
Type "  --var PROJECT_NAME='Smart Parking' --var PROJECT_SLUG=smart-parking --var DOMAIN='parking operations'" Enter
Sleep 4s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 3 — Was ist zu tun (plan)
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 3: plan zeigt offene Anforderungen — das ist unsere Aufgabenliste." Enter
Sleep 2s
Type "specgate plan | head -18" Enter
Sleep 7s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 4 — Validieren mit TDD-Gate
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 4: validate prüft Struktur und Traceability." Enter
Sleep 2s
Type "specgate validate . --strict-tdd" Enter
Sleep 3.5s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 5 — Maven-Projekt + Harness konfigurieren (mit prompt_prefix)
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 5: pom.xml, harness.config.yaml und einen project-weiten" Enter
Type "# prompt_prefix mit Rolle und Architektur-Regeln ablegen." Enter
Sleep 2.5s
Type "demo-seed-pom && demo-write-harness-config" Enter
Sleep 1.8s
Type "cat harness.config.yaml" Enter
Sleep 4.5s
Type "cat .harness/prompt-prefix.md" Enter
Sleep 5.5s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 6 — Initial-Commit, damit der Harness loslegen kann
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 6: Erstes Commit (der Harness verlangt einen sauberen Working Tree)." Enter
Sleep 2s
Type "git init -q && git add -A && git commit -qm 'initial: specs + pack + pom + harness config'" Enter
Sleep 2s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 7a — Vorschau des Prompts (harness prompt)
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 7: Erst zeigen, was opencode bekommen wird — Prefix + Fakten + Gherkin + AI_RULES." Enter
Sleep 2.5s
Type "specgate harness prompt REQ-000 | head -28" Enter
Sleep 8s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 7b — Der Harness: plan → Kontext → Agent → verify → done
# ════════════════════════════════════════════════════════════════════════════
Type "# Jetzt der echte Lauf — opencode schreibt Code, der Harness gated mit mvn test." Enter
Sleep 2.2s
Type "specgate harness run --req REQ-000" Enter
Sleep %%HARNESS_SLEEP%%
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 8 — Was der Agent geschrieben hat
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 8: Der Agent hat echten Java-Code auf einem eigenen Branch commitet." Enter
Sleep 2s
Type "git log --oneline harness/REQ-000 -3" Enter
Sleep 3.5s
Type "git switch harness/REQ-000 -q" Enter
Sleep 1s
Type "# Produktionscode:" Enter
Sleep 1.2s
Type "find src/main -name '*.java' | head -3 && echo --- && find src/main -name '*.java' | head -1 | xargs cat" Enter
Sleep 7s
Type "# Test:" Enter
Sleep 1.2s
Type "find src/test -name '*.java' | head -1 | xargs cat" Enter
Sleep 7s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 9 — Tests laufen wirklich grün
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 9: Den gleichen Gate-Test nochmal von Hand laufen lassen." Enter
Sleep 2s
Type "mvn -B test | tail -20" Enter
Sleep 8s
Type "# Matrix-Status für REQ-000:" Enter
Sleep 1.5s
Type "grep REQ-000 docs/specs/traceability.md | head -1" Enter
Sleep 4s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 10 — Pack-Version vergleichen
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 10: specops diff zeigt, ob das Projekt mit dem Pack synchron ist." Enter
Sleep 2s
Type "git switch main -q" Enter
Sleep 1s
Type "specgate specops diff --cache-dir $SPECGATE_CACHE_DIR | tail -6" Enter
Sleep 5s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Schritt 11 — Pack-Referenzgraph
# ════════════════════════════════════════════════════════════════════════════
Type "# Schritt 11: pack lint --graph rendert den REQ → UC → CMD/AGG/EVT Graph." Enter
Sleep 2s
Type "specgate pack lint --pack-root $SPECGATE_GRAPH_PACK_ROOT --pack $SPECGATE_PACK_ID --graph | head -16" Enter
Sleep 6s
Type "clear" Enter
Sleep 600ms

# ════════════════════════════════════════════════════════════════════════════
#  Outro
# ════════════════════════════════════════════════════════════════════════════
Type "# Specs als ausführbare Verträge. Echter Code, echte Tests, jeder Commit reviewbar." Enter
Sleep 2.5s
Type "# Vollständige Anleitung: docs/tutorial.md" Enter
Sleep 4s
