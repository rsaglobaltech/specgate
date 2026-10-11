/**
 * The landing page's behaviour: reveal on scroll, the journey switch, the
 * journey's pillars and the recording tabs.
 *
 * Every piece is an enhancement. Without JavaScript both journeys are on the
 * page one after the other, the three recordings are three transcripts, and
 * everything that fades in is simply there.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Reveal ────────────────────────────────────────────────────────────────
  var items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  // ── The hero stack leans toward the pointer ─────────────────────────────
  //
  // A few degrees each way, eased so it glides instead of following every
  // pixel, and back to rest when the pointer leaves. Nothing happens on touch
  // screens or under reduced motion.
  var stack = document.querySelector(".iso__stack");
  var art = document.querySelector(".mx__art .iso");
  if (stack && art && !reduce && window.matchMedia("(hover: hover)").matches) {
    var target = { x: 0, z: 0 };
    var cur = { x: 0, z: 0 };
    var raf = null;
    var glide = function () {
      cur.x += (target.x - cur.x) * 0.08;
      cur.z += (target.z - cur.z) * 0.08;
      stack.style.setProperty("--tilt-x", cur.x.toFixed(2) + "deg");
      stack.style.setProperty("--tilt-z", cur.z.toFixed(2) + "deg");
      if (Math.abs(target.x - cur.x) > 0.02 || Math.abs(target.z - cur.z) > 0.02) {
        raf = requestAnimationFrame(glide);
      } else {
        raf = null;
      }
    };
    var aim = function (x, z) {
      target.x = x;
      target.z = z;
      if (!raf) raf = requestAnimationFrame(glide);
    };
    art.addEventListener("pointermove", function (e) {
      var r = art.getBoundingClientRect();
      var px = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      var py = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      aim(-py * 6, px * 8);
    });
    art.addEventListener("pointerleave", function () {
      aim(0, 0);
    });
  }

  // ── The harness board plays one run, step by step ──────────────────────
  //
  // Cells carry the step they appear at; one step every ~0.9 s while the board
  // is on screen, a pause on the finished run, then again. Reduced motion, or
  // no IntersectionObserver: the whole run is simply there.
  document.querySelectorAll("[data-hz]").forEach(function (board) {
    var band = board.closest(".hz");
    var cells = Array.prototype.slice.call(board.querySelectorAll("[data-at]"));
    if (!cells.length || reduce || !("IntersectionObserver" in window)) return;
    var last = cells.reduce(function (m, c) {
      return Math.max(m, +c.dataset.at);
    }, 0);
    var step = 0;
    var timer = null;
    board.classList.add("hz--live");
    function paint() {
      var now = null;
      cells.forEach(function (c) {
        var on = +c.dataset.at <= step;
        c.classList.toggle("is-on", on);
        if (+c.dataset.at === step) now = c.closest(".hz__row");
      });
      board.querySelectorAll(".hz__row").forEach(function (r) {
        r.classList.toggle("is-now", r === now);
      });
      if (band) band.classList.toggle("is-done", step >= last);
      var live = board.querySelector(".hz__live");
      if (live) live.textContent = step >= last ? "run finished" : "running";
    }
    function tick() {
      step = step >= last + 4 ? 0 : step + 1;
      paint();
    }
    paint();
    new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !timer) timer = setInterval(tick, 900);
          else if (!e.isIntersecting && timer) {
            clearInterval(timer);
            timer = null;
          }
        });
      },
      { threshold: 0.35 }
    ).observe(board);
  });

  // ── Journey switch ────────────────────────────────────────────────────────
  //
  // Two paths, one shown at a time. Without JavaScript both are on the page,
  // one after the other, and the switch is hidden.
  document.querySelectorAll("[data-journey]").forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    function select(i, focus) {
      tabs.forEach(function (tab, n) {
        var on = n === i;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(tab.getAttribute("aria-controls"));
        if (panel) {
          panel.hidden = !on;
          if (on) {
            panel.querySelectorAll(".reveal").forEach(function (el) {
              el.classList.add("is-in");
            });
          }
        }
        if (on && focus) tab.focus();
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i);
      });
      tab.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          select((i + 1) % tabs.length, true);
        }
      });
    });
    var start = /existing|adopt/.test(window.location.hash) ? 1 : 0;
    select(start);
  });

  // ── Journey pillars ───────────────────────────────────────────────────────
  //
  // On a wide screen the five phases are pillars, and the chosen one opens
  // below them; the stylesheet hides the others' bodies. On a phone every body
  // stays open, so the buttons only record which one was chosen.
  var wide = window.matchMedia ? window.matchMedia("(min-width: 1000px)") : { matches: false };
  document.querySelectorAll(".jn__track").forEach(function (track) {
    var phases = Array.prototype.slice.call(track.querySelectorAll(".jn__phase"));
    var current = 0;
    function choose(i) {
      current = i;
      phases.forEach(function (phase, n) {
        var on = n === i;
        phase.classList.toggle("is-active", on);
        var pick = phase.querySelector(".jn__pick");
        if (pick) pick.setAttribute("aria-expanded", on || !wide.matches ? "true" : "false");
      });
    }
    if (wide.addEventListener)
      wide.addEventListener("change", function () {
        choose(current);
      });
    phases.forEach(function (phase, i) {
      var pick = phase.querySelector(".jn__pick");
      if (pick)
        pick.addEventListener("click", function () {
          choose(i);
        });
    });
    choose(0);
  });

  // ── Recording tabs ────────────────────────────────────────────────────────
  //
  // A hidden panel never intersects, so its recording does not start until the
  // reader opens it — the player in docs.js waits for that on its own.
  document.querySelectorAll("[data-demo]").forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    function select(i, focus) {
      tabs.forEach(function (tab, n) {
        var on = n === i;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(tab.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
        if (on && focus) tab.focus();
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i);
      });
      tab.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          select((i + 1) % tabs.length, true);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          select((i - 1 + tabs.length) % tabs.length, true);
        }
      });
    });
    select(0);
  });
})();
