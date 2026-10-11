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
