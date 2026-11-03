// HGA redesign: the shopping flow. One cart shared by home, PDP, cart,
// checkout and thank you. Kept in localStorage per viewer; the page still
// works (in memory) when storage is blocked. Payments are not wired: placing
// an order stores a demo order and opens the thank you page.
// 2026-10-30 (Dylan's pricing text): the cart holds variants, housing x card size.
// Ids: glass, poly (standard cards, the old shape), glass-booklet, poly-booklet, glass-trifold, poly-trifold.
// Oversized is priced on request (quote) and cannot be added. Prices come from the table below.
(function () {
  "use strict";

  // ===== PRICE TABLE: written by the build from _tools/hga_pricing.json. Edit prices there (or here in a handoff copy). =====
  var TABLE = {"presale_ends":"Jan 31","value_fee":{"threshold":10000,"pct":2.5},"ship_fee":{"threshold":500,"pct":1,"_source":"Meeting note 2026-11-02: Trevor confirmed mandatory shipping insurance, 1% on cards over $500, none under. Bhaskar: disclosure text only, no inputs. Pending his confirmation that it stays."},"bulk":{"poly":{"min":5,"now":null}},"fold":{"glass":100,"poly":15},"housings":{"glass":{"name":"HGA Glass","includes":["Four subgrades and a full grading report","RFID chip in the label","Metal and glass housing","Your grading date on the calendar"]},"poly":{"name":"HGA Poly","includes":["Four subgrades and a full grading report","Digital record on your UCollect account","Protective poly housing","Your grading date on the calendar"]}},"order":["std","booklet","trifold","oversized"],"types":{"std":{"name":"Standard card","short":"Standard","note":"Standard size trading cards.","glass":{"now":200,"open":600,"days":30},"poly":{"now":30,"open":150,"days":60}},"booklet":{"name":"Booklet","short":"Booklet","note":"Booklet cards that open once, two panels.","folds":1,"glass":{"now":300,"open":null,"days":60},"poly":{"now":45,"open":null,"days":60}},"trifold":{"name":"Trifold booklet","short":"Trifold","note":"Booklet cards that open twice, three panels.","folds":2,"glass":{"now":400,"open":null,"days":60},"poly":{"now":60,"open":null,"days":60}},"oversized":{"name":"Oversized card","short":"Oversized","note":"Emanate, Cleat, Jumbo and other cards larger than standard size.","glass":{"now":600,"open":null,"days":30},"poly":{"now":90,"open":null,"days":30}}}};
  // ===========================================================================================================================

  // Booklets are priced by folds: base + add-on x folds, 1 to 10 folds on sale, all on a 60 day turnaround.
  TABLE.types.booklet.name = "Booklet, 1 fold"; TABLE.types.trifold.name = "Booklet, 2 folds";
  for (var nf = 3; nf <= 10; nf++) {
    TABLE.types["f" + nf] = { name: "Booklet, " + nf + " folds", short: "Booklet", note: "", folds: nf,
      glass: { now: 200 + TABLE.fold.glass * nf, open: null, days: 60 }, poly: { now: 30 + TABLE.fold.poly * nf, open: null, days: 60 } };
    TABLE.order.push("f" + nf);
  }

  var PRICES = {
    poly: { now: TABLE.types.std.poly.now, open: TABLE.types.std.poly.open, name: TABLE.housings.poly.name },
    glass: { now: TABLE.types.std.glass.now, open: TABLE.types.std.glass.open, name: TABLE.housings.glass.name }
  };
  var SIZES = TABLE.types, BULK = TABLE.bulk || {};
  var HOUSINGS = ["glass", "poly"], SIZE_IDS = TABLE.order;
  var BUY = SIZE_IDS.filter(function (s) { return !SIZES[s].quote; });  // oversized is quoted, not sold online
  var VARIANTS = [];
  HOUSINGS.forEach(function (h) { BUY.forEach(function (s) { VARIANTS.push(vid(h, s)); }); });
  function vid(h, s) { return s === "std" ? h : h + "-" + s; }
  function split(v) { var p = v.split("-"); return { h: p[0], s: p[1] || "std" }; }
  function price(v) {
    var x = split(v), sz = SIZES[x.s], pr = sz[x.h];
    return { now: pr.now, open: pr.open === undefined ? null : pr.open, days: pr.days, name: PRICES[x.h].name + (x.s === "std" ? "" : " · " + sz.name), housing: PRICES[x.h].name, size: sz.name, h: x.h, s: x.s };
  }
  // the unit price in a given cart: Poly bulk pricing (when set) applies to standard Poly cards at the minimum count
  function unit(v, c) {
    var p = price(v), b = BULK[p.h];
    if (p.s === "std" && b && b.now !== null && b.now !== undefined && c[v] >= b.min) return b.now;
    return p.now;
  }
  var KEY = "hga_cart", ORDER = "hga_last_order";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return "$" + n.toLocaleString("en-US"); };
  var clamp = function (n) { n = parseInt(n, 10); return isNaN(n) ? 0 : Math.max(0, Math.min(100, n)); };
  var empty = function () { var c = {}; VARIANTS.forEach(function (v) { c[v] = 0; }); return c; };
  var mem = empty();

  // carts saved by the Oct 31 preview (fold counts): one fold reads as a booklet, more as a trifold
  var OLD = { "glass-booklet1": "glass-booklet", "poly-booklet1": "poly-booklet", "glass-booklet2": "glass-trifold", "poly-booklet2": "poly-trifold" };
  function norm(c) {
    var o = empty();
    VARIANTS.forEach(function (v) { o[v] = clamp(c && c[v]); });
    if (c) Object.keys(OLD).forEach(function (k) { if (c[k]) o[OLD[k]] = clamp(o[OLD[k]] + clamp(c[k])); });
    return o;
  }
  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      if (c && typeof c === "object") return norm(c);  // the old {poly, glass} shape reads as standard cards
    } catch (e) {}
    return norm(mem);
  }
  function write(c) {
    mem = norm(c);
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {}
    badge(true);
    render();
  }
  function add(v, n) { var c = read(); c[v] = clamp(c[v] + n); write(c); }
  function totals(c) {
    var count = 0, now = 0, open = 0;
    VARIANTS.forEach(function (v) { var p = price(v), u = unit(v, c); count += c[v]; now += c[v] * u; open += c[v] * (p.open === null ? u : p.open); });
    return { count: count, now: now, open: open, save: open - now };
  }
  function byHousing(c, h) { var n = 0; VARIANTS.forEach(function (v) { if (split(v).h === h) n += c[v]; }); return n; }
  function badge(bump) {
    var n = totals(read()).count;
    $$("[data-cart-count]").forEach(function (b) {
      b.textContent = n; b.hidden = n === 0;
      if (bump) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    });
  }
  function set(sel, v) { $$(sel).forEach(function (e) { e.textContent = v; }); }
  function unitHtml(u, p) { return "<b>" + money(u) + "</b> a card" + (p.open === null || u !== p.now ? "" : " <s>" + money(p.open) + "</s>"); }
  function meta(p) { return p.size + " · grading date from " + p.days + " business days out"; }

  // ---------- rows for the booklet and trifold variants: cloned from the housing's standard row ----------
  function cloneRows(scope) {
    var r = scope || document;
    HOUSINGS.forEach(function (h) {
      var tpl = $('[data-line-row="' + h + '"]', r);
      if (!tpl || tpl.dataset.cloned) return;
      tpl.dataset.cloned = "1";
      var after = tpl;
      VARIANTS.filter(function (v) { return v !== h && split(v).h === h; }).forEach(function (v) {
        var p = price(v), el = tpl.cloneNode(true);
        el.setAttribute("data-line-row", v);
        $$("[data-line-q],[data-line-now],[data-line-open],[data-cart-step],[data-cart-remove]", el).forEach(function (x) {
          ["data-line-q", "data-line-now", "data-line-open", "data-cart-step", "data-cart-remove"].forEach(function (a) { if (x.hasAttribute(a)) x.setAttribute(a, v); });
          if (x.hasAttribute("aria-label")) x.setAttribute("aria-label", x.getAttribute("aria-label").replace(/HGA (Glass|Poly)|(Glass|Poly) (slots|passes)/, p.name));
        });
        $$("h2, .co-line > div > b, .sl > span:first-child", el).forEach(function (t) {
          t.innerHTML = t.innerHTML.replace(/HGA (Glass|Poly)/, p.name);
        });
        after.insertAdjacentElement("afterend", el);
        after = el;
      });
    });
  }

  // Fills every data-c-* hook on the page from a cart (or a placed order).
  function fill(c, scope) {
    var t = totals(c);
    var r = scope || document;
    cloneRows(r);
    VARIANTS.forEach(function (v) {
      var p = price(v), u = unit(v, c), strike = p.open !== null && u === p.now;
      $$('[data-line-row="' + v + '"]', r).forEach(function (e) {
        e.hidden = c[v] === 0;
        $$(".l-unit", e).forEach(function (x) { x.innerHTML = unitHtml(u, p); });
        $$(".l-meta", e).forEach(function (x) { x.textContent = meta(p); });
        $$(".co-line > div > span", e).forEach(function (x) { x.textContent = "Presale pass · " + meta(p); });
      });
      $$('[data-line-q="' + v + '"]', r).forEach(function (e) { if ("value" in e && e.tagName === "INPUT") e.value = c[v]; else e.textContent = c[v]; });
      $$('[data-line-now="' + v + '"]', r).forEach(function (e) { e.textContent = money(c[v] * u); });
      $$('[data-line-open="' + v + '"]', r).forEach(function (e) { e.textContent = strike ? money(c[v] * p.open) : ""; e.hidden = !strike; });
    });
    HOUSINGS.forEach(function (h) {
      $$('[data-xsell="' + h + '"]', r).forEach(function (e) { e.hidden = !(byHousing(c, h) === 0 && t.count > 0); });
    });
    $$("[data-c-count]", r).forEach(function (e) { e.textContent = t.count + (t.count === 1 ? " pass" : " passes"); });
    $$("[data-c-verb]", r).forEach(function (e) { e.textContent = t.count === 1 ? "is" : "are"; });
    $$("[data-c-sub]", r).forEach(function (e) { e.textContent = money(t.open); });
    $$("[data-c-save]", r).forEach(function (e) { e.textContent = "-" + money(t.save); });
    $$("[data-c-save-plain]", r).forEach(function (e) {
      e.textContent = money(t.save);
      var box = e.closest(".co-saved"); if (box) box.hidden = t.save === 0;
      var lead = e.previousSibling;  // "1 pass · saving $X" in the checkout bar
      if (lead && lead.nodeType === 3) { if (!e._lead) e._lead = lead.textContent; lead.textContent = t.save === 0 ? "" : e._lead; e.hidden = t.save === 0; }
    });
    // oversized and booklets have no launch price yet: no "Launch pricing" or "-$0" savings rows when nothing is saved
    $$("[data-c-sub],[data-c-save]", r).forEach(function (e) { var row = e.closest(".sl"); if (row) row.hidden = t.save === 0; });
    $$("[data-c-total]", r).forEach(function (e) { e.textContent = money(t.now); });
    $$("[data-c-empty]", r).forEach(function (e) { e.hidden = t.count > 0; });
    $$("[data-c-full]", r).forEach(function (e) { e.hidden = t.count === 0; });
    $$("[data-c-go]", r).forEach(function (e) { e.classList.toggle("is-off", t.count === 0); e.setAttribute("aria-disabled", String(t.count === 0)); });
  }
  function render() { if (!$("[data-thanks]")) fill(read()); }

  // ---------- home builder: add the chosen quantities ----------
  $$("[data-add-cart]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (a.classList.contains("is-off")) return;
      var c = read();
      HOUSINGS.forEach(function (h) { var i = $('[data-qty="' + h + '"]'); if (i) c[h] = clamp(i.value); });
      write(c);
      location.href = a.getAttribute("href");
    });
  });

  // ---------- pricing cards (PSA style): prices drawn from the table ----------
  $$("[data-pt-now]").forEach(function (e) { e.textContent = money(price(e.dataset.ptNow).now); });
  $$("[data-pt-open]").forEach(function (e) { var p = price(e.dataset.ptOpen); e.textContent = p.open === null ? "" : money(p.open); e.hidden = p.open === null; });

  // ---------- Buy box: cards, then Glass or Poly, then sizes ----------
  var bd = $("[data-builder]");
  if (bd) {
    var bdParams = new URLSearchParams(location.search);
    var MAX = 100;
    var folds = function (f) { return f === 1 ? "booklet" : f === 2 ? "trifold" : "f" + f; };
    var S = { step: 1, total: 1, glass: bdParams.get("h") === "poly" ? 0 : 1, special: false,
      over: { glass: 0, poly: 0 }, books: { glass: [{ f: 1, q: 0 }], poly: [{ f: 1, q: 0 }] } };
    var inH = function (h) { return h === "glass" ? S.glass : S.total - S.glass; };
    var bookN = function (h) { return S.books[h].reduce(function (n, b) { return n + b.q; }, 0); };
    var stdN = function (h) { return inH(h) - (S.special ? S.over[h] + bookN(h) : 0); };
    // when a housing shrinks, take the cards back from its booklets, then its oversized
    var fit = function () {
      S.total = Math.max(1, Math.min(MAX, S.total));
      S.glass = Math.max(0, Math.min(S.total, S.glass));
      HOUSINGS.forEach(function (h) {
        var extra = S.over[h] + bookN(h) - inH(h), i = S.books[h].length - 1;
        while (extra > 0 && i >= 0) { var t = Math.min(extra, S.books[h][i].q); S.books[h][i].q -= t; extra -= t; i--; }
        if (extra > 0) S.over[h] -= extra;
      });
    };
    var toCart = function () {
      var c = empty();
      HOUSINGS.forEach(function (h) {
        c[vid(h, "std")] = stdN(h);
        if (S.special) {
          c[vid(h, "oversized")] = S.over[h];
          S.books[h].forEach(function (b) { var k = vid(h, folds(b.f)); c[k] = clamp(c[k] + b.q); });
        }
      });
      return c;
    };
    // coming back from the cart: open on what is already in it
    var fromCart = function () {
      var c = read(), t = totals(c);
      if (!t.count || t.count > MAX) return;
      S.total = t.count; S.glass = byHousing(c, "glass"); S.step = 3;
      HOUSINGS.forEach(function (h) {
        S.over[h] = c[vid(h, "oversized")];
        var list = [];
        for (var f = 1; f <= 10; f++) { var q = c[vid(h, folds(f))]; if (q) list.push({ f: f, q: q }); }
        S.books[h] = list.length ? list : [{ f: 1, q: 0 }];
        if (S.over[h] || list.length) S.special = true;
      });
    };
    if (!bdParams.get("h")) fromCart();
    var ico = function (n) { return '<svg class="ico" aria-hidden="true"><use href="#' + n + '"/></svg>'; };
    var mini = function (k, n, room, label) {
      return '<div class="bd-st sm"><button type="button" data-st="' + k + '" data-d="-1" aria-label="One fewer ' + label + '"' + (n <= 0 ? " disabled" : "") + ">" + ico("i-minus") + "</button><output>" + n + '</output><button type="button" data-st="' + k + '" data-d="1" aria-label="One more ' + label + '"' + (room <= 0 ? " disabled" : "") + ">" + ico("i-plus") + "</button></div>";
    };
    var sizesHtml = function () {
      return HOUSINGS.filter(function (h) { return inH(h) > 0; }).map(function (h) {
        var nm = PRICES[h].name, room = stdN(h), T = TABLE.types;
        var rows = '<div class="bd-z"><span class="bd-zn">Standard</span><span class="bd-zp">' + money(T.std[h].now) + '</span><span class="bd-zq" title="The rest of your ' + nm + ' cards">' + room + "</span></div>";
        rows += '<div class="bd-z"><span class="bd-zn">Oversized</span><span class="bd-zp">' + money(T.oversized[h].now) + "</span>" + mini("over:" + h, S.over[h], room, nm + " oversized card") + "</div>";
        S.books[h].forEach(function (b, i) {
          var opts = ""; for (var f = 1; f <= 10; f++) { if (f !== b.f && S.books[h].some(function (o) { return o.f === f; })) continue; opts += '<option value="' + f + '"' + (f === b.f ? " selected" : "") + ">" + f + (f === 1 ? " fold" : " folds") + "</option>"; }
          var many = S.books[h].length > 1;
          rows += '<div class="bd-z' + (many ? " has-x" : "") + '"><span class="bd-zn"><span class="bd-zw">Booklet</span><select data-fold="' + h + ":" + i + '" aria-label="' + nm + ' booklet folds">' + opts + "</select>" + (many ? '<button type="button" class="bd-x" data-rm="' + h + ":" + i + '" aria-label="Remove this ' + nm + " booklet with " + b.f + (b.f === 1 ? " fold" : " folds") + '">' + ico("i-x") + "</button>" : "") + '</span><span class="bd-zp">' + money(T[folds(b.f)][h].now) + "</span>" + mini("book:" + h + ":" + i, b.q, room, nm + " booklet") + "</div>";
        });
        // stays put once a booklet is in play; goes quiet (not away) when no cards are left to assign
        if (bookN(h) > 0 && S.books[h].length < 10) rows += '<button type="button" class="bd-more" data-more="' + h + '"' + (room > 0 ? "" : " disabled") + ">" + ico("i-plus") + "<span>Add a booklet with different folds</span></button>";
        return '<div class="bd-zg ' + h + '"><p class="bd-zh"><img src="./assets/hybrid_grading/' + (h === "glass" ? "hga-glass-828ebfd2" : "hga-poly-69885480") + '.svg" alt="' + nm + '" width="' + (h === "glass" ? 96 : 88) + '" height="16"><span>' + inH(h) + (inH(h) === 1 ? " card" : " cards") + "</span></p>" + rows + "</div>";
      }).join("") + '<p class="bd-note">Folds are how many times the booklet opens. <a href="https://raycazy.github.io/AI-workflow-tasks/hga-site/h/sizes.html">See every size</a></p>';
    };
    var bdRender = function (focus) {
      fit();
      var c = toCart(), t = totals(c), g = S.glass, p = S.total - g, one = S.total === 1;
      $$("[data-s]", bd).forEach(function (el) {
        var n = Number(el.dataset.s);
        el.classList.toggle("on", n === S.step); el.classList.toggle("done", n < S.step); el.classList.toggle("todo", n > S.step);
        $(".bd-b", el).hidden = n !== S.step;
        var head = $("button.bd-head", el);
        if (head) { head.disabled = n >= S.step; head.setAttribute("aria-label", n < S.step ? "Edit step " + n : ""); if (n >= S.step) head.removeAttribute("aria-label"); }
      });
      $$("[data-in]", bd).forEach(function (i) {
        var k = i.dataset.in, v = k === "total" ? S.total : k === "glass" ? g : p;
        if (document.activeElement !== i) i.value = v;
      });
      $$("[data-st]", bd).forEach(function (x) {
        var k = x.dataset.st, d = Number(x.dataset.d);
        if (k === "total") x.disabled = d < 0 ? S.total <= 1 : S.total >= MAX;
        if (k === "glass") x.disabled = d < 0 ? g <= 0 : g >= S.total;
        if (k === "poly") x.disabled = d < 0 ? p <= 0 : p >= S.total;
      });
      $$("[data-q]", bd).forEach(function (x) { x.setAttribute("aria-pressed", String(Number(x.dataset.q) === S.total)); });
      set("[data-sum='1']", S.total + (one ? " card" : " cards"));
      set("[data-sum='2']", g && p ? g + " Glass, " + p + " Poly" : g ? (one ? "Glass" : "All Glass") : (one ? "Poly" : "All Poly"));
      set("[data-t2]", one ? "Glass or Poly?" : "How many in Glass, how many in Poly?");
      // one card is a single tap; more cards get steppers and a slider that always add up to the total
      bd.classList.toggle("is-one", one);
      $$("[data-pick]", bd).forEach(function (x) { var on = inH(x.dataset.pick) > 0; x.classList.toggle("sel", on); x.classList.toggle("off", !on);
        if (one) { x.setAttribute("role", "radio"); x.setAttribute("aria-checked", String(on)); x.tabIndex = 0; } else { x.removeAttribute("role"); x.removeAttribute("aria-checked"); x.removeAttribute("tabindex"); } });
      var r = $("[data-range]", bd); r.max = S.total; r.value = g; r.hidden = one; r.style.setProperty("--p", (g / S.total * 100) + "%");
      $$("[data-special]", bd).forEach(function (x) { x.setAttribute("aria-checked", String((x.dataset.special === "1") === S.special)); });
      var box = $("[data-sizes]", bd); box.hidden = !S.special;
      if (S.special) box.innerHTML = sizesHtml();
      var tot = $("[data-total]", bd), acts = $("[data-acts]", bd);
      tot.hidden = S.step < 2; acts.hidden = S.step < 3;
      set("[data-t-count]", t.count + (t.count === 1 ? " pass" : " passes") + (g && p ? " · " + g + " Glass, " + p + " Poly" : ""));
      set("[data-t-now]", money(t.now));
      set("[data-t-save]", t.save > 0 ? "Save " + money(t.save) + " vs launch pricing" : "Presale price through " + TABLE.presale_ends + ".");
      var solo = one && !S.special;
      set("[data-claim-label]", solo ? "Claim my " + money(t.now) + " " + PRICES[g ? "glass" : "poly"].name : "Claim my " + t.count + (t.count === 1 ? " pass" : " passes"));
      // the slab on the left follows the housing in play
      var showH = g > 0 ? "glass" : "poly";
      $$("[data-slab]").forEach(function (e) { e.hidden = e.dataset.slab !== showH; });
      set("[data-pdp-name]", PRICES[showH].name);
      if (focus) { var f = $(focus, bd); if (f && !f.disabled) f.focus({ preventScroll: true }); }
    };
    var goTo = function (n) {
      S.step = n; bdRender();
      var el = $('[data-s="' + n + '"]', bd);
      el.tabIndex = -1; el.focus({ preventScroll: true });
      if (el.getBoundingClientRect().top < 70) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    var setTotal = function (n) {
      // keep the split when the count changes: a housing already at zero stays at zero
      var wasPoly = S.total - S.glass, n2 = Math.max(1, Math.min(MAX, n));
      if (S.glass === 0) S.glass = 0; else if (wasPoly === 0) S.glass = n2; else S.glass = Math.min(S.glass, n2);
      S.total = n2;
    };
    bd.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("button,[data-pick]") : null;
      if (!t) return;
      if (t.hasAttribute("data-go")) { goTo(Number(t.dataset.go)); return; }
      if (t.hasAttribute("data-q")) { setTotal(Number(t.dataset.q)); bdRender(); return; }
      if (t.hasAttribute("data-special")) { S.special = t.dataset.special === "1"; bdRender(); return; }
      if (t.hasAttribute("data-more")) {
        var mh = t.dataset.more, list = S.books[mh], nf = 1;
        while (nf < 10 && list.some(function (o) { return o.f === nf; })) nf++;
        list.push({ f: nf, q: 1 });
        bdRender('[data-fold="' + mh + ":" + (list.length - 1) + '"]');
        return;
      }
      if (t.hasAttribute("data-rm")) {
        var rm = t.dataset.rm.split(":");
        S.books[rm[0]].splice(Number(rm[1]), 1);
        bdRender('[data-more="' + rm[0] + '"]');
        if (document.activeElement === document.body) { var ff = $('[data-fold="' + rm[0] + ':0"]', bd); if (ff) ff.focus({ preventScroll: true }); }
        return;
      }
      if (t.hasAttribute("data-st")) {
        var k = t.dataset.st, d = Number(t.dataset.d), part = k.split(":");
        if (k === "total") setTotal(S.total + d);
        else if (k === "glass") S.glass += d;
        else if (k === "poly") S.glass -= d;
        else if (part[0] === "over") S.over[part[1]] = Math.max(0, S.over[part[1]] + d);
        else if (part[0] === "book") { var b = S.books[part[1]][Number(part[2])]; b.q = Math.max(0, b.q + d); }
        var dSel = '[data-st="' + k + '"][data-d="' + d + '"]';
        bdRender(dSel);
        // a stepper button that just hit its limit is disabled: keep the keyboard on the stepper
        if (document.activeElement === document.body) { var other = $('[data-st="' + k + '"][data-d="' + (-d) + '"]', bd); if (other && !other.disabled) other.focus({ preventScroll: true }); }
        return;
      }
      if (t.hasAttribute("data-pick") && bd.classList.contains("is-one")) { S.glass = t.dataset.pick === "glass" ? 1 : 0; bdRender(); }
    });
    bd.addEventListener("keydown", function (e) {
      var t = e.target;
      if (bd.classList.contains("is-one") && t.hasAttribute && t.hasAttribute("data-pick") && (e.key === " " || e.key === "Enter" || e.key.indexOf("Arrow") === 0)) {
        e.preventDefault();
        S.glass = e.key.indexOf("Arrow") === 0 ? (S.glass ? 0 : 1) : (t.dataset.pick === "glass" ? 1 : 0);
        bdRender('[data-pick="' + (S.glass ? "glass" : "poly") + '"]');
      }
    });
    bd.addEventListener("input", function (e) {
      var i = e.target;
      if (i.hasAttribute("data-range")) { S.glass = Number(i.value); bdRender(); return; }
      if (!i.hasAttribute("data-in")) return;
      if (i.value === "") return;
      var v = Math.max(0, parseInt(i.value, 10) || 0);
      if (i.dataset.in === "total") setTotal(v);
      if (i.dataset.in === "glass") S.glass = v;
      if (i.dataset.in === "poly") S.glass = S.total - Math.min(v, S.total);
      bdRender();
    });
    bd.addEventListener("change", function (e) {
      var i = e.target;
      if (i.hasAttribute("data-in")) { i.blur(); bdRender(); return; }
      if (i.hasAttribute("data-fold")) { var p = i.dataset.fold.split(":"); S.books[p[0]][Number(p[1])].f = Number(i.value); bdRender('[data-fold="' + i.dataset.fold + '"]'); }
    });
    // the buy box describes the whole order, so it replaces the cart rather than adding to it
    $("[data-claim-all]", bd).addEventListener("click", function () { write(toCart()); location.href = "cart.html"; });
    $("[data-buy-now]", bd).addEventListener("click", function () { write(toCart()); location.href = "checkout.html"; });
    bdRender();
  }

  // ---------- claim buttons (variation A): add one slot and open the cart ----------
  $$("[data-claim]").forEach(function (b) {
    b.addEventListener("click", function () { add(b.dataset.claim === "poly" ? "poly" : "glass", 1); location.href = "cart.html"; });
  });
  // ---------- cart page + checkout summary controls (delegated: the booklet rows are cloned at run time) ----------
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-cart-step],[data-cart-remove],[data-cart-add]") : null;
    if (!b) return;
    var c = read();
    if (b.hasAttribute("data-cart-step")) { var v = b.dataset.cartStep; c[v] = clamp(c[v] + Number(b.dataset.d)); write(c); }
    else if (b.hasAttribute("data-cart-remove")) { c[b.dataset.cartRemove] = 0; write(c); }
    else if (b.hasAttribute("data-cart-add")) { add(b.dataset.cartAdd, Number(b.dataset.n || 1)); }
  });
  document.addEventListener("change", function (e) {
    var i = e.target;
    if (i && i.tagName === "INPUT" && i.hasAttribute("data-line-q")) { var c = read(); c[i.dataset.lineQ] = clamp(i.value); write(c); }
  });
  $$("[data-c-go]").forEach(function (a) { a.addEventListener("click", function (e) { if (a.classList.contains("is-off")) e.preventDefault(); }); });

  // ---------- checkout ----------
  var co = $("[data-checkout-form]");
  if (co) {
    var gift = $("[data-gift-toggle]"), giftFields = $("[data-gift-fields]");
    if (gift) gift.addEventListener("change", function () {
      giftFields.hidden = !gift.checked;
      $$("input", giftFields).forEach(function (i) { i.required = gift.checked && i.dataset.req === "1"; });
    });
    var cc = $("[data-cc]");
    if (cc) cc.addEventListener("input", function () {
      var d = cc.value.replace(/\D/g, "").slice(0, 16);
      cc.value = d.replace(/(.{4})/g, "$1 ").trim();
    });
    var exp = $("[data-exp]");
    if (exp) exp.addEventListener("input", function () {
      var d = exp.value.replace(/\D/g, "").slice(0, 4);
      exp.value = d.length > 2 ? d.slice(0, 2) + " / " + d.slice(2) : d;
    });
    var place = function (method) {
      var c = read();
      if (totals(c).count === 0) { location.href = "cart.html"; return; }
      var email = ($("#co-email") || {}).value || "you@example.com";
      var order = {
        num: "HGA-" + String(Date.now()).slice(-6),
        items: c, poly: byHousing(c, "poly"), glass: byHousing(c, "glass"), email: email,
        name: ($("#co-first") || {}).value || "",
        gift: gift && gift.checked ? (($("#gift-email") || {}).value || "") : "",
        method: method
      };
      try { localStorage.setItem(ORDER, JSON.stringify(order)); } catch (e) {}
      try { sessionStorage.setItem(ORDER, JSON.stringify(order)); } catch (e) {}
      write(empty());
      location.href = "thank-you.html";
    };
    // inline errors: a message under each invalid field, first one focused
    var msg = function (f) {
      if (f.validity.valueMissing) return f.type === "checkbox" ? "Please confirm to continue." : "This field is required.";
      if (f.validity.typeMismatch) return "Enter a valid email address.";
      return f.validationMessage;
    };
    var clear = function (f) {
      f.removeAttribute("aria-invalid");
      var e = document.getElementById(f.id + "-err"); if (e) e.remove();
    };
    co.addEventListener("invalid", function (e) {
      var f = e.target; e.preventDefault();
      if (!f.id) f.id = "f" + Math.random().toString(36).slice(2, 8);
      clear(f);
      var p = document.createElement("p");
      p.className = "err"; p.id = f.id + "-err"; p.textContent = msg(f);
      f.setAttribute("aria-invalid", "true"); f.setAttribute("aria-describedby", p.id);
      (f.type === "checkbox" ? f.closest(".chk") : f).insertAdjacentElement("afterend", p);
      if (!co._focused) { co._focused = true; f.focus(); setTimeout(function () { co._focused = false; }, 0); }
    }, true);
    $$("input,select,textarea", co).forEach(function (f) { f.addEventListener("input", function () { if (f.checkValidity()) clear(f); }); f.addEventListener("change", function () { if (f.checkValidity()) clear(f); }); });
    co.addEventListener("submit", function (e) { e.preventDefault(); place("card"); });
    $$("[data-express]").forEach(function (b) { b.addEventListener("click", function () { place(b.dataset.express); }); });
  }

  // ---------- thank you ----------
  var ty = $("[data-thanks]");
  if (ty) {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(ORDER) || "null"); } catch (e) {}
    if (!o) o = { num: "HGA-204117", poly: 2, glass: 1, email: "you@example.com", name: "", gift: "" };
    var items = o.items ? norm(o.items) : norm({ poly: o.poly, glass: o.glass });
    fill(items, ty);
    set("[data-o-num]", o.num);
    set("[data-o-email]", o.email);
    if (o.name) set("[data-o-name]", ", " + o.name);
    $$("[data-o-gift]").forEach(function (e) { e.hidden = !o.gift; });
    set("[data-o-gift-email]", o.gift);

    // one pass card per card bought, up to 6 shown
    var tpl = $("[data-pass-tpl]"), wall = $("[data-pass-wall]"), more = $("[data-pass-more]");
    if (tpl && wall) {
      // show a mix when both housings were bought: up to 3 of each, then fill
      var og = byHousing(items, "glass"), op = byHousing(items, "poly");
      var g = Math.min(og, op ? 3 : 6), pl = Math.min(op, 6 - g);
      g = Math.min(og, 6 - pl);
      var list = [], total = og + op;
      for (var i = 0; i < g; i++) list.push("glass");
      for (var j = 0; j < pl; j++) list.push("poly");
      list.forEach(function (h, k) {
        var el = tpl.cloneNode(true);
        el.removeAttribute("data-pass-tpl"); el.hidden = false;
        el.classList.add(h);
        $("[data-pass-h]", el).textContent = PRICES[h].name;
        $("[data-pass-logo]", el).src = h === "glass" ? "./assets/hybrid_grading/hga-glass-828ebfd2.svg" : "./assets/hybrid_grading/hga-poly-69885480.svg";
        $("[data-pass-logo]", el).alt = PRICES[h].name;
        var code = o.num.replace("HGA-", "") + "-" + String(k + 1).padStart(3, "0");
        $("[data-pass-code]", el).textContent = "PASS " + code;
        el.style.setProperty("--i", k);
        wall.insertBefore(el, more || null);
      });
      if (more) { more.hidden = total <= 6; more.textContent = "+" + (total - 6) + " more in My Passes"; }
    }

    // a calendar reminder for the day booking opens
    var ics = $("[data-ics]");
    if (ics) {
      var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HGA//Presale//EN", "BEGIN:VEVENT",
        "UID:hga-calendar-opens-2027@hybridgrading.com", "DTSTAMP:20261101T000000Z",
        "DTSTART;VALUE=DATE:20270201", "DTEND;VALUE=DATE:20270202",
        "SUMMARY:HGA grading calendar opens: reserve your grading day",
        "DESCRIPTION:Your HGA passes are ready to book. Reserve any open day up to a year ahead from My Passes.",
        "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      try { ics.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" })); } catch (e) {}
    }
  }

  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { var t = b.dataset.label || b.textContent; b.dataset.label = t; b.textContent = "Link copied"; setTimeout(function () { b.textContent = t; }, 2000); };
      try { navigator.clipboard.writeText(b.dataset.copy).then(done, done); } catch (e) { done(); }
    });
  });

  window.HGA_PRICES = PRICES; window.HGA_SIZES = SIZES; window.HGA_PRICING = TABLE;
  // used by the buy box design options (shop-a/b/c.html, assets/buybox-options.js)
  window.HGA_CART = { add: add, read: read, write: write, price: price, unit: unit, vid: vid, money: money, variants: VARIANTS, bulk: BULK };
  badge(false);
  render();
})();
