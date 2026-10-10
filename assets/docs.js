/*
 * Progressive enhancement for the documentation shell.
 *
 * Everything here is optional: the pages are rendered HTML and read fine with
 * this file blocked. What it adds is search, copy buttons, a theme toggle, the
 * mobile sidebar, and highlighting the heading you are currently reading.
 */
(function () {
  "use strict";

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  // ── Theme ────────────────────────────────────────────────────────────────
  var themeBtn = $(".top__theme");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var current =
        document.documentElement.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("csda-theme", next);
      } catch (e) {
        /* private browsing: the toggle still works for this page */
      }
    });
  }

  // ── Mobile navigation ────────────────────────────────────────────────────
  var menuBtn = $(".top__menu");
  var side = $("#side");
  if (menuBtn && side) {
    menuBtn.addEventListener("click", function () {
      var open = side.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
  }

  // ── Copy buttons ─────────────────────────────────────────────────────────
  $$(".code__copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var code = $("code", btn.parentNode);
      if (!code) return;
      var done = function () {
        btn.textContent = "Copied";
        btn.classList.add("is-done");
        setTimeout(function () {
          btn.textContent = "Copy";
          btn.classList.remove("is-done");
        }, 1600);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code.textContent).then(done, function () {
          btn.textContent = "Press ⌘C";
        });
      } else {
        // Older browsers: select the text so the reader can copy it themselves
        // rather than press a button that silently does nothing.
        var range = document.createRange();
        range.selectNodeContents(code);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = "Press ⌘C";
      }
    });
  });

  // ── Collapsible sidebar groups ───────────────────────────────────────────
  //
  // `<details>` already opens and closes without help. What this adds is
  // memory: a reader who folds away four sections should not find them open
  // again on the next page. The group holding the current page is forced open
  // by the generator, so the remembered state never hides where you are.
  $$(".side__group").forEach(function (group) {
    var key = "csda-nav:" + (group.getAttribute("data-group") || "");
    if (!group.hasAttribute("open")) {
      try {
        if (localStorage.getItem(key) === "open") group.open = true;
      } catch (e) {
        /* private browsing: groups just start as the generator left them */
      }
    }
    group.addEventListener("toggle", function () {
      try {
        localStorage.setItem(key, group.open ? "open" : "shut");
      } catch (e) {
        /* nothing to remember, nothing to do */
      }
    });
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────
  //
  // Follows the ARIA tabs pattern: arrows move between tabs, Home and End jump
  // to the ends, and only the selected tab is in the tab order — so Tab leaves
  // the strip and enters the panel rather than walking every tab first.
  $$(".tabs").forEach(function (group) {
    var tabs = $$(".tabs__tab", group);
    var panels = $$(".tabs__panel", group);
    if (tabs.length === 0) return;

    var select = function (index, focus) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (panels[i]) panels[i].hidden = !on;
      });
      if (focus && tabs[index]) tabs[index].focus();
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i, false);
      });
      tab.addEventListener("keydown", function (event) {
        var next =
          event.key === "ArrowRight"
            ? (i + 1) % tabs.length
            : event.key === "ArrowLeft"
              ? (i - 1 + tabs.length) % tabs.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : -1;
        if (next === -1) return;
        event.preventDefault();
        select(next, true);
      });
    });
  });

  // ── Search palette ───────────────────────────────────────────────────────
  //
  // The index is fetched on first open, not on load: most readers never search,
  // and a documentation page should not spend their bandwidth on the chance
  // that they will.
  //
  // Records are one per heading as well as one per page, so a hit can land on
  // the section that answers the question rather than the top of a 1000-line
  // tutorial.
  var palette = $("#palette");
  var trigger = $("#search");
  var input = $("#palette-input");
  var results = $("#results");

  if (palette && trigger && input && results) {
    var records = null;
    var loading = false;
    var active = -1;
    var hits = [];
    var lastFocus = null;
    var base = location.pathname.replace(/[^/]*$/, "");
    var depth = (document.documentElement.getAttribute("data-slug") || "").split("/").length - 1;
    var up = new Array(depth + 1).join("../");

    var escapeHtml = function (value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    var mark = function (text, needle) {
      var at = text.toLowerCase().indexOf(needle);
      if (at === -1) return escapeHtml(text.slice(0, 110));
      // A window around the match, so the match is visible rather than
      // truncated away in a long paragraph.
      var from = Math.max(0, at - 30);
      var slice = text.slice(from, from + 120);
      var rel = at - from;
      return (
        (from > 0 ? "…" : "") +
        escapeHtml(slice.slice(0, rel)) +
        "<mark>" +
        escapeHtml(slice.slice(rel, rel + needle.length)) +
        "</mark>" +
        escapeHtml(slice.slice(rel + needle.length))
      );
    };

    var render = function (query) {
      var needle = query.trim().toLowerCase();
      results.innerHTML = "";
      hits = [];
      active = -1;

      if (!records) {
        results.innerHTML = '<p class="palette__empty">Loading the index…</p>';
        return;
      }
      if (needle.length < 2) {
        results.innerHTML = '<p class="palette__empty">Type to search the documentation.</p>';
        return;
      }

      var found = [];
      for (var i = 0; i < records.length && found.length < 30; i++) {
        var r = records[i];
        var inTitle = (r.title || "").toLowerCase().indexOf(needle) !== -1;
        var inSection = (r.section || "").toLowerCase().indexOf(needle) !== -1;
        var inText = (r.text || "").toLowerCase().indexOf(needle) !== -1;
        if (!inTitle && !inSection && !inText) continue;
        // A title match is what the reader most often meant.
        found.push({ r: r, rank: inTitle ? 0 : inSection ? 1 : 2 });
      }
      found.sort(function (a, b) {
        return a.rank - b.rank;
      });

      if (found.length === 0) {
        results.innerHTML =
          '<p class="palette__empty">Nothing matches “' + escapeHtml(query.trim()) + "”.</p>";
        return;
      }

      var currentPage = null;
      found.forEach(function (entry) {
        var r = entry.r;
        if (r.title !== currentPage) {
          currentPage = r.title;
          var head = document.createElement("div");
          head.className = "palette__group";
          head.textContent = r.title;
          results.appendChild(head);
        }
        var a = document.createElement("a");
        a.className = "palette__hit";
        a.setAttribute("role", "option");
        a.href = up + r.slug + ".html" + (r.hash ? "#" + r.hash : "");
        a.innerHTML =
          "<strong>" +
          escapeHtml(r.section || r.title) +
          "</strong><span>" +
          mark(r.text || "", needle) +
          "</span>";
        results.appendChild(a);
        hits.push(a);
      });
      move(0);
    };

    var move = function (index) {
      if (hits.length === 0) return;
      active = (index + hits.length) % hits.length;
      hits.forEach(function (a, i) {
        a.classList.toggle("is-active", i === active);
      });
      hits[active].scrollIntoView({ block: "nearest" });
    };

    var load = function () {
      if (records || loading) return;
      loading = true;
      fetch(up + "assets/search-index.json")
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          records = data;
          render(input.value);
        })
        .catch(function () {
          results.innerHTML =
            '<p class="palette__empty">The search index could not be loaded.</p>';
        });
    };

    var open = function () {
      lastFocus = document.activeElement;
      palette.hidden = false;
      document.body.style.overflow = "hidden";
      input.value = "";
      render("");
      load();
      input.focus();
    };

    var close = function () {
      palette.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    trigger.addEventListener("click", open);
    $$("[data-close]", palette).forEach(function (el) {
      el.addEventListener("click", close);
    });
    input.addEventListener("input", function () {
      render(input.value);
    });

    document.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (palette.hidden) open();
        else close();
        return;
      }
      if (palette.hidden) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        move(active + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(active - 1);
      } else if (event.key === "Enter" && hits[active]) {
        event.preventDefault();
        hits[active].click();
      } else if (event.key === "Tab") {
        // The dialog is modal: focus stays in it until it closes.
        event.preventDefault();
        input.focus();
      }
    });

    void base;
  }

  // ── Highlight the section being read ─────────────────────────────────────
  var tocLinks = $$(".toc a");
  if (tocLinks.length > 0 && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) {
      byId[a.getAttribute("href").slice(1)] = a;
    });
    var seen = [];
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var id = entry.target.id;
          if (entry.isIntersecting) {
            if (seen.indexOf(id) === -1) seen.push(id);
          } else {
            seen = seen.filter(function (s) {
              return s !== id;
            });
          }
        });
        tocLinks.forEach(function (a) {
          a.classList.remove("is-active");
        });
        if (seen.length > 0 && byId[seen[0]]) byId[seen[0]].classList.add("is-active");
      },
      { rootMargin: "-72px 0px -70% 0px" }
    );
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // ── The recorded terminal ────────────────────────────────────────────────
  //
  // The markup already contains the whole transcript in a `<pre>`. This turns
  // it into a replay; if anything at all goes wrong, the `<pre>` is what the
  // reader keeps, so it is hidden only once the recording has parsed.
  //
  // Every node is built with createElement + textContent. The transcript is
  // real CLI output and contains `<`, `&` and box-drawing characters, so
  // innerHTML is not an option here.

  $$(".term[data-term-src]").forEach(function (fig) {
    var src = fig.getAttribute("data-term-src");
    if (!src || !window.fetch) return;
    fetch(src)
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (rec) {
        if (!rec || rec.schemaVersion !== 1 || !rec.steps || !rec.steps.length) {
          throw new Error("not a recording this player knows");
        }
        startTerm(fig, rec);
      })
      .catch(function () {
        // A blocked fetch, a file:// origin, a schema from the future.
        fig.classList.add("term--static");
      });
  });

  function reducedMotion() {
    return (
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function startTerm(fig, rec) {
    var screen = $(".term__screen", fig);
    var caption = $(".term__caption", fig);
    var toggle = $(".term__btn--toggle", fig);
    var skip = $(".term__btn--skip", fig);
    var replay = $(".term__btn--replay", fig);
    if (!screen) return;

    var timers = [];
    var frame = null;
    var index = 0;
    var userPaused = false;
    var hoverPaused = false;
    var resume = null;

    function clearPending() {
      timers.forEach(clearTimeout);
      timers = [];
      if (frame) cancelAnimationFrame(frame);
      frame = null;
    }

    function later(fn, ms) {
      timers.push(setTimeout(fn, ms));
    }

    function paused() {
      return userPaused || hoverPaused || document.visibilityState === "hidden";
    }

    function lineNode(line) {
      var el = document.createElement("div");
      el.className = "term__line term__line--" + (line.c || "out");
      el.textContent = line.t;
      return el;
    }

    function stepNode(step) {
      var root = document.createElement("div");
      root.className = "term__step";

      var head = document.createElement("div");
      var prompt = document.createElement("span");
      prompt.className = "term__prompt";
      prompt.textContent = step.cwd + " $ ";
      var cmd = document.createElement("span");
      cmd.className = "term__cmd";
      head.appendChild(prompt);
      head.appendChild(cmd);
      root.appendChild(head);

      var out = document.createElement("div");
      out.className = "term__out";
      root.appendChild(out);

      return { root: root, cmd: cmd, out: out, head: head };
    }

    function emitOutput(step, nodes) {
      step.lines.forEach(function (line) {
        nodes.out.appendChild(lineNode(line));
      });
      if (step.truncated) {
        var more = document.createElement("div");
        more.className = "term__line term__more";
        more.textContent = "… " + step.omitted + " more lines";
        nodes.out.appendChild(more);
      }
      if (step.exit !== 0) {
        var exit = document.createElement("div");
        exit.className = "term__exit term__exit--fail";
        exit.textContent = "exit " + step.exit;
        nodes.out.appendChild(exit);
      }
      screen.scrollTop = screen.scrollHeight;
    }

    // Characters are computed from elapsed time rather than one per frame, so a
    // backgrounded tab catches up on return instead of queueing thousands of
    // timers.
    function typeCommand(nodes, text, msPerChar, whenDone) {
      var caret = document.createElement("span");
      caret.className = "term__caret";
      nodes.head.appendChild(caret);
      var started = null;

      function tick(now) {
        if (paused()) {
          resume = function () {
            started = null;
            frame = requestAnimationFrame(tick);
          };
          frame = null;
          return;
        }
        if (started === null) started = now - nodes.cmd.textContent.length * msPerChar;
        var shown = Math.min(text.length, Math.floor((now - started) / msPerChar));
        nodes.cmd.textContent = text.slice(0, shown);
        screen.scrollTop = screen.scrollHeight;
        if (shown >= text.length) {
          if (caret.parentNode) caret.parentNode.removeChild(caret);
          whenDone();
          return;
        }
        frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    }

    function setCaption(step) {
      if (caption) caption.textContent = step.caption || "";
    }

    function finish() {
      fig.classList.remove("term--playing");
      fig.classList.add("term--done");
      if (toggle) toggle.hidden = true;
      if (skip) skip.hidden = true;
      if (replay) replay.hidden = false;
    }

    function play() {
      if (index >= rec.steps.length) {
        finish();
        return;
      }
      var step = rec.steps[index];
      index += 1;
      setCaption(step);
      var nodes = stepNode(step);
      screen.appendChild(nodes.root);
      screen.scrollTop = screen.scrollHeight;

      typeCommand(nodes, step.command, step.typeMs || 26, function () {
        emitOutput(step, nodes);
        later(function () {
          if (paused()) {
            resume = play;
            return;
          }
          play();
        }, step.holdMs || 1200);
      });
    }

    function renderAll() {
      clearPending();
      screen.textContent = "";
      rec.steps.forEach(function (step) {
        var nodes = stepNode(step);
        nodes.cmd.textContent = step.command;
        screen.appendChild(nodes.root);
        emitOutput(step, nodes);
      });
      setCaption(rec.steps[rec.steps.length - 1]);
      screen.scrollTop = 0;
      finish();
    }

    // The transcript stays in the accessibility tree; it stops taking space.
    fig.classList.add("term--playing");

    if (reducedMotion()) {
      // No controls offered: a reader who asked for less motion is not looking
      // for a button that starts some.
      renderAll();
      if (replay) replay.hidden = true;
      return;
    }

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener("click", function () {
        userPaused = !userPaused;
        toggle.textContent = userPaused ? "Resume" : "Pause";
        if (!paused() && resume) {
          var next = resume;
          resume = null;
          next();
        }
      });
    }
    if (skip) {
      skip.hidden = false;
      skip.addEventListener("click", renderAll);
    }
    if (replay) {
      replay.addEventListener("click", function () {
        clearPending();
        screen.textContent = "";
        index = 0;
        userPaused = false;
        resume = null;
        fig.classList.remove("term--done");
        fig.classList.add("term--playing");
        if (toggle) {
          toggle.hidden = false;
          toggle.textContent = "Pause";
        }
        if (skip) skip.hidden = false;
        replay.hidden = true;
        play();
      });
    }

    fig.addEventListener("mouseenter", function () {
      hoverPaused = true;
    });
    fig.addEventListener("mouseleave", function () {
      hoverPaused = false;
      if (!paused() && resume) {
        var next = resume;
        resume = null;
        next();
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (!paused() && resume) {
        var next = resume;
        resume = null;
        next();
      }
    });

    // Nothing moves until the section is on screen, and it never loops.
    if (!window.IntersectionObserver) {
      play();
      return;
    }
    var started = false;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!started && entry.isIntersecting) {
            started = true;
            io.disconnect();
            play();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(fig);
  }

})();
