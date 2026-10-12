export interface PackEntry {
  repo: string;
  version: string;
  commit?: string;
  pack_id: string;
  expanded_at?: string;
  [key: string]: any;
}

export class Lockfile {
  public static readonly CURRENT_SCHEMA_VERSION = 1;
  public static readonly FILENAME = ".specops.lock";

  public constructor(
    public specops_version: number,
    public specgate_version: string,
    public packs: PackEntry[]
  ) {}

  public static createEmpty(specgateVersion: string = "0.0.0"): Lockfile {
    return new Lockfile(Lockfile.CURRENT_SCHEMA_VERSION, specgateVersion, []);
  }

  public static parse(raw: string): Lockfile {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      throw new Error(`Invalid ${Lockfile.FILENAME}: ${err.message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Invalid ${Lockfile.FILENAME}: root must be an object`);
    }

    const declared = parsed.specops_version;
    if (typeof declared === "number" && declared > Lockfile.CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `${Lockfile.FILENAME} was written by a newer version of this CLI ` +
          `(lockfile format ${declared}, this CLI understands ${Lockfile.CURRENT_SCHEMA_VERSION}).\n` +
          "Fix: upgrade with `npm install -g create-spec-driven-app@latest`, or ask " +
          "whoever committed the lockfile which version they used."
      );
    }

    const packs = Array.isArray(parsed.packs) ? parsed.packs : [];
    return new Lockfile(
      declared || Lockfile.CURRENT_SCHEMA_VERSION,
      parsed.specgate_version || "0.0.0",
      packs
    );
  }

  public upsertPack(entry: PackEntry): void {
    if (!entry || !entry.repo || !entry.pack_id) {
      throw new Error("upsertPack: entry.repo and entry.pack_id are required");
    }

    const idx = this.packs.findIndex((p) => p.repo === entry.repo && p.pack_id === entry.pack_id);
    if (idx >= 0) {
      this.packs[idx] = { ...this.packs[idx], ...entry };
    } else {
      this.packs.push({ ...entry });
    }

    this.packs.sort((a, b) => {
      const r = String(a.repo).localeCompare(String(b.repo));
      return r !== 0 ? r : String(a.pack_id).localeCompare(String(b.pack_id));
    });
  }

  public toJSON(): any {
    return {
      specops_version: this.specops_version,
      specgate_version: this.specgate_version,
      packs: this.packs,
    };
  }
}
