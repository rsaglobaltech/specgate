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
 */
export function forShell(command: string, platform: string = process.platform): string {
  if (platform !== "win32") return command;
  return command.replace(/(^|&&|\|\||;|\||\()(\s*)\.\//g, "$1$2.\\");
}
