#!/usr/bin/env node
/**
 * A GitHub stand-in for `alm pr`: the pull request endpoints it calls, in
 * memory, on a random local port. It prints `PORT <n>` once listening. A test
 * hook, GET /__pulls, reads the state back.
 */
import * as http from "node:http";

const pulls = []; // { number, title, body, head, base, state, html_url }

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const url = new URL(req.url, "http://localhost");
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/__pulls") return send(res, 200, pulls);
    if (!/^Bearer \S+/.test(req.headers.authorization || ""))
      return send(res, 401, { message: "Bad credentials" });

    const list = /^\/repos\/([^/]+)\/([^/]+)\/pulls$/.exec(url.pathname);
    if (list && req.method === "GET") {
      const head = url.searchParams.get("head") || "";
      const base = url.searchParams.get("base");
      const branch = head.includes(":") ? head.split(":")[1] : head;
      return send(
        res,
        200,
        pulls
          .filter((p) => p.state === "open" && p.head === branch && (!base || p.base === base))
          .map((p) => ({ ...p, head: { ref: p.head }, base: { ref: p.base } }))
      );
    }
    if (list && req.method === "POST") {
      const number = pulls.length + 1;
      const pr = {
        number,
        title: body.title,
        body: body.body,
        head: body.head,
        base: body.base,
        state: "open",
        html_url: `https://github.example/${list[1]}/${list[2]}/pull/${number}`,
      };
      pulls.push(pr);
      return send(res, 201, pr);
    }
    const one = /^\/repos\/[^/]+\/[^/]+\/pulls\/(\d+)$/.exec(url.pathname);
    if (one && req.method === "PATCH") {
      const pr = pulls.find((p) => p.number === Number(one[1]));
      if (!pr) return send(res, 404, { message: "Not Found" });
      Object.assign(pr, body);
      return send(res, 200, pr);
    }
    send(res, 404, { message: `no route ${req.method} ${url.pathname}` });
  });
});

server.listen(0, "127.0.0.1", () => process.stdout.write(`PORT ${server.address().port}\n`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
