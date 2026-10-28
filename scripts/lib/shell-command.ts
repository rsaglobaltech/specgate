/**
 * A command written for a POSIX shell, made runnable where Specgate runs it
 * (REQ-255).
 *
 * Commands run through `spawnSync(cmd, { shell: true })`, which is cmd.exe on
 * Windows, and cmd.exe cannot run a program written `./name`: `./mvnw -B test`
 * — the test command Specgate proposes for Maven — failed there with "'.' is
 * not recognized as an internal or external command" (truck-flote, S43). Written
 * `.\name`, cmd.exe finds it, and finds `mvnw.cmd` beside `mvnw`, even where
 * NoDefaultCurrentDirectoryInExePath keeps it from searching the current folder.
 * Only the program of each command changes; an argument such as `./src` is a
 * path and stays as it is.
 *
 * Only outside quotes (REQ-265): an agent's allowance `'Bash(./mvnw:*)'` is an
 * argument, and reading its `(` as the start of a command handed Claude Code
 * `'Bash(.\mvnw:*)'` (truck-flote, S51).
 */
export function forShell(command: string, platform: string = process.platform): string {
  if (platform !== "win32") return command;
  let out = "";
  let quote = "";
  let atStart = true;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      atStart = false;
      out += ch;
    } else if (atStart && ch === "." && command[i + 1] === "/") {
      out += ".\\";
      i++;
      atStart = false;
    } else if (/\s/.test(ch)) {
      out += ch;
    } else if ((ch === "&" || ch === "|") && command[i + 1] === ch) {
      out += ch + ch;
      i++;
      atStart = true;
    } else {
      out += ch;
      atStart = ch === ";" || ch === "|" || ch === "(";
    }
  }
  return out;
}
