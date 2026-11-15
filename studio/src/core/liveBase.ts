/**
 * REQ-566: where the Live section reads from. A workspace's studio opens Live
 * on the workspace (`specgate-workspace`), and each member's view reads that
 * member's data under `specgate-live-base` (`/live/repo/<name>`), read only.
 */
const meta = (name: string): string =>
  (typeof document !== "undefined" &&
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")) ||
  "";

/** The prefix of the live data: "" for the project itself. */
export const liveBase = (): string => meta("specgate-live-base");
/** The workspace this studio serves, or "" outside one. */
export const workspaceName = (): string => meta("specgate-workspace");
/** A member's role in the workspace, on its view. */
export const memberRole = (): string => meta("specgate-role");
