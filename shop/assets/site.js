// HGA redesign: shared page behaviour. No framework; the 3D slab viewer is the
// live site's own Stimulus controller, loaded separately on pages that use it.
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  var CHECKOUT = "https://rc1.ucollect.com/grading/credits/new";
  var PRESALE_END = "2027-02-01T00:00:00-07:00";
  var PRICES = { poly: { now: 30, open: 150, name: "HGA Poly" }, glass: { now: 200, open: 600, name: "HGA Glass" } };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return "$" + n.toLocaleString("en-US"); };

  // ---------- hero variants (modular hero, one per paid audience) ----------
  // Swap with ?a=collector | dealer | tcg. Everything below the hero stays the same.
  var SLABS = {
    ohtani: { dir: "./slabs/ohtani", alt: "Shohei Ohtani, graded 10", glassImg: "./slabs/ohtani/720.webp" },
    judge: { dir: "./slabs/judge", alt: "Aaron Judge, graded 10", polyImg: "./slabs/judge/720.webp" },
    gengar: { dir: "./slabs/gengar", alt: "Gengar, Trainer Gallery, graded 10", glassImg: "./slabs/gengar/720.webp" }
  };
  var VARIANTS = {
    promo: {
      eb: "Presale · Nov 23, 2026 to Jan 31, 2027",
      a: "Our fastest grade", b: "at our lowest price.",
      lede: "Prepay 15 business day grading now, up to 81% under the launch price. Four subgrades, the Grade Report and the case included. Book your grading day from Feb 1.",
      housing: "glass", glass: "ohtani", poly: "judge"
    },
    collector: {
      eb: "For collectors · Presale price",
      a: "Every grade,", b: "explained.",
      lede: "The grader that shows its work. Every defect located and rated, four subgrades on every label, your cards unboxed on camera. Lock in the presale price now.",
      housing: "glass", glass: "ohtani", poly: "judge"
    },
    dealer: {
      eb: "For dealers and bulk submitters",
      a: "Grade 100 cards", b: "at $29 a card.",
      lede: "Prepay up to 100 passes per housing per order, with no limit on orders. Passes never expire, stay on your account, and book around your releases and shows.",
      housing: "poly", glass: "ohtani", poly: "judge"
    },
    tcg: {
      eb: "Pokémon and every TCG",
      a: "Your Pokémon,", b: "graded in the open.",
      lede: "Every TCG and every card size, graded blind to a standard published in full. Four subgrades on every label, at no extra cost. Lock in the presale price now.",
      housing: "glass", glass: "gengar", poly: "gengar"
    }
  };
  var params = new URLSearchParams(location.search);
  var variantKey = VARIANTS[params.get("a")] ? params.get("a") : "promo";
  var hero = $("[data-hero]");
  var selected = "glass";

  function applyVariant(key) {
    var v = VARIANTS[key];
    if (!hero || !v) return;
    hero.dataset.variant = key;
    $("#hero-eb").textContent = v.eb;
    $("#hero-a").textContent = v.a;
    $("#hero-b").textContent = v.b;
    $("#hero-lede").textContent = v.lede;
    ["glass", "poly"].forEach(function (h) {
      var el = $('[data-slab="' + h + '"] .spin-slab', hero);
      var s = SLABS[v[h]];
      if (!el || !s) return;
      var p = "data-hybrid-grading--slab-";
      el.setAttribute(p + "card-front-value", s.dir + "/card/front.webp");
      el.setAttribute(p + "card-back-value", s.dir + "/card/back.webp");
      el.setAttribute(p + "label-front-value", s.dir + "/label/front.webp");
      el.setAttribute(p + "label-back-value", s.dir + "/label/back.webp");
      var img = $("img", el);
      img.src = (h === "glass" ? s.glassImg : s.polyImg) || s.glassImg || s.polyImg;
      img.removeAttribute("srcset");
      img.alt = PRICES[h].name + " slab: " + s.alt;
      el.setAttribute("aria-label", img.alt);
    });
    $$("[data-variant-link]").forEach(function (a) { a.classList.toggle("on", a.dataset.variantLink === key); });
    selectHousing(v.housing);
  }

  function selectHousing(h) {
    selected = h;
    $$("[data-pick]").forEach(function (t) { t.setAttribute("aria-checked", String(t.dataset.pick === h)); t.tabIndex = t.dataset.pick === h ? 0 : -1; });
    $$("[data-slab]", hero || document).forEach(function (s) { s.hidden = s.dataset.slab !== h; });
    $$("[data-hero-cta-name]").forEach(function (e) { e.textContent = PRICES[h].name; });
    $$("[data-hero-cta]").forEach(function (a) { a.href = "shop.html?h=" + h + "#hero"; });
    $$("[data-hero-cta-price]").forEach(function (e) { e.textContent = money(PRICES[h].now); });
    $$("[data-sbar-name]").forEach(function (e) { e.textContent = PRICES[h].name + " · " + money(PRICES[h].now) + " a card"; });
    $$("[data-sbar-sub]").forEach(function (e) { e.textContent = money(PRICES[h].open) + " at launch · save " + money(PRICES[h].open - PRICES[h].now); });
    if (!builderTouched) setQty({ poly: h === "poly" ? 1 : 0, glass: h === "glass" ? 1 : 0 });
  }

  $$("[data-pick]").forEach(function (t) {
    t.addEventListener("click", function () { selectHousing(t.dataset.pick); });
    t.addEventListener("keydown", function (e) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
      e.preventDefault();
      var next = selected === "glass" ? "poly" : "glass";
      selectHousing(next);
      $('[data-pick="' + next + '"]').focus();
    });
  });

  // ---------- quantity builder ----------
  var qty = { poly: 0, glass: 1 };
  var builderTouched = false;
  function setQty(q) {
    qty = q;
    ["poly", "glass"].forEach(function (h) {
      var input = $('[data-qty="' + h + '"]');
      if (input) input.value = qty[h];
      $$('[data-line="' + h + '"]').forEach(function (e) { e.hidden = qty[h] === 0; });
      $$('[data-line-qty="' + h + '"]').forEach(function (e) { e.textContent = qty[h]; });
      $$('[data-line-total="' + h + '"]').forEach(function (e) { e.textContent = money(qty[h] * PRICES[h].now); });
      var card = $('[data-card="' + h + '"]');
      if (card) card.classList.toggle("active", qty[h] > 0);
    });
    var count = qty.poly + qty.glass;
    var now = qty.poly * PRICES.poly.now + qty.glass * PRICES.glass.now;
    var open = qty.poly * PRICES.poly.open + qty.glass * PRICES.glass.open;
    $$("[data-sum-count]").forEach(function (e) { e.textContent = count + (count === 1 ? " pass" : " passes"); });
    $$("[data-sum-now]").forEach(function (e) { e.textContent = money(now); });
    $$("[data-sum-open]").forEach(function (e) { e.textContent = money(open); });
    $$("[data-sum-save]").forEach(function (e) { e.textContent = money(open - now); });
    $$("[data-sum-empty]").forEach(function (e) { e.hidden = count > 0; });
    $$("[data-sum-full]").forEach(function (e) { e.hidden = count === 0; });
    $$("[data-sum-cta]").forEach(function (e) { e.classList.toggle("is-off", count === 0); e.setAttribute("aria-disabled", String(count === 0)); });
  }
  $$("[data-step-qty]").forEach(function (b) {
    b.addEventListener("click", function () {
      builderTouched = true;
      var h = b.dataset.stepQty, d = Number(b.dataset.d);
      var q = { poly: qty.poly, glass: qty.glass };
      q[h] = Math.max(0, Math.min(100, q[h] + d));
      setQty(q);
    });
  });
  $$("[data-qty]").forEach(function (input) {
    input.addEventListener("input", function () {
      builderTouched = true;
      var q = { poly: qty.poly, glass: qty.glass };
      var n = parseInt(input.value, 10);
      q[input.dataset.qty] = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
      setQty(q);
    });
    input.addEventListener("blur", function () { input.value = qty[input.dataset.qty]; });
  });
  $$("[data-sum-cta]").forEach(function (a) {
    a.addEventListener("click", function (e) { if (a.classList.contains("is-off")) e.preventDefault(); });
  });

  // a cart from an earlier visit fills the builder, so adding sets the cart rather than piling on
  try {
    var saved = JSON.parse(localStorage.getItem("hga_cart") || "null");
    if (saved && (saved.poly > 0 || saved.glass > 0)) { qty = { poly: saved.poly, glass: saved.glass }; builderTouched = true; }
  } catch (e) {}
  if (hero) applyVariant(variantKey); else setQty(qty);
  if (builderTouched) setQty(qty);

  // ---------- presale state: reads "opens Nov 23" until the sale starts (launch moved to Mon Nov 23, call with Trevor 2026-10-14) ----------
  if (Date.now() < new Date("2026-11-23T00:00:00-07:00").getTime()) {
    $$("[data-ps-label]").forEach(function (e) { e.textContent = "Pre sale opens Nov 23"; });
  }

  // ---------- countdowns ----------
  var cds = $$("[data-cd]");
  function tick() {
    var left = Math.max(0, new Date(PRESALE_END).getTime() - Date.now());
    var d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    cds.forEach(function (c) {
      var set = function (k, v) { var e = $("[data-" + k + "]", c); if (e) e.textContent = v; };
      set("d", d); set("h", pad(h)); set("m", pad(m)); set("s", pad(s));
      var t = $("[data-cd-text]", c);
      if (t) t.textContent = d + "d " + pad(h) + "h " + pad(m) + "m";
    });
  }
  if (cds.length) { tick(); setInterval(tick, 1000); }

  // ---------- header menu ----------
  var mb = $("[data-menu]"), nav = $("#hnav");
  if (mb && nav) {
    mb.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      mb.setAttribute("aria-expanded", String(open));
    });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); }); });
  }

  // ---------- reveal on scroll ----------
  if ("IntersectionObserver" in window && !reduce) {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".rv").forEach(function (el) { ro.observe(el); });
  } else { $$(".rv").forEach(function (el) { el.classList.add("in"); }); }

  // ---------- sticky buy bar ----------
  var sbar = $(".sbar"), after = $("[data-sbar-after]"), stops = $$("[data-sbar-stop]");
  if (sbar && after && "IntersectionObserver" in window) {
    var past = false, stopped = false;
    var upd = function () { sbar.classList.toggle("show", past && !stopped); };
    new IntersectionObserver(function (es) { past = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; upd(); }).observe(after);
    var vis = new Set();
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) vis.add(e.target); else vis.delete(e.target); });
      stopped = vis.size > 0; upd();
    });
    stops.forEach(function (s) { so.observe(s); });
  }

  // ---------- generic tabs ----------
  $$("[data-tabs]").forEach(function (root) {
    var tabs = $$('[role="tab"]', root);
    function show(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute("aria-controls"));
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
      root.dispatchEvent(new CustomEvent("tabchange", { detail: tabs.indexOf(tab) }));
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { root.dataset.touched = "1"; show(t); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowRight" || k === "ArrowDown") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowLeft" || k === "ArrowUp") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { e.preventDefault(); root.dataset.touched = "1"; show(n, true); }
      });
    });
    root._show = show; root._tabs = tabs;
  });

  // ---------- process stepper: syncs the portal mock, advances on its own until touched ----------
  $$("[data-steps]").forEach(function (root) {
    var rows = $$("[data-prow]", root);
    var cur = 0;
    function sync(i) {
      cur = i;
      rows.forEach(function (r, j) { r.classList.toggle("done", j < i); r.classList.toggle("now", j === i); });
      var bar = $("[data-pbar]", root);
      if (bar) bar.style.width = ((i + 1) / rows.length * 100) + "%";
    }
    root.addEventListener("tabchange", function (e) { sync(e.detail); });
    sync(0);
    if (reduce || !("IntersectionObserver" in window)) return;
    var timer = null;
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting && !timer) {
        timer = setInterval(function () {
          if (root.dataset.touched) { clearInterval(timer); return; }
          root._show(root._tabs[(cur + 1) % root._tabs.length]);
        }, 4200);
      } else if (!es[0].isIntersecting && timer) { clearInterval(timer); timer = null; }
    }, { threshold: .4 }).observe(root);
  });

  // ---------- in-page subnav highlighting ----------
  var sub = $(".subnav");
  if (sub && "IntersectionObserver" in window) {
    var links = $$('a[href^="#"]', sub);
    var map = {};
    links.forEach(function (a) { var s = document.getElementById(a.getAttribute("href").slice(1)); if (s) map[s.id] = a; });
    var so2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("on"); });
        var a = map[e.target.id];
        if (a) { a.classList.add("on"); var row = a.parentNode; row.scrollTo({ left: a.offsetLeft - row.clientWidth / 2 + a.offsetWidth / 2, behavior: reduce ? "auto" : "smooth" }); }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { so2.observe(document.getElementById(id)); });
    var firstSec = document.getElementById(Object.keys(map)[0]);
    window.addEventListener("scroll", function () {
      if (firstSec && window.scrollY + window.innerHeight * .4 < firstSec.offsetTop) links.forEach(function (a) { a.classList.remove("on"); });
    }, { passive: true });
  }

  // ---------- FAQ library: search plus categories ----------
  var lib = $("[data-faq-lib]");
  if (lib) {
    var q = $("[data-faq-search]", lib), cats = $$("[data-faq-cat]", lib), items = $$("details[data-cat]", lib);
    var groups = $$("[data-faq-group]", lib), empty = $("[data-faq-empty]", lib), countEl = $("[data-faq-count]", lib);
    var cat = "all";
    function filter() {
      var term = (q.value || "").trim().toLowerCase();
      var shown = 0;
      items.forEach(function (d) {
        var hit = (cat === "all" || d.dataset.cat === cat) && (!term || d.textContent.toLowerCase().indexOf(term) > -1);
        d.hidden = !hit;
        if (hit) shown++;
        if (term && hit) d.open = true;
      });
      groups.forEach(function (g) { g.hidden = !$$("details[data-cat]:not([hidden])", g).length; });
      empty.hidden = shown > 0;
      countEl.textContent = shown + (shown === 1 ? " answer" : " answers");
    }
    q.addEventListener("input", filter);
    cats.forEach(function (b) {
      b.addEventListener("click", function () {
        cat = b.dataset.faqCat;
        cats.forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        filter();
      });
    });
    $$("[data-faq-counts]", lib).forEach(function (b) {
      var c = b.dataset.faqCounts;
      b.textContent = c === "all" ? items.length : items.filter(function (d) { return d.dataset.cat === c; }).length;
    });
    var hash = location.hash.slice(1);
    var pre = cats.filter(function (c) { return c.dataset.faqCat === hash; })[0];
    if (pre) pre.click(); else filter();
  }

  // ---------- forms that are pictures of forms until wired ----------
  $$("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = $("[data-ok]", f);
      if (ok) { ok.hidden = false; }
      $$("input,button", f).forEach(function (el) { el.disabled = true; });
    });
  });

  // ---------- outbound checkout links ----------
  $$("[data-checkout]").forEach(function (a) { a.href = CHECKOUT; });
})();

/* Each design version is an independent experience. The version a visitor lands on is
   remembered for the session, and shared pages (PDP, cart, checkout, FAQ...) link back to it. */
(function () {
  var V = ["index.html", "home-b.html", "home-c.html", "home-d.html", "home-e.html"];
  var here = location.pathname.split("/").pop() || "index.html";
  if (here === "variations.html") return;
  var home = "index.html";
  try {
    if (V.indexOf(here) >= 0) sessionStorage.setItem("hga_home", here);
    home = sessionStorage.getItem("hga_home") || "index.html";
  } catch (e) {}
  if (V.indexOf(here) >= 0) return;
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="index.html"]'), function (a) {
    var hash = a.getAttribute("href").slice("index.html".length);
    var ids = { "index.html": ["hero", "why", "how", "offer"], "home-b.html": ["hero", "why", "how"], "home-c.html": ["hero", "why", "how", "offer"], "home-d.html": ["hero", "why", "how", "offer"], "home-e.html": ["formats", "why", "how", "offer", "faq"] }[home];
    if (hash && ids.indexOf(hash.slice(1)) < 0) hash = ids.indexOf("offer") >= 0 ? "#offer" : "#hero";
    a.setAttribute("href", home + hash);
  });
})();

/* In-page navigation (version A): mark the section currently in view */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".hnav a[data-spy]"));
  if (!links.length || !("IntersectionObserver" in window)) return;
  var map = {};
  links.forEach(function (a) { var el = document.getElementById(a.getAttribute("href").slice(1)); if (el) map[el.id] = a; });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.removeAttribute("aria-current"); });
      map[e.target.id].setAttribute("aria-current", "location");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  // land exactly under the header even if images above finish loading mid scroll
  var reduceM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var el = document.getElementById(a.getAttribute("href").slice(1));
      if (!el) return;
      e.preventDefault();
      var hdr = document.querySelector(".hdr");
      var go = function (behavior) {
        var off = (hdr ? hdr.getBoundingClientRect().bottom : 0) + 24;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - off, behavior: behavior });
      };
      go(reduceM ? "auto" : "smooth");
      var fix = function () { window.removeEventListener("scrollend", fix); clearTimeout(t); go("auto"); };
      var t = setTimeout(fix, 1600);
      window.addEventListener("scrollend", fix);
      try { history.replaceState(null, "", a.getAttribute("href")); } catch (err) {}
    });
  });
})();
