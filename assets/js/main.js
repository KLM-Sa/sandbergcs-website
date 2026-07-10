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
  /* Beide Farbschichten sind dauerhaft sichtbar (siehe CSS) — JS steuert nur
     noch die Parallax-Skalierung übers erste Viewport, quantisiert in groben
     Schritten (Compositor-Ruhe; die CSS-Transition glättet dazwischen). */
  var berg = document.querySelector(".berg");
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  var BERG_PARKED = 0.52;    // End-Skalierung (≈ Eckgröße)

  if (berg) {
    /* Nur noch Parallax-Skalierung übers erste Viewport. Die Farbtrennung
       braucht KEIN JS mehr: beide Schichten sind dauerhaft sichtbar und je
       Hintergrund liest nur die passende (siehe CSS). Damit entfällt das
       frühere Clip-Rennen mit dem nativen Scroll (kurze Lücke im Berg beim
       schnellen Scrollen) vollständig. */
    var bergLastScale = "";
    var bergTicking = false;

    function updateBerg() {
      var p = Math.min(1, Math.max(0, window.pageYOffset / window.innerHeight));
      /* In 0.02er-Schritten quantisiert (≈ alle 35px Scroll EIN Update statt
         jedes Frame) — die CSS-Transition auf .berg interpoliert dazwischen.
         So bleibt der Berg-Layer zwischen den Schritten völlig statisch und
         zwingt den Compositor nicht mehr, die Headlines mitzubehandeln. */
      var scale = (Math.round((1 - p * (1 - BERG_PARKED)) * 50) / 50).toFixed(2);
      if (scale !== bergLastScale) { berg.style.setProperty("--berg-scale", scale); bergLastScale = scale; }
      bergTicking = false;
    }

    function onBergScroll() {
      if (!bergTicking) { window.requestAnimationFrame(updateBerg); bergTicking = true; }
    }

    if (reduceMotion) {
      berg.style.setProperty("--berg-scale", String(BERG_PARKED));
    } else {
      updateBerg();
      window.addEventListener("scroll", onBergScroll, { passive: true });
    }
  }

  /* ---------- Navigation: Schriftfarbe je Sektion (statt mix-blend-mode) ---------- */
  /* Der frühere Blend-Layer der Nav zwang den Browser, die gesamte Seite bei
     jedem Scroll-Frame mitzukompositieren — die letzte Quelle des
     Glyphen-Flackerns. Jetzt: dunkle Schrift, sobald unter der Nav-Zone eine
     helle Sektion liegt (gleiche Sektions-Vermessung wie Berg und Raster). */
  if (nav) {
    var navOnSandLast = null;
    var updateNavTone = function () {
      var onSand = !darkAtDocY(window.pageYOffset + (nav.offsetHeight || 76) / 2);
      if (onSand !== navOnSandLast) {
        nav.classList.toggle("on-sand", onSand);
        navOnSandLast = onSand;
      }
    };
    updateNavTone();
    window.addEventListener("scroll", updateNavTone, { passive: true });
    sectionConsumers.push(updateNavTone);
  }

  /* ---------- Punkt-Raster mit Cursor-Gravitation ---------- */
  /* Feines Punktraster hinter allen Inhalten (z 39: über den Sektionsflächen,
     unter Berg und Content). EINE Ebene in einem warmen Mittelton, dessen
     Luminanz zwischen Ink und Sand liegt (liest hell auf Dunkel, dunkel auf
     Sand — ohne Umfärben).
     ENTSCHEIDEND: Das Muster ist ans DOKUMENT gekoppelt (Zeichnung wird um
     scrollY versetzt) — die Punkte stehen relativ zum Text still. Ein
     viewport-fixiertes Muster wandert beim Scrollen unter den weichen
     Glyphenkanten hindurch und liest als Flackern der Headlines; inhalts-
     verankert gibt es diese Relativbewegung nicht (so machen es auch die
     Referenzseiten). Der Repaint pro Scroll-Frame bleibt auf der isolierten
     Canvas-Ebene und berührt das Text-Rendering nicht. */
  (function () {
    var SPACING = 25;        // Rasterweite (px) — fein, nah an der Referenz
    var DOT_R = 1;           // Punktradius (px)
    var PULL_RADIUS = 240;   // Wirkradius des Cursors (px)
    var PULL_MAX = 8;        // maximale Verschiebung zum Cursor (px)
    var EASE = 0.14;         // Nachlauf der Punkte (0..1)
    var COL = "150,133,108"; // warmer Mittelton (Luminanz ≈ 0.55)
    var A_BASE = 0.34;       // Grunddeckung -> Hub wie zuvor: ~48/255 auf Ink, ~30/255 auf Sand
    var A_BOOST = 0.12;      // leichte Betonung im Cursor-Umfeld

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
      rows = Math.ceil(window.innerHeight / SPACING) + 2;  // +1 Reserve fürs Scroll-Wrapping
      offX = (window.innerWidth - (cols - 1) * SPACING) / 2;
      offY = 0;
      disp = new Float32Array(cols * rows * 2);
      draw();
    }

    /* Zeichnet einen Frame; liefert true, solange Punkte noch unterwegs sind */
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      var moving = false;
      var TAU = Math.PI * 2;
      /* Dokument-Kopplung: Muster um den Scroll-Rest versetzen (wrappt alle 25px) */
      var shift = window.pageYOffset % SPACING;

      for (var r = 0; r < rows; r++) {
        var by = offY + r * SPACING - shift;
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

          ctx.fillStyle = "rgba(" + COL + "," + (A_BASE + A_BOOST * inf).toFixed(3) + ")";
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
    /* Scroll koppelt das Muster ans Dokument: pro Frame ein Redraw mit neuem
       Versatz. Läuft komplett auf der eigenen Canvas-Ebene. Gilt bewusst auch
       bei reduced-motion — inhaltsverankert bedeutet WENIGER wahrgenommene
       Bewegung der Textur, nicht mehr. */
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
    /* Punkt (präzise an der Maus) + Ring (folgt mit spürbarem Nachlauf) —
       der Nachlauf macht die Bewegung selbst sichtbar und gibt dem Cursor
       Präsenz, ohne aufdringlich zu sein. */
    var cursorEl = document.createElement("div");
    cursorEl.className = "cursor is-hidden";
    cursorEl.setAttribute("aria-hidden", "true");
    var ringEl = document.createElement("div");
    ringEl.className = "cursor-ring is-hidden";
    ringEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(ringEl);
    document.body.appendChild(cursorEl);
    document.documentElement.classList.add("has-cursor");

    function cursorState(cls, on) {
      cursorEl.classList.toggle(cls, on);
      ringEl.classList.toggle(cls, on);
    }

    var curX = -100, curY = -100;      // Punkt (schnell)
    var ringX = -100, ringY = -100;    // Ring (träge — der sichtbare Nachlauf)
    var tgtX = -100, tgtY = -100;
    var curRaf = null;

    function cursorFrame() {
      curX += (tgtX - curX) * 0.35;
      curY += (tgtY - curY) * 0.35;
      ringX += (tgtX - ringX) * 0.13;
      ringY += (tgtY - ringY) * 0.13;
      cursorEl.style.transform =
        "translate3d(" + curX.toFixed(1) + "px," + curY.toFixed(1) + "px,0) translate(-50%,-50%)";
      ringEl.style.transform =
        "translate3d(" + ringX.toFixed(1) + "px," + ringY.toFixed(1) + "px,0) translate(-50%,-50%)";
      curRaf = (Math.abs(tgtX - curX) > 0.15 || Math.abs(tgtY - curY) > 0.15
                || Math.abs(tgtX - ringX) > 0.15 || Math.abs(tgtY - ringY) > 0.15)
        ? window.requestAnimationFrame(cursorFrame)
        : null;
    }

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      tgtX = e.clientX; tgtY = e.clientY;
      cursorState("is-hidden", false);
      if (curRaf === null) curRaf = window.requestAnimationFrame(cursorFrame);
    }, { passive: true });

    /* Zustände per Delegation: Aufblühen über Interaktivem, unsichtbar über Feldern */
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest("input, textarea, select, label")) {
        cursorState("is-hidden", true);
        return;
      }
      cursorState("is-hidden", false);
      cursorState("is-link", !!e.target.closest("a, button, .pf__item"));
    });
    document.documentElement.addEventListener("mouseleave", function () {
      cursorState("is-hidden", true);
    });
    window.addEventListener("mousedown", function () { cursorState("is-down", true); });
    window.addEventListener("mouseup", function () { cursorState("is-down", false); });

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

    /* Gleichmäßiger Ring mit leichter Höhenstaffelung (statt Fibonacci-Kugel):
       bei nur 5 Karten garantiert der Ring in JEDER Drehlage gleiche
       Winkelabstände — keine zufälligen Lücken/Klumpen mehr. Die versetzten
       Höhen erhalten den räumlichen, schwebenden Charakter. */
    var pfPts = [];
    var PF_Y = [-0.30, 0.26, -0.10, 0.34, -0.24];
    for (var pi = 0; pi < PF_N; pi++) {
      var ang = pi * (Math.PI * 2 / PF_N);
      var py = PF_Y[pi % PF_Y.length];
      var pr = Math.sqrt(Math.max(0, 1 - py * py));
      pfPts.push({ x: Math.cos(ang) * pr, y: py, z: Math.sin(ang) * pr });
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
      var itemW = pfItems[0] ? pfItems[0].offsetWidth : 140;
      var byMin = Math.min(w, h) * 0.42;
      var byWidth = w / 2 - itemW / 2 - 8;
      /* Dichte-Kopplung: Radius nie größer als ~2.1 Kartenbreiten — sonst
         schwebten auf mittleren Viewports (Tablet) winzige Karten mit riesigen
         Lücken auf der Kugel. So bleibt das Verhältnis auf allen Größen gleich. */
      var byItem = itemW * 2.1;
      return Math.max(60, Math.min(byMin, byWidth, byItem));
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

        var bob = Math.sin(t / 1400 + i * 1.7) * 3;
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
