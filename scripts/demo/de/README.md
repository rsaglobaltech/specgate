# 🎬 Kollegen-Demo (Deutsch · Java + Spring)

1080p-Demo des spec-driven Tagesablaufs auf einem **Java + Spring**-Stack,
mit deutscher Bildschirm-Beschriftung und (optional) deutscher Voice-over.
Der Harness ruft **echtes opencode** auf — der Agent schreibt echten
Java-Code, `mvn test` läuft wirklich, und am Ende landet das Ergebnis auf
einem reviewbaren Git-Branch.

> Diese Variante existiert parallel zur englischen Node-Demo in
> [`../`](..). Die Logik ist gleich, nur Sprache, Stack und Agent
> unterscheiden sich.

## Echter Spring-Boot-Stack mit Cucumber

Das eingebettete `pom.xml.tpl` ist kein "JUnit-only"-Spielzeug, sondern
ein realistisches Spring-Boot-3-Projekt:

| Dependency                                            | Wofür                                    |
| ----------------------------------------------------- | ---------------------------------------- |
| `spring-boot-starter-web`                             | echter `@RestController` im `src/main`   |
| `spring-boot-starter-test`                            | JUnit 5, AssertJ, MockMvc                |
| `io.cucumber:cucumber-java`                           | Step-Definitionen                        |
| `io.cucumber:cucumber-junit-platform-engine`          | Cucumber läuft als JUnit-Platform-Engine |
| `org.testcontainers:testcontainers` + `junit-jupiter` | Container-Tests für DB/Queue-REQs        |

Der Stub-Agent (und ebenso opencode im `--real-agent`-Modus) schreibt
einen `SmartParkingApplication`, einen `HealthController`, einen
`RunCucumberTest`-Suite-Runner und `HealthSteps.java`. Dazu kommt eine
`junit-platform.properties`, die Cucumber auf die `.feature`-Datei aus dem
Pack zeigt — `mvn test` führt das Gherkin-Szenario also **wirklich aus**.

> **Why does the demo seed `pom.xml`?** Specgate ist bewusst stack-agnostisch
> und bringt kein Build-System mit. In einem echten Projekt käme dieses
> `pom.xml` von Spring Initializr oder einem Team-Archetype. Im Demo
> seedet `build-video.sh` es als reines Demo-Plumbing, damit `mvn test`
> als Harness-Gate funktioniert. Der Cucumber-Filter zeigt zunächst nur
> auf `features/core/health.feature`; sobald weitere Anforderungen
> implementiert sind, weitet ihr `cucumber.features` oder filtert per Tag.

## Was zeigt das Video

Jedes Feature, eingebettet in den Tagesablauf:

1. `specgate init` — Projekt aus YAML-Konfig anlegen
2. `specgate specops add` — Domain-Pack einbinden (echtes
   `parking-management-specops`)
3. `specgate plan` — was noch zu tun ist
4. `specgate validate --strict-tdd` — Gate auf grün
5. Maven-`pom.xml` und `harness.config.yaml` ablegen
6. `git init && git commit` — sauberer Working Tree
7. **`specgate harness run --req REQ-000`** — opencode bekommt den Prompt,
   schreibt `HealthService.java` + `HealthServiceTest.java`, der Harness
   bestätigt mit validate + `mvn -o test` und commitet auf
   `harness/REQ-000`
8. `cat` der Agent-Dateien
9. `mvn -B -o test` — Tests laufen real grün
10. `specgate specops diff` — Pack-Sync prüfen
11. `specgate pack lint --graph` — Domain-Modell visualisieren

## Verwendete CLI-Version

Standardmäßig nutzt das Build-Skript die **lokale CLI dieses Checkouts**,
damit dein laufender PR sichtbar ist. Für die Kollegen-Aufnahme nimm die
gerade veröffentlichte Version:

```bash
SPECGATE_CLI_PKG=create-spec-driven-app@0.1.4 bash scripts/demo/de/build-video.sh --real-agent
# oder die jeweils neueste:
SPECGATE_CLI_PKG=create-spec-driven-app@latest bash scripts/demo/de/build-video.sh --real-agent
```

## Zwei Agent-Modi

| Modus              | Flag           | Was er macht                                                                                                                 |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Stub** (Default) | _(keiner)_     | `stub-agent.sh` schreibt deterministisch echten Java-Code für REQ-000. Offline, reproduzierbar, gut für CI und Trockenläufe. |
| **opencode**       | `--real-agent` | `opencode run "$(cat {prompt_file})"`. Authentisch, nicht-deterministisch, ~30–60 s. Für die Kollegen-Demo empfohlen.        |

Der Harness-Loop ist in beiden Fällen identisch — nur das Agent-Kommando
ändert sich.

## Voraussetzungen

- **Erforderlich:** [`vhs`](https://github.com/charmbracelet/vhs),
  `node` ≥ 20, `git`, `mvn`
- **Für `--real-agent`:** [`opencode`](https://opencode.ai) auf `PATH`,
  konfiguriert
- **Für Voice-over (optional):** `ffmpeg`, `jq`, `curl`, `OPENAI_API_KEY`

```bash
# macOS
brew install vhs ffmpeg jq maven
```

## Verwendung

```bash
# Kollegen-Demo mit echtem opencode  ->  out/demo.mp4 + demo.gif
bash scripts/demo/de/build-video.sh --real-agent

# Mit deutscher Voice-over  ->  out/demo-narrated.mp4
OPENAI_API_KEY=sk-... bash scripts/demo/de/build-video.sh --real-agent

# Schnelle Vorschau mit dem Stub (kein opencode nötig)
bash scripts/demo/de/build-video.sh
```

## Wie das Video deterministisch _und_ echt bleibt

- Das Build-Skript wärmt den Pack-Cache vor (einmaliger `git clone`).
- Es wärmt den Maven-Cache vor (`mvn dependency:go-offline`), damit
  `mvn -o test` während der Aufnahme offline läuft.
- Im Stub-Modus ist alles 100 % reproduzierbar.
- Im `--real-agent`-Modus hängt das Bild vom Agenten ab — der Code ist
  trotzdem echt, das Gate ehrlich.

## Bearbeiten

- **Pacing oder Kommandos ändern:** `demo.tape`. VHS führt jede `Type`-Zeile
  als echten Shell-Befehl aus.
- **Narration anpassen:** `narration.json`. Pro Tape-Abschnitt ein
  Segment, in derselben Reihenfolge.
- **Sleep nach `harness run`:** der Platzhalter `%%HARNESS_SLEEP%%` wird
  vom Build-Skript ersetzt — 6 s im Stub-Modus, 90 s mit `--real-agent`.
  Wenn opencode bei dir länger braucht, in `build-video.sh` anpassen.
- **Anderes REQ mit dem Stub:** das `case` in `stub-agent.sh` erweitern —
  ein neues `REQ-NNN)` mit dem Code und Test, der die Szenario-Bedingungen
  erfüllt.
