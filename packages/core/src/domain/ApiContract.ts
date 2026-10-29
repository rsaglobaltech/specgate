/**
 * The operations of an interface contract, and how a requirement's `api=`
 * reference resolves against them (REQ-335, REQ-336).
 *
 * OpenAPI (`paths:` → path → method, with its operationId) and AsyncAPI (2.x
 * `channels:` → channel → publish/subscribe; 3.x `operations:`), in JSON or in
 * YAML. The YAML is read by indentation for the few keys that matter, not by a
 * full YAML parser: a contract is many things, and only its operations are ours.
 */

export interface ApiOperation {
  kind: "openapi" | "asyncapi";
  /** The JSON pointer of the operation: `/paths/~1positions/post`. */
  pointer: string;
  /** `POST /positions`, `publish truck/positions`, or the 3.x operation key. */
  label: string;
  operationId: string;
}

const METHODS = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);
const ASYNC_OPS = new Set(["publish", "subscribe"]);

/** A pointer segment: `~` and `/` escaped as RFC 6901 says. */
export function pointerSegment(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** `openapi`, `asyncapi`, or null when the text is neither. */
export function contractKind(text: string): "openapi" | "asyncapi" | null {
  if (/^\s*\{/.test(text)) {
    try {
      const doc = JSON.parse(text);
      return doc.openapi || doc.swagger ? "openapi" : doc.asyncapi ? "asyncapi" : null;
    } catch {
      return null;
    }
  }
  if (/^(openapi|swagger)\s*:/m.test(text)) return "openapi";
  if (/^asyncapi\s*:/m.test(text)) return "asyncapi";
  return null;
}

interface Node {
  key: string;
  value: string;
  indent: number;
  children: Node[];
}

/** The mapping keys of a YAML document as a tree, by indentation. */
function yamlTree(text: string): Node[] {
  const root: Node = { key: "", value: "", indent: -1, children: [] };
  const stack: Node[] = [root];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw) || /^\s*-/.test(raw)) continue;
    const m = /^(\s*)("(?:[^"\\]|\\.)*"|'[^']*'|[^:#][^:]*?)\s*:(?:\s+(.*))?$/.exec(raw);
    if (!m) continue;
    const indent = m[1].length;
    const key = m[2].replace(/^"(.*)"$|^'(.*)'$/, (_s, a, b) => (a !== undefined ? a : b));
    const node: Node = {
      key,
      value: (m[3] || "").trim().replace(/^["']|["']$/g, ""),
      indent,
      children: [],
    };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return root.children;
}

type Tree = { [key: string]: Tree | string };

function toTree(nodes: Node[]): Tree {
  const out: Tree = {};
  for (const n of nodes) out[n.key] = n.children.length ? toTree(n.children) : n.value;
  return out;
}

function asTree(v: unknown): Tree {
  return v && typeof v === "object" ? (v as Tree) : {};
}

/** Every operation the contract declares, in document order. */
export function contractOperations(text: string, _file = ""): ApiOperation[] {
  const kind = contractKind(text);
  if (!kind) return [];
  let doc: Tree;
  if (/^\s*\{/.test(text)) {
    try {
      doc = JSON.parse(text);
    } catch {
      return [];
    }
  } else {
    doc = toTree(yamlTree(text));
  }
  const ops: ApiOperation[] = [];
  const id = (v: unknown) =>
    typeof asTree(v).operationId === "string" ? String(asTree(v).operationId) : "";
  if (kind === "openapi") {
    for (const [p, item] of Object.entries(asTree(doc.paths))) {
      for (const [method, op] of Object.entries(asTree(item))) {
        if (!METHODS.has(method.toLowerCase())) continue;
        ops.push({
          kind,
          pointer: `/paths/${pointerSegment(p)}/${method}`,
          label: `${method.toUpperCase()} ${p}`,
          operationId: id(op),
        });
      }
    }
    return ops;
  }
  for (const [channel, item] of Object.entries(asTree(doc.channels))) {
    for (const [verb, op] of Object.entries(asTree(item))) {
      if (!ASYNC_OPS.has(verb)) continue;
      ops.push({
        kind,
        pointer: `/channels/${pointerSegment(channel)}/${verb}`,
        label: `${verb} ${channel}`,
        operationId: id(op),
      });
    }
  }
  for (const [key, op] of Object.entries(asTree(doc.operations))) {
    ops.push({
      kind,
      pointer: `/operations/${pointerSegment(key)}`,
      label: key,
      operationId: id(op) || key,
    });
  }
  return ops;
}

export interface ApiRef {
  /** The contract file named before `#`, or "" for a bare operationId. */
  file: string;
  /** A JSON pointer (starts with `/`) or an operationId. */
  target: string;
}

export function parseApiRef(ref: string): ApiRef {
  const hash = ref.indexOf("#");
  return hash < 0
    ? { file: "", target: ref.trim() }
    : { file: ref.slice(0, hash).trim(), target: ref.slice(hash + 1).trim() };
}

export type ApiResolution =
  | { ok: true; file: string; operation: ApiOperation }
  | { ok: false; reason: "contract_missing" | "operation_missing"; file: string };

/** Resolve `ref` against the contracts, keyed by their project-relative path. */
export function resolveApiRef(
  ref: string,
  contracts: Record<string, ApiOperation[]>
): ApiResolution {
  const { file, target } = parseApiRef(ref);
  const matches = (op: ApiOperation) =>
    target.startsWith("/") ? op.pointer === target : op.operationId === target;
  if (file) {
    const norm = file.replace(/\\/g, "/").replace(/^\.\//, "");
    const ops = contracts[norm];
    if (!ops) return { ok: false, reason: "contract_missing", file: norm };
    const op = ops.find(matches);
    return op
      ? { ok: true, file: norm, operation: op }
      : { ok: false, reason: "operation_missing", file: norm };
  }
  for (const [f, ops] of Object.entries(contracts)) {
    const op = ops.find(matches);
    if (op) return { ok: true, file: f, operation: op };
  }
  return { ok: false, reason: "operation_missing", file: "" };
}
