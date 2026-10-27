/* HGA Founder's Launch — interactions (vanilla, no dependencies) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- Count-up numbers ---------- */
  const fmt = new Intl.NumberFormat("en-US");
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = +el.dataset.count;
      const dur = 1800;
      const t0 = performance.now();
      const tick = (t) => {
        const k = clamp((t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt.format(Math.round(end * eased));
        if (k < 1) requestAnimationFrame(tick);
      };
      reduce ? (el.textContent = fmt.format(end)) : requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- Word-by-word scrub headline ---------- */
  const scrub = $("[data-scrub]");
  if (scrub) {
    const wrap = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.append(part);
            else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.append(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrap(n);
      });
    };
    wrap(scrub);
  }
  const scrubWords = scrub ? $$(".w", scrub) : [];

  /* ---------- Watch-us cycler ---------- */
  const list = $("#watchList");
  if (list) {
    const items = $$("li:not(.arr)", list);
    const ind = $(".watch-indicator", list);
    let i = 0;
    const place = () => {
      items.forEach((li, j) => li.classList.toggle("is-active", j === i));
      ind.style.left = items[i].offsetLeft + "px";
      ind.style.width = items[i].offsetWidth + "px";
      ind.style.top = items[i].offsetTop + "px";
      ind.style.height = items[i].offsetHeight + "px";
    };
    place();
    addEventListener("resize", place);
    document.fonts && document.fonts.ready.then(place);
    if (!reduce) setInterval(() => { i = (i + 1) % items.length; place(); }, 1900);
  }

  /* ---------- Glass booklet: tilt, glare and loupe ---------- */
  const booklet = $("#booklet");
  if (booklet) {
    const stage = $(".booklet-inner", booklet);
    const img = $("img", stage);
    const lens = $(".booklet-lens", stage);
    const ZOOM = 2.6;
    const move = (e) => {
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const px = x / r.width, py = y / r.height;
      if (px < 0 || px > 1 || py < 0 || py > 1) return;
      stage.style.setProperty("--mx", px * 100 + "%");
      stage.style.setProperty("--my", py * 100 + "%");
      if (!reduce && finePointer) {
        booklet.classList.add("tilting");
        stage.style.setProperty("--ry", (px - 0.5) * 10 + "deg");
        stage.style.setProperty("--rx", (0.5 - py) * 8 + "deg");
      }
      lens.style.left = x + "px";
      lens.style.top = y + "px";
      lens.style.backgroundSize = img.clientWidth * ZOOM + "px " + img.clientHeight * ZOOM + "px";
      lens.style.backgroundPosition = -(x * ZOOM - lens.offsetWidth / 2) + "px " + -(y * ZOOM - lens.offsetHeight / 2) + "px";
      booklet.classList.add("lens-on");
    };
    const leave = () => {
      booklet.classList.remove("lens-on", "tilting");
      stage.style.setProperty("--rx", "0deg");
      stage.style.setProperty("--ry", "0deg");
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerdown", move);
    stage.addEventListener("pointerleave", leave);
    stage.addEventListener("pointercancel", leave);
  }

  /* ---------- 3D tilt (slabs, pass) ---------- */
  if (finePointer && !reduce) {
    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.classList.add("tilting");
        el.style.setProperty("--ry", (x - 0.5) * 22 + "deg");
        el.style.setProperty("--rx", (0.5 - y) * 22 + "deg");
        el.style.setProperty("--mx", x * 100 + "%");
        el.style.setProperty("--my", y * 100 + "%");
      });
      el.addEventListener("pointerleave", () => {
        el.classList.remove("tilting");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });

    /* spotlight cards */
    $$(".spot").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--sx", e.clientX - r.left + "px");
        el.style.setProperty("--sy", e.clientY - r.top + "px");
      });
    });
  }

  /* ---------- Day grids (features card + guarantee) ---------- */
  const dayDots = $(".day-dots");
  if (dayDots) {
    for (let d = 1; d <= 30; d++) { const i = document.createElement("i"); i.textContent = d; dayDots.append(i); }
    const dots = $$("i", dayDots);
    let n = 0;
    if (!reduce) setInterval(() => { n = (n + 1) % 33; dots.forEach((el, k) => el.classList.toggle("on", k < n)); }, 260);
    else dots.forEach((el) => el.classList.add("on"));
  }
  const gcDays = $("#gcDays");
  if (gcDays) {
    for (let d = 1; d <= 15; d++) { const i = document.createElement("i"); i.textContent = d; if (d === 15) i.className = "last"; gcDays.append(i); }
    const cells = $$("i", gcDays);
    const gio = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      cells.forEach((c, k) => setTimeout(() => c.classList.add("on"), reduce ? 0 : 200 + k * 110));
      gio.disconnect();
    }, { threshold: 0.6 });
    gio.observe(gcDays);
  }

  /* ---------- Hero particles ---------- */
  const cvs = $("#particles");
  if (cvs && !reduce) {
    const ctx = cvs.getContext("2d");
    let w, h, dpr, pts = [];
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cvs.clientWidth; h = cvs.clientHeight;
      cvs.width = w * dpr; cvs.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, (w * h) / 18000));
      pts = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.3, vy: -(Math.random() * 0.25 + 0.05), a: Math.random() * 0.6 + 0.1 }));
    };
    size(); addEventListener("resize", size);
    let heroVisible = true;
    new IntersectionObserver((es) => { heroVisible = es[0].isIntersecting; }).observe(cvs);
    const draw = () => {
      if (heroVisible) {
        ctx.clearRect(0, 0, w, h);
        pts.forEach((p) => {
          p.y += p.vy; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(230,36,41,${p.a})`; ctx.fill();
        });
      }
      requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------- Scroll-driven effects ---------- */
  const nav = $("#nav");
  const sticky = $("#stickyCta");
  const hero = $(".hero");
  const pricing = $("#pricing");
  const videoFrame = $(".video-frame");
  const parallaxEls = $$("[data-parallax]");
  const bigWord = $("[data-fill]");
  const glass = $(".glassbox");
  const gbSteps = glass ? $$(".gb-step", glass) : [];
  const gbOpacity = $("#gbOpacity");
  const gbVis = $("#gbVis");
  const timeline = $("#timeline");
  const tlSteps = timeline ? $$(".tl-step", timeline) : [];
  const shoulderImg = $(".shoulder-media img");

  const onScroll = () => {
    const y = scrollY;
    const vh = innerHeight;
    nav.classList.toggle("scrolled", y > 20);

    // sticky mobile CTA: show after hero, hide while pricing is on screen
    if (sticky && hero && pricing) {
      const pr = pricing.getBoundingClientRect();
      const inPricing = pr.top < vh && pr.bottom > 0;
      sticky.classList.toggle("show", hero.getBoundingClientRect().bottom < 0 && !inPricing);
    }

    if (reduce) {
      if (glass) { glass.style.setProperty("--p", 1); glass.classList.add("is-glass"); gbSteps.forEach((s) => s.classList.add("on")); }
      if (bigWord) bigWord.style.setProperty("--fill", 1);
      scrubWords.forEach((w) => w.classList.add("on"));
      if (timeline) timeline.style.setProperty("--tl", 1);
      return;
    }

    // hero: video frame flattens, slabs drift
    if (videoFrame) {
      const k = clamp(y / (vh * 0.6));
      videoFrame.style.setProperty("--vf-rx", 8 - k * 8 + "deg");
    }
    parallaxEls.forEach((el) => { el.style.translate = `0 ${y * +el.dataset.parallax}px`; });

    // manifesto word scrub
    if (scrub) {
      const r = scrub.getBoundingClientRect();
      const k = clamp((vh * 0.85 - r.top) / (vh * 0.55 + r.height * 0.5));
      const lit = Math.round(k * scrubWords.length);
      scrubWords.forEach((w, i) => w.classList.toggle("on", i < lit));
    }

    // TRANSPARENCY fill
    if (bigWord) {
      const r = bigWord.getBoundingClientRect();
      bigWord.style.setProperty("--fill", clamp((vh * 0.9 - r.top) / (vh * 0.6)).toFixed(3));
    }

    // Glass-box cube
    if (glass) {
      const r = glass.getBoundingClientRect();
      const total = r.height - vh;
      const p = clamp(-r.top / total);
      glass.style.setProperty("--p", p.toFixed(4));
      glass.classList.toggle("is-glass", p > 0.32);
      gbSteps.forEach((s) => s.classList.toggle("on", p >= +s.dataset.at));
      const op = Math.round((1 - clamp(p * 1.05)) * 100);
      if (gbOpacity) gbOpacity.textContent = op + "%";
      if (gbVis) gbVis.textContent = p < 0.25 ? "NONE" : p < 0.6 ? "PARTIAL" : "FULL";
    }

    // shoulder image zoom-out
    if (shoulderImg) {
      const r = shoulderImg.parentElement.getBoundingClientRect();
      const k = clamp((vh - r.top) / (vh + r.height));
      shoulderImg.style.transform = `scale(${1.18 - k * 0.18})`;
    }

    // timeline fill + active steps
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const k = clamp((vh * 0.55 - r.top) / r.height);
      timeline.style.setProperty("--tl", k.toFixed(4));
      tlSteps.forEach((s) => {
        const sr = s.getBoundingClientRect();
        s.classList.toggle("active", sr.top + sr.height / 2 < vh * 0.62);
      });
    }
  };

  // slow idle spin on the cube so it never looks frozen
  if (glass && !reduce) {
    let spin = 0;
    const idle = () => { spin = (spin + 0.12) % 360; glass.style.setProperty("--spin", spin + "deg"); requestAnimationFrame(idle); };
    idle();
  }

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- Video modal ---------- */
  const modal = $("#videoModal");
  const open = $("#openVideo");
  if (modal && open) {
    const close = () => { modal.hidden = true; document.body.style.overflow = ""; open.focus(); };
    open.addEventListener("click", () => { modal.hidden = false; document.body.style.overflow = "hidden"; $(".modal-close", modal).focus(); });
    $$("[data-close]", modal).forEach((el) => el.addEventListener("click", close));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
  }
})();

/* Priority Grading Calendar illustration: available, full and weekend days, one date picked */
(() => {
  const cal = document.querySelector("[data-cal-ui]");
  if (!cal) return;
  const full = [1, 2, 3, 4, 5, 8, 9];
  let h = "";
  for (let d = 1; d <= 28; d++) {
    const wd = (d - 1) % 7;
    const cls = wd > 4 ? "off" : full.includes(d) ? "full" : d === 12 ? "pick" : "";
    h += `<i class="${cls}">${d}</i>`;
  }
  cal.innerHTML = h;
})();
