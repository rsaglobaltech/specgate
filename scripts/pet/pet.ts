/**
 * Gato — the cat that keeps the gate.
 *
 * A pet whose state *is* the project's: nothing to feed by hand. It is fed by
 * closing requirements, kept healthy by a green gate, worried by questions
 * nobody has answered, and it grows with the share of the specification that
 * is implemented. Every phrase it says ends where `status` would send you, so
 * it is another way of showing the next step, not a game beside the work.
 *
 * Everything is derived on the spot except two facts no file records: how the
 * last `check` ended, and how many days in a row it has ended green. Those live
 * in `.specgate/pet.json`, which is ignored by git — the pet is yours, not the
 * team's.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { c, sym, progress, ASCII } from "../lib/ui";

export const PET_NAME = "Gato";
const STATE_DIR = ".specgate";
const STATE_FILE = "pet.json";
/** Days without a check before the cat falls asleep. */
const SLEEP_AFTER_DAYS = 7;

export interface PetState {
  lastCheck?: { ok: boolean; at: string };
  streak?: { days: number; lastGreenDay: string };
}

// ── State ─────────────────────────────────────────────────────────────────────

export function readPetState(projectDir: string): PetState {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir, STATE_DIR, STATE_FILE), "utf8"));
  } catch {
    return {};
  }
}

/** A calendar day, local time: a streak is about days you worked, not UTC. */
function dayOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The streak after a check that ended `ok` on `now`. */
export function nextStreak(prev: PetState["streak"], ok: boolean, now: Date): PetState["streak"] {
  const today = dayOf(now);
  if (!ok) return { days: 0, lastGreenDay: prev ? prev.lastGreenDay : "" };
  if (prev && prev.lastGreenDay === today) return prev;
  const yesterday = dayOf(new Date(now.getTime() - 86_400_000));
  const days = prev && prev.lastGreenDay === yesterday && prev.days > 0 ? prev.days + 1 : 1;
  return { days, lastGreenDay: today };
}

/**
 * What `check` tells the cat. Best effort: a pet is never a reason for the
 * gate to fail, so any error writing it is swallowed.
 */
export function recordCheck(projectDir: string, ok: boolean, now = new Date()): void {
  try {
    const dir = path.join(projectDir, STATE_DIR);
    fs.mkdirSync(dir, { recursive: true });
    // `.specgate/config.json` is the team's and may be committed; the pet is
    // not. Ignore only the pet, and only once.
    const ignore = path.join(dir, ".gitignore");
    const lines = fs.existsSync(ignore) ? fs.readFileSync(ignore, "utf8") : "";
    if (!/^pet\.json$/m.test(lines)) {
      fs.writeFileSync(ignore, `${lines}${lines && !lines.endsWith("\n") ? "\n" : ""}pet.json\n`);
    }
    const prev = readPetState(projectDir);
    const state: PetState = {
      lastCheck: { ok, at: now.toISOString() },
      streak: nextStreak(prev.streak, ok, now),
    };
    fs.writeFileSync(path.join(dir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    /* the gate's verdict stands without the pet */
  }
}

/** Whether the pet shows up in `status`: on, unless `specgate config set pet off`. */
export function petEnabled(projectDir: string): boolean {
  if (process.env.SPECGATE_PET === "0") return false;
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(projectDir, STATE_DIR, "config.json"), "utf8")
    );
    return cfg.pet !== "off";
  } catch {
    return true;
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────

export type Stage = "egg" | "kitten" | "cat" | "legend";
export type Mood = "happy" | "content" | "hungry" | "worried" | "sick" | "sleepy" | "curious";

export interface PetInput {
  total: number;
  done: number;
  /** Requirements whose test is in place: one `done` away from closed. */
  readyToClose: number;
  /** Requirements waiting for an answer to a question. */
  waiting: number;
  state: PetState;
  now?: Date;
  /** What `status` says to run next, and why. */
  next: string;
  reason: string;
}

export interface PetView {
  name: string;
  stage: Stage;
  mood: Mood;
  phrase: string;
  next: string;
  reason: string;
  /** 0–1, or null when nothing says. */
  health: number | null;
  fed: number;
  calm: number;
  streak: number;
  total: number;
  done: number;
  waiting: number;
  daysSinceCheck: number | null;
}

export function petView(i: PetInput): PetView {
  const now = i.now || new Date();
  const share = i.total > 0 ? i.done / i.total : 0;
  const last = i.state.lastCheck;
  const daysSinceCheck = last
    ? Math.floor((now.getTime() - new Date(last.at).getTime()) / 86_400_000)
    : null;
  const green = last ? last.ok : null;
  // A streak is alive only while its last green day is today or yesterday.
  const lastGreen = i.state.streak ? i.state.streak.lastGreenDay : "";
  const alive =
    lastGreen === dayOf(now) || lastGreen === dayOf(new Date(now.getTime() - 86_400_000));
  const streak = i.state.streak && green && alive ? i.state.streak.days : 0;

  const stage: Stage =
    i.done === 0 ? "egg" : share >= 1 && green ? "legend" : share >= 0.5 ? "cat" : "kitten";

  // One mood, the most urgent first: a red gate outweighs a hungry cat.
  let mood: Mood;
  if (green === false) mood = "sick";
  else if (daysSinceCheck !== null && daysSinceCheck >= SLEEP_AFTER_DAYS) mood = "sleepy";
  else if (i.waiting > 0) mood = "worried";
  else if (green === null) mood = "curious";
  else if (i.total - i.done > 0) mood = i.readyToClose > 0 ? "content" : "hungry";
  else mood = "happy";

  const left = i.total - i.done;
  const reqs = (n: number) => `${n} requirement${n === 1 ? "" : "s"}`;
  const phrase =
    stage === "egg" && mood !== "sick"
      ? i.total === 0
        ? "Still an egg. Give me a first requirement to grow into."
        : "Still an egg. Close your first requirement and I hatch."
      : {
          sick: "The gate is red and I don't feel well. Fix what check reports.",
          sleepy: `Nobody has run the gate for ${daysSinceCheck} days. Wake me with a check.`,
          worried: `${reqs(i.waiting)} ${i.waiting === 1 ? "waits" : "wait"} for an answer, and I can't grow past a question.`,
          curious: "I've never seen the gate run. Show me.",
          content: `${reqs(i.readyToClose)} ${i.readyToClose === 1 ? "has its" : "have their"} test — close one and I eat.`,
          hungry: `${reqs(left)} to go. Feed me a test.`,
          happy: "Every requirement closed and the gate is green. Purr.",
        }[mood];

  return {
    name: PET_NAME,
    stage,
    mood,
    phrase,
    next: mood === "curious" || mood === "sleepy" ? "specgate check" : i.next,
    reason:
      mood === "curious" || mood === "sleepy"
        ? "the gate: the specification, then your tests"
        : i.reason,
    health: green === null ? null : green ? 1 : 0.15,
    fed: share,
    calm: i.total > 0 ? 1 - i.waiting / i.total : 1,
    streak,
    total: i.total,
    done: i.done,
    waiting: i.waiting,
    daysSinceCheck,
  };
}

// ── Drawing ───────────────────────────────────────────────────────────────────

/** Eyes and mouth for each mood, and the colour the eyes take. */
const FACE: Record<Mood, { eyes: [string, string]; mouth: string; tint: string }> = ASCII
  ? {
      happy: { eyes: ["^", "^"], mouth: "w", tint: c.ok },
      content: { eyes: ["o", "o"], mouth: "u", tint: c.ok },
      hungry: { eyes: ["o", "o"], mouth: "o", tint: c.warn },
      worried: { eyes: ["O", "O"], mouth: "~", tint: c.accent },
      sick: { eyes: ["x", "x"], mouth: "~", tint: c.bad },
      sleepy: { eyes: ["-", "-"], mouth: "_", tint: c.muted },
      curious: { eyes: ["o", "O"], mouth: "?", tint: c.accent },
    }
  : {
      happy: { eyes: ["◕", "◕"], mouth: "ω", tint: c.ok },
      content: { eyes: ["•", "•"], mouth: "ᴗ", tint: c.ok },
      hungry: { eyes: ["◔", "◔"], mouth: "o", tint: c.warn },
      worried: { eyes: ["⊙", "⊙"], mouth: "~", tint: c.accent },
      sick: { eyes: ["×", "×"], mouth: "~", tint: c.bad },
      sleepy: { eyes: ["‿", "‿"], mouth: "_", tint: c.muted },
      curious: { eyes: ["•", "◕"], mouth: "o", tint: c.accent },
    };

const B = (s: string) => `${c.brand}${s}${c.reset}`;
const P = (s: string) => `${c.pink}${s}${c.reset}`;
const M = (s: string) => `${c.muted}${s}${c.reset}`;

/** The drawing for a stage and mood, line by line, coloured. */
export function art(stage: Stage, mood: Mood): string[] {
  const f = FACE[mood];
  const [l, r] = f.eyes.map((e) => `${f.tint}${e}${c.reset}`);
  const mouth = P(f.mouth);
  const zz = mood === "sleepy" ? M("  z Z") : "";
  switch (stage) {
    case "egg": {
      const d = mood === "sick" ? B("╳") : B("◆");
      return [
        B('    .-""-.') + zz,
        B("   / ") + d + B("  ") + d + B(" \\"),
        B("  |  ") + d + B("  ") + d + B("  |"),
        B("   \\ ") + d + B("  ") + d + B(" /"),
        B("    '-..-'"),
      ];
    }
    case "kitten":
      return [
        B("   /\\_/\\") + zz,
        B("  ( ") + l + " " + r + B(" )"),
        B("  ( ") + M("=") + mouth + M("=") + B(" )"),
        B('   (")(")'),
      ];
    default: {
      const crown =
        stage === "legend" ? [`         ${c.warn}${ASCII ? "^^^" : "♛"}${c.reset}`] : [];
      return [
        ...crown,
        B("    /\\_____/\\") + zz,
        B("   /  ") + l + B("   ") + r + B("  \\"),
        B("  ( ") + M("==") + B("  ") + mouth + B("  ") + M("==") + B(" )"),
        B("   )         ("),
        B("  (  )     (  )"),
        B(" (___)_____(___)"),
      ];
    }
  }
}

const STAGE_NAME: Record<Stage, string> = {
  egg: "egg",
  kitten: "kitten",
  cat: "cat",
  legend: "legend",
};
const MOOD_NAME: Record<Mood, string> = {
  happy: "happy",
  content: "content",
  hungry: "hungry",
  worried: "worried",
  sick: "sick",
  sleepy: "asleep",
  curious: "curious",
};

/** Lines side by side: the drawing on the left, the text on the right. */
function beside(left: string[], right: string[], gap: number): string {
  const n = Math.max(left.length, right.length);
  const visible = (s: string) => [...s.replace(/\x1b\[[0-9;]*m/g, "")].length; // eslint-disable-line no-control-regex
  // The text starts one column, the same for every line, past the widest line
  // of the drawing — whatever the stage.
  const leftWidth = Math.max(0, ...left.map(visible)) + gap;
  let out = "";
  for (let k = 0; k < n; k++) {
    const a = left[k] || "";
    out +=
      `  ${a}${" ".repeat(Math.max(0, leftWidth - visible(a)))}${right[k] || ""}`.trimEnd() + "\n";
  }
  return out;
}

function gateWords(v: PetView): string {
  if (v.health === null) return M("gate never run");
  return v.health === 1 ? `${c.ok}gate green${c.reset}` : `${c.bad}gate red${c.reset}`;
}

function streakWords(v: PetView): string {
  return v.streak > 0
    ? `${ASCII ? "*" : "🔥"} ${v.streak} day${v.streak === 1 ? "" : "s"} green`
    : "";
}

/**
 * The few lines at the end of `status`: the cat's face and one sentence.
 * Small on purpose — `status` is the dashboard, the cat a margin note on it.
 */
export function miniPet(v: PetView): string {
  // The egg whole, the text beside its middle; any other stage as a kitten's
  // head, which is all a margin note has room for.
  const egg = v.stage === "egg";
  const face = egg ? art("egg", v.mood) : art("kitten", v.mood).slice(0, 3);
  const facts = [`${v.done} of ${v.total} closed`, gateWords(v), streakWords(v)].filter(Boolean);
  const right = [
    `${v.stage === "legend" ? `${c.warn}${ASCII ? "^" : "♛"}${c.reset} ` : ""}${c.bold}${v.name}${c.reset} ${M(`is ${MOOD_NAME[v.mood]}`)}`,
    facts.join(M(` ${sym.bullet} `)),
    `${c.italic}${v.phrase}${c.reset}`,
  ];
  return beside(face, egg ? ["", ...right] : right, 3) + "\n";
}

/** `specgate pet`: the whole cat, its four needs, and what to do for it. */
export function fullPet(v: PetView): string {
  const drawing = art(v.stage, v.mood);
  const bar = (share: number | null, label: string) =>
    share === null ? `${M(sym.barEmpty.repeat(20))}  ${M(label)}` : progressBar(share, label);
  const right = [
    `${c.bold}${v.name}${c.reset}  ${M(`${STAGE_NAME[v.stage]} · ${MOOD_NAME[v.mood]}`)}`,
    "",
    `${M("health ")} ${bar(v.health, v.health === null ? "the gate has never run" : v.health === 1 ? "gate green" : "gate red")}`,
    `${M("fed    ")} ${progress(v.done, v.total, "closed")}`,
    `${M("calm   ")} ${bar(v.calm, v.waiting ? `${v.waiting} waiting for an answer` : "no open questions")}`,
    `${M("streak ")} ${v.streak > 0 ? streakWords(v) : M("—  a green check starts it")}`,
  ];
  const pad = Array(Math.max(0, Math.floor((right.length - drawing.length) / 2))).fill("");
  return beside([...pad, ...drawing], right, 5) + `\n  ${c.italic}“${v.phrase}”${c.reset}\n`;
}

function progressBar(share: number, label: string): string {
  const width = 20;
  const filled = Math.round(Math.max(0, Math.min(1, share)) * width);
  const color = share >= 1 ? c.ok : share < 0.34 ? c.bad : c.brand;
  return `${color}${sym.bar.repeat(filled)}${c.reset}${M(sym.barEmpty.repeat(width - filled))}  ${label}`;
}
