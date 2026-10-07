#!/usr/bin/env node
/**
 * A Jira Cloud stand-in for the ALM journeys: the five REST endpoints
 * `alm` calls, in memory, on a random local port. It prints `PORT <n>` once
 * listening. Test hooks under /__ let a journey seed issues, close one as a
 * person would in Jira, and read the state back.
 */
import * as http from "node:http";

const issues = new Map(); // key → { key, summary, description, labels, done }
let next = 1;

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const adf = (text) => ({
  type: "doc",
  version: 1,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const create = (fields) => {
  const key = `SHOP-${next++}`;
  issues.set(key, {
    key,
    summary: fields.summary || "",
    description: fields.description || "",
    labels: fields.labels || [],
    done: false,
  });
  return key;
};

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const url = new URL(req.url, "http://localhost");
    const body = raw ? JSON.parse(raw) : {};

    if (url.pathname === "/__issues") return send(res, 200, [...issues.values()]);
    if (url.pathname === "/__seed" && req.method === "POST")
      return send(res, 201, { key: create(body) });
    const close = /^\/__close\/(.+)$/.exec(url.pathname);
    if (close) {
      issues.get(close[1]).done = true;
      return send(res, 204);
    }

    if (!/^Basic /.test(req.headers.authorization || ""))
      return send(res, 401, { errorMessages: ["unauthorised"] });

    if (url.pathname === "/rest/api/3/issue" && req.method === "POST") {
      return send(res, 201, { key: create(body.fields || {}) });
    }
    if (url.pathname === "/rest/api/3/search") {
      const label = /labels = "([^"]+)"/.exec(url.searchParams.get("jql") || "")?.[1];
      const found = [...issues.values()].filter(
        (i) => !i.done && (!label || i.labels.includes(label))
      );
      return send(res, 200, {
        issues: found.map((i) => ({
          key: i.key,
          fields: { summary: i.summary, description: adf(i.description) },
        })),
      });
    }
    const transitions = /^\/rest\/api\/3\/issue\/([^/]+)\/transitions$/.exec(url.pathname);
    if (transitions) {
      const issue = issues.get(transitions[1]);
      if (!issue) return send(res, 404, {});
      if (req.method === "POST") {
        issue.done = true;
        return send(res, 204);
      }
      return send(res, 200, {
        transitions: [{ id: "31", name: "Done", to: { statusCategory: { key: "done" } } }],
      });
    }
    const one = /^\/rest\/api\/3\/issue\/([^/]+)$/.exec(url.pathname);
    if (one) {
      const issue = issues.get(one[1]);
      if (!issue) return send(res, 404, {});
      return send(res, 200, {
        key: issue.key,
        fields: {
          status: {
            name: issue.done ? "Done" : "To Do",
            statusCategory: { key: issue.done ? "done" : "new" },
          },
        },
      });
    }
    send(res, 404, { errorMessages: [`no route ${req.method} ${url.pathname}`] });
  });
});

server.listen(0, "127.0.0.1", () => process.stdout.write(`PORT ${server.address().port}\n`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
