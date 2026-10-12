import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { commandNames, subcommandNames } from "../../../lib/surface";
import { BaseCommand } from "../../../lib/command";

export const COMMANDS = commandNames();
export const SUBCOMMANDS: Record<string, string[]> = subcommandNames();

export function bashScript() {
  const cmds = COMMANDS.join(" ");
  const subCases = Object.entries(SUBCOMMANDS)
    .map(
      ([cmd, subs]) => `      ${cmd}) COMPREPLY=( $(compgen -W "${subs.join(" ")}" -- "$cur") ) ;;`
    )
    .join("\n");
  return `# specgate bash completion
_specgate() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${cmds}" -- "$cur") )
    return
  fi
  if [ "$COMP_CWORD" -eq 2 ]; then
    case "$prev" in
${subCases}
    esac
  fi
}
complete -F _specgate specgate create-spec-driven-app
`;
}

export function zshScript() {
  const cmds = COMMANDS.join(" ");
  const subCases = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `        ${cmd}) compadd ${subs.join(" ")} ;;`)
    .join("\n");
  return `#compdef specgate create-spec-driven-app
# specgate zsh completion
_specgate() {
  if (( CURRENT == 2 )); then
    compadd ${cmds}
    return
  fi
  if (( CURRENT == 3 )); then
    case "\${words[2]}" in
${subCases}
    esac
  fi
}
compdef _specgate specgate create-spec-driven-app
`;
}

export function fishScript() {
  const lines = [
    "# specgate fish completion",
    "# Only complete the first word when no subcommand has been given yet.",
    `complete -c specgate -n __fish_use_subcommand -a "${COMMANDS.join(" ")}"`,
    `complete -c specgate -n __fish_use_subcommand -a "${COMMANDS.join(" ")}"`,
    `complete -c create-spec-driven-app -n __fish_use_subcommand -a "${COMMANDS.join(" ")}"`,
  ];
  for (const [cmd, subs] of Object.entries(SUBCOMMANDS)) {
    lines.push(
      `complete -c specgate -n "__fish_seen_subcommand_from ${cmd}" -a "${subs.join(" ")}"`,
      `complete -c specgate -n "__fish_seen_subcommand_from ${cmd}" -a "${subs.join(" ")}"`,
      `complete -c create-spec-driven-app -n "__fish_seen_subcommand_from ${cmd}" -a "${subs.join(" ")}"`
    );
  }
  return `${lines.join("\n")}\n`;
}

export const GENERATORS: Record<string, () => string> = {
  bash: bashScript,
  zsh: zshScript,
  fish: fishScript,
};

export function installTarget(shell: string) {
  const home = os.homedir();
  if (shell === "fish") {
    return { file: path.join(home, ".config/fish/completions/specgate.fish"), autoloaded: true };
  }
  if (shell === "zsh") {
    return {
      file: path.join(home, ".zsh/completions/_specgate"),
      autoloaded: false,
      hint: "Add to ~/.zshrc:  fpath=(~/.zsh/completions $fpath) && autoload -Uz compinit && compinit",
    };
  }
  return {
    file: path.join(home, ".specgate-completion.bash"),
    autoloaded: false,
    hint: "Add to ~/.bashrc:  source ~/.specgate-completion.bash",
  };
}

function usage() {
  process.stderr.write(
    "Usage: specgate completion <bash|zsh|fish> [--install]\n\n" +
      "  specgate completion fish --install     write it where fish already looks\n" +
      "  specgate completion zsh > ~/.specgate-completion.zsh\n" +
      "  specgate completion bash >> ~/.bashrc\n"
  );
}

export class CompletionCommand extends BaseCommand {
  public execute(): void {
    const args = this.args;
    const install = args.includes("--install");
    const shell = args.find((a) => !a.startsWith("-"));

    if (!shell || !GENERATORS[shell]) {
      usage();
      process.exit(shell ? 2 : 0);
    }

    const script = GENERATORS[shell]();

    if (!install) {
      process.stdout.write(script);
      process.exit(0);
    }

    const target = installTarget(shell);
    fs.mkdirSync(path.dirname(target.file), { recursive: true });
    fs.writeFileSync(target.file, script, "utf8");

    const where = target.file.replace(os.homedir(), "~");
    process.stdout.write(`✔  wrote ${where}\n`);
    process.stdout.write(
      target.autoloaded
        ? "   fish loads it automatically — open a new shell.\n"
        : `   ${target.hint}\n`
    );
    process.exit(0);
  }
}
