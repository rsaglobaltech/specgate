import "./blocking-stdio";
import { c, sym } from "./ui";
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
    process.stderr.write(`  ${c.bad}${sym.fail}${c.reset}  ${msg}\n`);
  }

  protected info(msg: string): void {
    process.stdout.write(`  ${c.note}${sym.info}${c.reset}  ${msg}\n`);
  }
}
