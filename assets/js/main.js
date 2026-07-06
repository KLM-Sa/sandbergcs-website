/* ============================================================
   Sandberg Creation Studio — main.js
   Vanilla JS, keine Libraries.
   ============================================================ */
(function () {
  "use strict";

  var body = document.body;

  /* ---------- Hero Reveal (beim Laden) ---------- */
  /* gilt für den Start-Hero UND den Projektseiten-Header (gleiche Eingangs-Geste).
     Doppel-rAF: Startzustand wird sicher gemalt, bevor die Transition triggert.
     setTimeout-Fallback: rAF ist in Hintergrund-Tabs/Sparmodus pausiert — ohne
     Fallback bliebe die Seite dort dauerhaft im versteckten Startzustand. */
  var hero = document.querySelector(".hero, .case__hero");
  if (hero) {
    var heroIn = function () { hero.classList.add("is-in"); };
    requestAnimationFrame(function () {
      requestAnimationFrame(heroIn);
    });
    setTimeout(heroIn, 600);
  }

  /* ---------- Footer: Copyright-Jahr automatisch aktuell ---------- */
  var copyEl = document.querySelector(".ft__copy");
  if (copyEl) {
    copyEl.textContent = copyEl.textContent.replace(/\d{4}/, String(new Date().getFullYear()));
  }

  /* ---------- Navigation: bei Scroll ein-/ausblenden ---------- */
  var nav = document.querySelector(".nav");
  var lastY = window.pageYOffset;
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset;
    if (!nav) return;
    if (y > lastY && y > 200 && !menuOpen) {
      nav.classList.add("is-hidden");   // runter -> verstecken
    } else {
      nav.classList.remove("is-hidden"); // hoch -> zeigen
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* ---------- Fullscreen-Menü ---------- */
  var burger = document.querySelector(".burger");
  var menu = document.querySelector(".menu");
  var menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    if (burger) {
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
    }
    if (menu) menu.classList.toggle("is-open", open);
    body.classList.toggle("no-scroll", open);
  }
  if (burger) {
    burger.addEventListener("click", function () { setMenu(!menuOpen); });
  }
  // Menü-Link geklickt -> schließen
  if (menu) {
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
  }
  // ESC schließt
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menuOpen) setMenu(false);
  });

  /* ---------- Scroll-to-top (#top sitzt auf dem fixen Header,
       darum scrollt der native Anker-Sprung nicht — manuell behandeln) ---------- */
  document.querySelectorAll('a[href="#top"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ---------- Sprachumschalter (DE / EN) ---------- */
  var STORE_KEY = "scs-lang";
  var langButtons = document.querySelectorAll(".lang button");

  function applyLang(lang) {
    document.documentElement.setAttribute("lang", lang);
    document.querySelectorAll("[data-de]").forEach(function (el) {
      var val = el.getAttribute("data-" + lang);
      if (val !== null) el.textContent = val;
    });
    document.querySelectorAll("[data-de-ph]").forEach(function (el) {
      var val = el.getAttribute("data-" + lang + "-ph");
      if (val !== null) el.setAttribute("placeholder", val);
    });
    langButtons.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-lang") === lang);
    });
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
  }
  langButtons.forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
  });
  var saved = "de";
  try { saved = localStorage.getItem(STORE_KEY) || "de"; } catch (e) {}
  applyLang(saved);

  /* ---------- Globales Berg-Leitmotiv ---------- */
  /* Ein einziger Berg: startet in exakter Hero-Größe und skaliert übers erste
     Viewport in die untere rechte Ecke — von da an der „wandernde" Berg für die
     ganze Seite. Die Farbe macht mix-blend-mode (pixelgenau pro Sektion). */
  var berg = document.querySelector(".berg");
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  var BERG_PARKED = 0.52; // End-Skalierung (≈ alte Eckgröße)

  if (berg) {
    if (reduceMotion) {
      berg.style.setProperty("--berg-scale", String(BERG_PARKED));
      berg.style.setProperty("--berg-op", "0.048");
    } else {
      var bergTicking = false;

      function updateBerg() {
        var vh = window.innerHeight;
        var p = Math.min(1, Math.max(0, window.pageYOffset / vh)); // 0..1 übers 1. Viewport
        var scale = 1 - p * (1 - BERG_PARKED); // 1 (Hero) -> 0.52 (Ecke)
        var op = 0.06 - p * (0.06 - 0.048);    // Hero 0.06 -> Sand 0.048
        berg.style.setProperty("--berg-scale", scale.toFixed(3));
        berg.style.setProperty("--berg-op", op.toFixed(4));
        bergTicking = false;
      }

      function onBergScroll() {
        if (!bergTicking) { window.requestAnimationFrame(updateBerg); bergTicking = true; }
      }

      updateBerg();
      window.addEventListener("scroll", onBergScroll, { passive: true });
      window.addEventListener("resize", updateBerg);
    }
  }

  /* ---------- Prozess: Fortschritts-Pfad ---------- */
  /* Orangener Pfad füllt sich beim Scrollen entlang der Timeline; jeder Knoten
     wird aktiv, sobald der Pfad ihn erreicht. Referenzlinie: 55% Viewport-Höhe. */
  var prcSteps = document.querySelector(".prc__steps");
  if (prcSteps) {
    var prcPath = prcSteps.querySelector(".prc__path");
    var prcFill = prcSteps.querySelector(".prc__path-fill");
    var prcStepEls = Array.prototype.slice.call(prcSteps.querySelectorAll(".prc__step"));
    var prcNodes = prcStepEls.map(function (s) { return s.querySelector(".prc__step-num"); });
    var prcTicking = false;

    function updatePrc() {
      if (!prcNodes.length) { prcTicking = false; return; }
      var nodeH = prcNodes[0].offsetHeight;
      var stepsTopDoc = prcSteps.getBoundingClientRect().top + window.pageYOffset;
      var firstCenter = prcNodes[0].getBoundingClientRect().top + window.pageYOffset - stepsTopDoc + nodeH / 2;
      var lastCenter = prcNodes[prcNodes.length - 1].getBoundingClientRect().top + window.pageYOffset - stepsTopDoc + nodeH / 2;
      var pathH = Math.max(0, lastCenter - firstCenter);
      prcPath.style.top = firstCenter.toFixed(1) + "px";
      prcPath.style.height = pathH.toFixed(1) + "px";

      var refDoc = window.pageYOffset + window.innerHeight * 0.55;
      var pathTopDoc = stepsTopDoc + firstCenter;
      var filled = Math.min(pathH, Math.max(0, refDoc - pathTopDoc));
      prcFill.style.height = filled.toFixed(1) + "px";

      prcNodes.forEach(function (n, i) {
        var c = n.getBoundingClientRect().top + window.pageYOffset + n.offsetHeight / 2;
        prcStepEls[i].classList.toggle("is-reached", c <= refDoc + 0.5);
      });

      /* Stück für Stück aufbauen: nächster Schritt erscheint erst, wenn der
         Knoten des vorherigen orange geworden ist. Reversibel — beim Hochscrollen
         baut sich der Aufbau wieder ab, damit er bei jedem Durchlauf neu abläuft. */
      prcStepEls.forEach(function (step, i) {
        var show = (i === 0)
          ? stepsTopDoc < window.pageYOffset + window.innerHeight * 0.72
          : prcStepEls[i - 1].classList.contains("is-reached");
        step.classList.toggle("is-shown", show);
      });
      prcTicking = false;
    }

    function onPrcScroll() {
      if (!prcTicking) { window.requestAnimationFrame(updatePrc); prcTicking = true; }
    }

    updatePrc();
    window.addEventListener("scroll", onPrcScroll, { passive: true });
    window.addEventListener("resize", updatePrc);
  }

  /* ---------- Generischer Reveal-on-Scroll ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-revealed"); });
  }

  /* ---------- Prozess-Ränder exakt an Leistungen angleichen ---------- */
  /* Sektion 01 (Leistungen) zentriert ihren Inhalt in 100svh — der Rand oben/unten
     ist daher dynamisch (abhängig von Viewport-Höhe und vh-basierten Innenabständen).
     Damit Sektion 03 (Prozess) exakt denselben Rand erhält, messen wir den
     oberen Rand von 01 und übertragen ihn als symmetrisches Padding auf 03.
     offsetTop ist layout-basiert und damit unabhängig vom Reveal-Transform.
     Das CSS-`calc()` auf .prc bleibt als Fallback ohne JS bestehen. */
  var lstTitleEl = document.querySelector(".lst__title");
  var prcSection = document.querySelector(".prc");
  if (lstTitleEl && prcSection) {
    var syncTicking = false;
    function syncPrcPadding() {
      var gap = lstTitleEl.offsetTop; // .lst__inner hat kein padding-top -> = oberer Rand
      if (gap > 0) {
        prcSection.style.paddingTop = gap + "px";
        prcSection.style.paddingBottom = gap + "px";
      }
      syncTicking = false;
    }
    syncPrcPadding();
    window.addEventListener("load", syncPrcPadding);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncPrcPadding);
    }
    window.addEventListener("resize", function () {
      if (!syncTicking) { window.requestAnimationFrame(syncPrcPadding); syncTicking = true; }
    });
  }

  /* ---------- Prozess: Headline→1. Punkt exakt wie Leistungen→Campaigns ---------- */
  /* Der wahrgenommene Abstand soll in beiden Sektionen pixelgenau gleich sein.
     Knifflig, weil die ersten Elemente verschiedene line-heights haben (Campaigns
     1.5 vs. Schritt-Titel 1.05) und „Leistungen" eine Unterlänge hat. Wir messen
     daher den Abstand Schrift-Grundlinie(Headline) → Versalhöhe-Oberkante(1. Element)
     in BEIDEN Sektionen und gleichen Sektion 03 an Sektion 01 an.
     Transform-immun: Box-Position via offsetTop-Kette (ignoriert Reveal-Transform),
     Grundlinien-/Versal-Offsets via Canvas-Schriftmetriken. */
  var prcTitleEl = document.querySelector(".prc__title");
  var lstTitleHead = document.querySelector(".lst__title");
  var lstFirstItem = document.querySelector(".lst__cat-title");          // „Campaigns"
  var prcFirstItem = document.querySelector(".prc__step-title");          // 1. Schritt
  if (prcTitleEl && lstTitleHead && lstFirstItem && prcFirstItem) {
    var gapCanvas = document.createElement("canvas").getContext("2d");

    function docTop(el) {                 // Y im Dokument, ohne Transform
      var y = 0;
      for (var n = el; n; n = n.offsetParent) { y += n.offsetTop; }
      return y;
    }
    function fontMetrics(el, sampleText) {
      var cs = getComputedStyle(el);
      gapCanvas.font = cs.fontWeight + " " + parseFloat(cs.fontSize) + "px " + cs.fontFamily;
      var m = gapCanvas.measureText(sampleText || el.textContent.trim());
      var lh = parseFloat(cs.lineHeight);
      if (isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.2;
      var fAsc = m.fontBoundingBoxAscent, fDesc = m.fontBoundingBoxDescent;
      var leadHalf = (lh - (fAsc + fDesc)) / 2;
      return { leadHalf: leadHalf, fAsc: fAsc, fDesc: fDesc, capAsc: m.actualBoundingBoxAscent };
    }
    /* Grundlinie der LETZTEN Zeile der Headline (falls sie umbricht) */
    function headlineBaseline(el) {
      var fm = fontMetrics(el);
      return docTop(el) + el.offsetHeight - (fm.leadHalf + fm.fDesc);
    }
    /* Versalhöhe-Oberkante der ERSTEN Zeile eines Folge-Elements */
    function itemCapTop(el) {
      var fm = fontMetrics(el);
      return docTop(el) + fm.leadHalf + (fm.fAsc - fm.capAsc);
    }

    var gapTicking = false;
    function syncPrcHeadGap() {
      var leistGap = itemCapTop(lstFirstItem) - headlineBaseline(lstTitleHead);
      var prcGap = itemCapTop(prcFirstItem) - headlineBaseline(prcTitleEl);
      if (leistGap > 0 && prcGap > 0) {
        var cur = parseFloat(getComputedStyle(prcTitleEl).marginBottom) || 0;
        var next = cur + (leistGap - prcGap);
        if (next > 0) prcTitleEl.style.marginBottom = next.toFixed(2) + "px";
      }
      gapTicking = false;
    }
    syncPrcHeadGap();
    window.addEventListener("load", syncPrcHeadGap);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncPrcHeadGap);
    }
    window.addEventListener("resize", function () {
      if (!gapTicking) { window.requestAnimationFrame(syncPrcHeadGap); gapTicking = true; }
    });
  }

  /* ---------- Portfolio: schwebende Sphere (04) ---------- */
  /* Fibonacci-verteilte Punkte auf einer Kugel; jedes Thumbnail bleibt zur Kamera
     gedreht (Billboard — kein Eigen-Rotieren), nur Position + Tiefe ändern sich.
     Tiefe steuert Opazität/Unschärfe/z-index. Auto-Rotation + Drag (Maus & Touch).
     Läuft auf allen Größen (auf dem Phone nur kleiner) — aus außer bei
     reduced-motion (dann das ruhige Raster/Swipe-Fallback aus dem CSS).
     rAF läuft nur, solange im Viewport. */
  var pfStage = document.querySelector(".pf__stage");
  var pfSphere = document.getElementById("pfSphere");
  if (pfStage && pfSphere) {
    var pfItems = Array.prototype.slice.call(pfSphere.querySelectorAll(".pf__item"));
    var PF_N = pfItems.length;

    var pfReduceMQ = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : { matches: false, addEventListener: null, addListener: null };

    /* Punkte auf der Einheitskugel (goldener Winkel) */
    var pfPts = [];
    var GA = Math.PI * (3 - Math.sqrt(5));
    for (var pi = 0; pi < PF_N; pi++) {
      var py = 1 - (pi + 0.5) / PF_N * 2;
      var pr = Math.sqrt(Math.max(0, 1 - py * py));
      var pphi = pi * GA;
      pfPts.push({ x: Math.cos(pphi) * pr, y: py, z: Math.sin(pphi) * pr });
    }

    var pfEnabled = false;
    var pfRaf = null;
    var pfInView = true;
    var ry = 0;                 // Drehung um Y (horizontal)
    var rx = -0.16;             // aktuelle Neigung um X
    var targetRx = -0.16;       // Ziel-Neigung (Drag)
    var AUTO = 0.00020;         // Basis-Drehgeschw. (rad/ms) -> ~volle Drehung in ~30s
    var velY = AUTO;            // aktuelle horizontale Geschw. (rad/ms, mit Momentum)
    var dragging = false, hovering = false, dragMoved = false;
    var gestureLock = null;     // bei Touch: "x" = drehen, "y" = Seite scrollen lassen
    var lastX = 0, lastY = 0, lastT = 0;

    function pfClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    /* Radius aus der kleineren Bühnenseite — aber so begrenzt, dass die Karten
       seitlich nicht aus der (schmalen) Bühne ragen (wichtig auf dem Phone). */
    function pfRadius() {
      var w = pfStage.clientWidth, h = pfStage.clientHeight;
      var itemHalf = (pfItems[0] ? pfItems[0].offsetWidth : 140) / 2;
      var byMin = Math.min(w, h) * 0.42;
      var byWidth = w / 2 - itemHalf - 8;
      return Math.max(60, Math.min(byMin, byWidth));
    }

    function pfRender(t) {
      if (!pfEnabled) return;
      if (!lastT) lastT = t;
      var dt = Math.min(50, t - lastT); lastT = t;

      if (!dragging && !hovering) {
        velY += (AUTO - velY) * 0.04;   // Momentum klingt sanft auf Basis ab
        ry += velY * dt;
      }
      rx += (targetRx - rx) * 0.08;     // Neigung sanft annähern

      var R = pfRadius();
      var cosY = Math.cos(ry), sinY = Math.sin(ry);
      var cosX = Math.cos(rx), sinX = Math.sin(rx);

      for (var i = 0; i < PF_N; i++) {
        var p = pfPts[i];
        var x1 = p.x * cosY + p.z * sinY;
        var z1 = -p.x * sinY + p.z * cosY;
        var y2 = p.y * cosX - z1 * sinX;
        var z2 = p.y * sinX + z1 * cosX;
        var x2 = x1;

        var bob = Math.sin(t / 1400 + i * 1.7) * 5;
        var X = (x2 * R).toFixed(1);
        var Y = (y2 * R + bob).toFixed(1);
        var Z = (z2 * R).toFixed(1);
        var depth = (z2 + 1) / 2;        // 0 hinten .. 1 vorne

        var el = pfItems[i];
        el.style.transform = "translate3d(calc(-50% + " + X + "px), calc(-50% + " + Y + "px), " + Z + "px)";
        el.style.opacity = (0.4 + depth * 0.6).toFixed(3);
        el.style.filter = depth < 0.55 ? "blur(" + ((0.55 - depth) * 5).toFixed(2) + "px)" : "none";
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.pointerEvents = depth > 0.5 ? "auto" : "none";
      }
      pfRaf = window.requestAnimationFrame(pfRender);
    }

    function pfStart() {
      if (pfEnabled && pfInView && pfRaf === null) {
        lastT = 0; pfRaf = window.requestAnimationFrame(pfRender);
      }
    }
    function pfStop() {
      if (pfRaf !== null) { window.cancelAnimationFrame(pfRaf); pfRaf = null; }
    }

    function pfEnable() {
      if (pfEnabled) return;
      pfEnabled = true;
      pfStage.classList.add("is-3d");
      pfStart();
    }
    function pfDisable() {
      if (!pfEnabled) return;
      pfEnabled = false;
      pfStop();
      pfStage.classList.remove("is-3d", "is-grabbing");
      pfItems.forEach(function (el) {
        el.style.transform = ""; el.style.opacity = ""; el.style.filter = "";
        el.style.zIndex = ""; el.style.pointerEvents = "";
      });
    }

    function pfEvaluate() {
      if (!pfReduceMQ.matches) pfEnable(); else pfDisable();
    }

    /* Drag (Maus + Touch) */
    function pfDown(e) {
      if (!pfEnabled) return;
      dragging = true; dragMoved = false; gestureLock = null;
      pfStage.classList.add("is-grabbing");
      var pt = e.touches ? e.touches[0] : e;
      lastX = pt.clientX; lastY = pt.clientY;
    }
    function pfMove(e) {
      if (!dragging) return;
      var isTouch = !!e.touches;
      var pt = isTouch ? e.touches[0] : e;
      var dx = pt.clientX - lastX, dy = pt.clientY - lastY;

      /* Touch: Richtung festlegen — vertikal => Seite scrollen lassen (kein Drehen),
         horizontal => Sphere drehen. Bis zur Entscheidung nichts verbrauchen. */
      if (isTouch && !gestureLock) {
        var adx = Math.abs(dx), ady = Math.abs(dy);
        if (adx < 6 && ady < 6) return;            // noch zu klein
        if (ady > adx) { gestureLock = "y"; dragging = false; pfStage.classList.remove("is-grabbing"); return; }
        gestureLock = "x";
      }

      lastX = pt.clientX; lastY = pt.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
      ry += dx * 0.008;
      velY = dx * 0.0006;                                   // Momentum-Saat
      targetRx = pfClamp(targetRx - dy * 0.006, -0.55, 0.55);
      if (isTouch) e.preventDefault();
    }
    function pfUp() {
      if (!dragging) return;
      dragging = false; gestureLock = null;
      pfStage.classList.remove("is-grabbing");
    }

    pfStage.addEventListener("mousedown", pfDown);
    window.addEventListener("mousemove", pfMove);
    window.addEventListener("mouseup", pfUp);
    pfStage.addEventListener("touchstart", pfDown, { passive: true });
    pfStage.addEventListener("touchmove", pfMove, { passive: false });
    window.addEventListener("touchend", pfUp);

    /* Drag soll keinen Klick/Sprung auslösen */
    pfSphere.addEventListener("click", function (e) {
      if (pfEnabled && dragMoved) { e.preventDefault(); }
    });

    /* Hover pausiert die Auto-Rotation (zum Anvisieren einer Karte) */
    pfItems.forEach(function (el) {
      el.addEventListener("mouseenter", function () { hovering = true; });
      el.addEventListener("mouseleave", function () { hovering = false; });
    });

    /* rAF nur im Viewport */
    if ("IntersectionObserver" in window) {
      var pfIO = new IntersectionObserver(function (entries) {
        pfInView = entries[0].isIntersecting;
        if (pfInView) pfStart(); else pfStop();
      }, { threshold: 0 });
      pfIO.observe(pfStage);
    }

    pfEvaluate();
    if (pfReduceMQ.addEventListener) {
      pfReduceMQ.addEventListener("change", pfEvaluate);
    } else if (pfReduceMQ.addListener) {
      pfReduceMQ.addListener(pfEvaluate);   // ältere Safari
    }
    window.addEventListener("resize", pfEvaluate);
  }

  /* ---------- Kontaktformular (Formspree, async) ---------- */
  var cform = document.getElementById("contactForm");
  if (cform) {
    var statusEl = document.getElementById("cnt-status");
    var submitBtn = cform.querySelector(".cnt__submit");
    var STATUS = {
      sending: { de: "Wird gesendet …", en: "Sending …" },
      ok: { de: "Danke! Deine Anfrage ist angekommen — ich melde mich.", en: "Thanks! Your request came through — I’ll be in touch." },
      err: { de: "Das hat leider nicht geklappt. Versuch es bitte erneut oder schreib direkt an khian@sandbergcs.de.", en: "That didn’t work, unfortunately. Please try again or email khian@sandbergcs.de directly." }
    };
    function curLang() { return document.documentElement.getAttribute("lang") || "de"; }
    function setStatus(kind) {
      if (!statusEl) return;
      if (!kind) {
        statusEl.textContent = "";
        statusEl.removeAttribute("data-de");
        statusEl.removeAttribute("data-en");
        statusEl.className = "cnt__status";
        return;
      }
      var m = STATUS[kind];
      /* data-de/data-en setzen, damit der Sprachschalter die Meldung mit übersetzt */
      statusEl.setAttribute("data-de", m.de);
      statusEl.setAttribute("data-en", m.en);
      statusEl.textContent = m[curLang()] || m.de;
      statusEl.className = "cnt__status is-" + kind;
    }

    cform.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!cform.checkValidity()) { cform.reportValidity(); return; }

      setStatus("sending");
      if (submitBtn) submitBtn.disabled = true;

      fetch(cform.action, {
        method: "POST",
        body: new FormData(cform),
        headers: { "Accept": "application/json" }
      }).then(function (res) {
        if (res.ok) {
          cform.reset();
          setStatus("ok");
        } else {
          setStatus("err");
        }
      }).catch(function () {
        setStatus("err");
      }).then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }
})();
