/**
 * The command the studio ran, as it runs (REQ-438): what it is — the very
 * `specgate` command — its output as it grows, and how it ended.
 */
import { t, type Lang } from "../core/i18n";
import type { ActionRun } from "../core/useAction";

export function Command({
  lang,
  run,
  output,
}: {
  lang: Lang;
  run: ActionRun | null;
  output: string;
}) {
  if (!run) return null;
  const running = run.exit === null;
  const state = running ? "running" : run.exit === 0 ? "ok" : "fail";
  return (
    <section class={`command command-${state}`} aria-label={t(lang, "commandRun")}>
      <div class="row spread">
        <code class="where">specgate {run.argv.join(" ")}</code>
        <span role="status" class={running ? "faint" : run.exit === 0 ? "ok" : "err"}>
          {running ? <span class="spin" aria-hidden="true" /> : null}{" "}
          {running
            ? t(lang, "cmdRunning")
            : run.exit === 0
              ? t(lang, "cmdOk")
              : t(lang, "cmdFailed").replace("{N}", String(run.exit))}
        </span>
      </div>
      <pre class="term term-out" tabIndex={0} aria-label={t(lang, "cmdOutput")}>
        {output.replace(/^\$ [^\n]*\n/, "") || "…"}
      </pre>
    </section>
  );
}
