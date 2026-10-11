/**
 * The landing page's behaviour: reveal on scroll, the lifecycle stepper and
 * the recording tabs.
 *
 * Every piece is an enhancement. Without JavaScript the lifecycle is a plain
 * numbered list with every step's text, the three recordings are three
 * transcripts, and everything that fades in is simply there.
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

  // ── Lifecycle stepper ─────────────────────────────────────────────────────
  //
  // One step at a time, in order, advancing on its own while the section is on
  // screen — the sequence is the point. Any click, key or hover hands control
  // to the reader for good.
  document.querySelectorAll("[data-lc]").forEach(function (root) {
    var steps = Array.prototype.slice.call(root.querySelectorAll(".lc__step"));
    if (!steps.length) return;
    var panel = document.createElement("div");
    panel.className = "lc__panel";
    panel.setAttribute("aria-live", "polite");
    root.querySelector(".lc__track").after(panel);
    root.classList.add("lc--js");

    var current = -1;
    var timer = null;
    var manual = false;

    function show(i, focus) {
      current = (i + steps.length) % steps.length;
      steps.forEach(function (li, n) {
        var btn = li.querySelector(".lc__dot");
        li.classList.toggle("is-active", n === current);
        li.classList.toggle("is-past", n < current);
        if (n === current) btn.setAttribute("aria-current", "step");
        else btn.removeAttribute("aria-current");
        if (n === current && focus) btn.focus();
      });
      var body = steps[current].querySelector(".lc__body");
      panel.innerHTML = "";
      var clone = body.cloneNode(true);
      clone.classList.add("lc__body--shown");
      var n = document.createElement("p");
      n.className = "lc__of";
      n.textContent =
        "Step " + (current + 1) + " of " + steps.length + " · " + steps[current].dataset.phase;
      panel.appendChild(n);
      panel.appendChild(clone);
      root.style.setProperty("--lc-progress", current / (steps.length - 1));
    }

    function stop() {
      manual = true;
      if (timer) clearInterval(timer);
      timer = null;
    }

    steps.forEach(function (li, i) {
      var btn = li.querySelector(".lc__dot");
      btn.addEventListener("click", function () {
        stop();
        show(i);
      });
      btn.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          stop();
          show(current + 1, true);
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          stop();
          show(current - 1, true);
        }
      });
    });
    root.addEventListener("mouseenter", function () {
      if (timer) stop();
    });

    show(0);
    if (reduce || !("IntersectionObserver" in window)) return;
    var seen = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (manual) return;
          if (e.isIntersecting && !timer) {
            timer = setInterval(function () {
              if (current === steps.length - 1) {
                clearInterval(timer);
                timer = null;
                manual = true;
                return;
              }
              show(current + 1);
            }, 3800);
          } else if (!e.isIntersecting && timer) {
            clearInterval(timer);
            timer = null;
          }
        });
      },
      { threshold: 0.5 }
    );
    seen.observe(root);
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
