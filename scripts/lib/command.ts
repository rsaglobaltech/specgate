import "./blocking-stdio";
export interface ICommand {
  execute(args?: string[]): Promise<void> | void;
}

export abstract class BaseCommand implements ICommand {
  protected args: string[];

  constructor(args: string[] = []) {
    this.args = args;
  }

  public abstract execute(): Promise<void> | void;

  protected error(msg: string): void {
    process.stderr.write(`\x1b[31m✖\x1b[0m  ${msg}\n`);
  }

  protected info(msg: string): void {
    process.stdout.write(`\x1b[36mℹ\x1b[0m  ${msg}\n`);
  }
}
