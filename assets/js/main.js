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
    /* Wort-Reveal-Spans neu aufbauen — der textContent-Ersatz oben zerstört sie.
       (Funktionsdeklaration weiter unten, per Hoisting hier bereits verfügbar.) */
    resplitWords();
  }
  langButtons.forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
  });
  var saved = "de";
  try { saved = localStorage.getItem(STORE_KEY) || "de"; } catch (e) {}
  applyLang(saved);

  /* ---------- Sektions-Vermessung (geteilt: Berg + Punkt-Raster) ---------- */
  /* Oberkante + Helligkeit (Hintergrund-Luminanz) aller Vollbreiten-Sektionen.
     Berg und Punkt-Raster leiten daraus ab, ob sie hell oder dunkel zeichnen. */
  var pageSections = [];
  var sectionConsumers = [];   // Module, die nach jeder Neuvermessung nachziehen

  function collectPageSections() {
    pageSections = [];
    document.querySelectorAll("main > section, footer").forEach(function (s) {
      var m = getComputedStyle(s).backgroundColor.match(/\d+(\.\d+)?/g);
      var lum = m ? (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 : 1;
      pageSections.push({
        top: s.getBoundingClientRect().top + window.pageYOffset,
        dark: lum < 0.5
      });
    });
    pageSections.sort(function (a, b) { return a.top - b.top; });
  }
  function refreshSections() {
    collectPageSections();
    sectionConsumers.forEach(function (f) { f(); });
  }
  /* Ist die Sektion an einer Dokument-Y-Position dunkel? */
  function darkAtDocY(docY) {
    var dark = pageSections.length ? pageSections[0].dark : true;
    for (var i = 0; i < pageSections.length; i++) {
      if (pageSections[i].top <= docY) { dark = pageSections[i].dark; } else { break; }
    }
    return dark;
  }
  collectPageSections();
  window.addEventListener("load", refreshSections);
  window.addEventListener("resize", refreshSections);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshSections);
  }

  /* ---------- Globales Berg-Leitmotiv ---------- */
  /* Ein Berg, zwei Farbschichten: weiß auf dunklen Sektionen, schwarz auf Sand.
     Beim Scrollen crossfaden nur zwei Opacity-Werte an den Sektionsgrenzen.
     Ersetzt mix-blend-mode: difference — der Blend-Layer zwang den Browser,
     die Headlines beim Scrollen permanent mitzukompositieren (Glyphen-Flackern). */
  var berg = document.querySelector(".berg");
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  var BERG_PARKED = 0.52;    // End-Skalierung (≈ Eckgröße)
  var BERG_LIGHT_OP = 0.06;  // weißer Berg auf dunklen Sektionen
  var BERG_DARK_OP = 0.05;   // schwarzer Berg auf Sand-Sektionen
  var BERG_FADE = 180;       // Übergangszone an Sektionsgrenzen (px)

  if (berg) {
    var bergLight = berg.querySelector(".berg__svg--light");
    var bergDark = berg.querySelector(".berg__svg--dark");
    var bergLast = { s: "", l: "", d: "" };
    var bergTicking = false;

    function updateBerg() {
      var vh = window.innerHeight;

      /* 1) Parallax-Skalierung übers erste Viewport (entfällt bei reduced-motion) */
      if (!reduceMotion) {
        var p = Math.min(1, Math.max(0, window.pageYOffset / vh));
        var scale = (1 - p * (1 - BERG_PARKED)).toFixed(3);
        if (scale !== bergLast.s) { berg.style.setProperty("--berg-scale", scale); bergLast.s = scale; }
      }

      /* 2) Farbschicht passend zur Sektion in der Berg-Zone (unteres Viewport) */
      if (bergLight && bergDark && pageSections.length) {
        var sample = window.pageYOffset + vh * 0.85;
        var cur = pageSections[0], next = null;
        for (var i = 0; i < pageSections.length; i++) {
          if (pageSections[i].top <= sample) { cur = pageSections[i]; }
          else { next = pageSections[i]; break; }
        }
        var lightAmt = cur.dark ? 1 : 0;
        if (next && next.dark !== cur.dark) {
          var d = next.top - sample;
          if (d < BERG_FADE) {
            var mix = 1 - d / BERG_FADE;
            lightAmt = (cur.dark ? 1 : 0) * (1 - mix) + (next.dark ? 1 : 0) * mix;
          }
        }
        var lOp = (BERG_LIGHT_OP * lightAmt).toFixed(4);
        var dOp = (BERG_DARK_OP * (1 - lightAmt)).toFixed(4);
        if (lOp !== bergLast.l) { bergLight.style.opacity = lOp; bergLast.l = lOp; }
        if (dOp !== bergLast.d) { bergDark.style.opacity = dOp; bergLast.d = dOp; }
      }
      bergTicking = false;
    }

    function onBergScroll() {
      if (!bergTicking) { window.requestAnimationFrame(updateBerg); bergTicking = true; }
    }

    if (reduceMotion) {
      berg.style.setProperty("--berg-scale", String(BERG_PARKED));
    }

    updateBerg();
    window.addEventListener("scroll", onBergScroll, { passive: true });
    sectionConsumers.push(updateBerg);
  }

  /* ---------- Punkt-Raster mit Cursor-Gravitation ---------- */
  /* Feines Punktraster hinter allen Inhalten (z 39: über den Sektionsflächen,
     unter Berg und Content). Die Punkte werden vom Cursor minimal angezogen —
     weicher Falloff, geeaster Nachlauf — und nehmen die Farbe der jeweiligen
     Sektion an (hell auf dunkel, dunkel auf Sand). Das Canvas wird per JS
     erzeugt, es braucht kein Markup. Die rAF-Schleife läuft nur, solange sich
     tatsächlich etwas bewegt; bei reduced-motion bleibt das Raster statisch. */
  (function () {
    var SPACING = 25;        // Rasterweite (px) — fein, nah an der Referenz
    var DOT_R = 0.9;         // Punktradius (px)
    var PULL_RADIUS = 240;   // Wirkradius des Cursors (px)
    var PULL_MAX = 8;        // maximale Verschiebung zum Cursor (px)
    var EASE = 0.14;         // Nachlauf der Punkte (0..1)
    var A_LIGHT = 0.14;      // Alpha: helle Punkte auf dunklen Sektionen
    var A_DARK = 0.11;       // Alpha: dunkle Punkte auf Sand
    var A_BOOST = 0.10;      // leichte Betonung im Cursor-Umfeld

    var canvas = document.createElement("canvas");
    canvas.className = "dotgrid";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var cols = 0, rows = 0, offX = 0, offY = 0, dpr = 1;
    var disp = null;                 // [dx, dy] je Punkt (aktuelle Verschiebung)
    var mx = -1e4, my = -1e4;        // Cursor; weit weg = keine Wirkung
    var raf = null;

    function sizeGrid() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      cols = Math.ceil(window.innerWidth / SPACING) + 1;
      rows = Math.ceil(window.innerHeight / SPACING) + 1;
      offX = (window.innerWidth - (cols - 1) * SPACING) / 2;
      offY = (window.innerHeight - (rows - 1) * SPACING) / 2;
      disp = new Float32Array(cols * rows * 2);
      draw();
    }

    /* Zeichnet einen Frame; liefert true, solange Punkte noch unterwegs sind */
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      var scrollY = window.pageYOffset;
      var moving = false;
      var TAU = Math.PI * 2;

      for (var r = 0; r < rows; r++) {
        var by = offY + r * SPACING;
        var rowDark = darkAtDocY(by + scrollY);
        var col = rowDark ? "255,231,182" : "10,10,10";
        var baseA = rowDark ? A_LIGHT : A_DARK;

        for (var c = 0; c < cols; c++) {
          var i = (r * cols + c) * 2;
          var bx = offX + c * SPACING;

          /* Ziel-Verschiebung Richtung Cursor (weicher, quadratischer Falloff) */
          var ddx = mx - bx, ddy = my - by;
          var dist = Math.sqrt(ddx * ddx + ddy * ddy);
          var tx = 0, ty = 0, inf = 0;
          if (dist < PULL_RADIUS && dist > 0.001) {
            inf = 1 - dist / PULL_RADIUS;
            inf *= inf;
            var pull = PULL_MAX * inf;
            tx = ddx / dist * pull;
            ty = ddy / dist * pull;
          }

          var dx = disp[i] += (tx - disp[i]) * EASE;
          var dy = disp[i + 1] += (ty - disp[i + 1]) * EASE;
          if (!moving && (Math.abs(tx - dx) > 0.05 || Math.abs(ty - dy) > 0.05)) moving = true;

          ctx.fillStyle = "rgba(" + col + "," + (baseA + A_BOOST * inf).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(bx + dx, by + dy, DOT_R, 0, TAU);
          ctx.fill();
        }
      }
      return moving;
    }

    function tick() {
      raf = draw() ? window.requestAnimationFrame(tick) : null;
    }
    function wake() {
      if (raf === null) raf = window.requestAnimationFrame(tick);
    }

    if (!reduceMotion) {
      window.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        mx = e.clientX; my = e.clientY;
        wake();
      }, { passive: true });
      document.documentElement.addEventListener("mouseleave", function () {
        mx = -1e4; my = -1e4;   // Punkte gleiten zurück in Ruhelage
        wake();
      });
    }
    /* beim Scrollen wandern die Sektionsgrenzen — Farben nachziehen */
    window.addEventListener("scroll", wake, { passive: true });

    sectionConsumers.push(sizeGrid);
    sizeGrid();
  })();

  /* ---------- Wort-für-Wort-Reveal (nur die großen Statements) ---------- */
  /* Elemente mit [data-words] werden in maskierte Wort-Spans zerlegt; der
     bestehende IntersectionObserver (is-revealed) triggert den gestaffelten
     Einlauf. Nach jedem Sprachwechsel baut applyLang() die Spans neu auf —
     bereits sichtbare Statements spielen den Reveal dann erneut (gewollt).
     Funktionsdeklaration (Hoisting): applyLang ruft sie schon beim Init. */
  function resplitWords() {
    var rm = window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rm) return;

    document.querySelectorAll("[data-words]").forEach(function (el) {
      /* Text-Hosts: das Element selbst (wenn es data-de trägt) oder seine
         data-de-Kinder (z. B. Spans + em im Über-mich-Leitsatz) */
      var hosts = el.hasAttribute("data-de") ? [el]
        : Array.prototype.slice.call(el.querySelectorAll("[data-de]"));
      if (!hosts.length) return;

      var wordIndex = 0;
      hosts.forEach(function (host) {
        var raw = host.textContent;
        /* Rand-Leerzeichen erhalten — sie trennen die Hosts voneinander
           (z. B. „eine “ + em „Person“ + „ — kein …“) */
        var leading = /^\s/.test(raw);
        var trailing = /\s$/.test(raw);
        var words = raw.trim().split(/\s+/).filter(Boolean);
        host.textContent = "";
        if (leading) host.appendChild(document.createTextNode(" "));
        words.forEach(function (word, i) {
          if (i > 0) host.appendChild(document.createTextNode(" "));
          var w = document.createElement("span");
          w.className = "w";
          var inner = document.createElement("span");
          inner.className = "w-in";
          inner.textContent = word;
          inner.style.transitionDelay = (wordIndex * 0.045).toFixed(3) + "s";
          w.appendChild(inner);
          host.appendChild(w);
          wordIndex++;
        });
        if (trailing) host.appendChild(document.createTextNode(" "));
      });

      /* Bereits enthüllte Statements: Reveal einmal neu abspielen */
      if (el.classList.contains("is-revealed")) {
        el.classList.remove("is-revealed");
        void el.offsetWidth;   // Reflow erzwingen, damit die Transition greift
        setTimeout(function () { el.classList.add("is-revealed"); }, 30);
      }
    });
  }

  /* ---------- Footer: Lokalzeit Hamburg (Realness-Detail) ---------- */
  var timeEls = document.querySelectorAll(".ft__time-val");
  if (timeEls.length && window.Intl && Intl.DateTimeFormat) {
    var timeFmt = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    var tickClock = function () {
      var t = timeFmt.format(new Date());
      timeEls.forEach(function (el) { el.textContent = t; });
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ---------- Custom Cursor + magnetische Elemente („Anziehung") ---------- */
  /* Dritter Baustein der Anziehungs-Metapher (neben der Raster-Gravitation):
     Der orange Cursor-Punkt — konzeptionell der Signaturpunkt des Claims —
     folgt der Maus mit weichem Nachlauf und blüht über Interaktivem zum Ring
     auf. Buttons ziehen sich dem Cursor leicht entgegen und federn zurück.
     Nur für feine Zeiger (Maus); entfällt bei reduced-motion. */
  var finePointer = window.matchMedia
    && window.matchMedia("(pointer: fine)").matches;
  if (finePointer && !reduceMotion) {
    var cursorEl = document.createElement("div");
    cursorEl.className = "cursor is-hidden";
    cursorEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursorEl);
    document.documentElement.classList.add("has-cursor");

    var curX = -100, curY = -100, tgtX = -100, tgtY = -100;
    var curRaf = null;

    function cursorFrame() {
      curX += (tgtX - curX) * 0.22;
      curY += (tgtY - curY) * 0.22;
      cursorEl.style.transform =
        "translate3d(" + curX.toFixed(1) + "px," + curY.toFixed(1) + "px,0) translate(-50%,-50%)";
      curRaf = (Math.abs(tgtX - curX) > 0.15 || Math.abs(tgtY - curY) > 0.15)
        ? window.requestAnimationFrame(cursorFrame)
        : null;
    }

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      tgtX = e.clientX; tgtY = e.clientY;
      cursorEl.classList.remove("is-hidden");
      if (curRaf === null) curRaf = window.requestAnimationFrame(cursorFrame);
    }, { passive: true });

    /* Zustände per Delegation: Ring über Interaktivem, unsichtbar über Feldern */
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest("input, textarea, select, label")) {
        cursorEl.classList.add("is-hidden");
        return;
      }
      cursorEl.classList.remove("is-hidden");
      cursorEl.classList.toggle("is-link", !!e.target.closest("a, button, .pf__item"));
    });
    document.documentElement.addEventListener("mouseleave", function () {
      cursorEl.classList.add("is-hidden");
    });
    window.addEventListener("mousedown", function () { cursorEl.classList.add("is-down"); });
    window.addEventListener("mouseup", function () { cursorEl.classList.remove("is-down"); });

    /* Magnetik: Buttons folgen dem Cursor minimal (28 % des Versatzes) */
    document.querySelectorAll(".btn, .burger").forEach(function (el) {
      el.classList.add("magnetic");
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform =
          "translate(" + (dx * 0.28).toFixed(1) + "px," + (dy * 0.28).toFixed(1) + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });
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
