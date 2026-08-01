// ============================================================
// CECFA — main.js
// 1. Menú móvil
// 2. Scroll suave (implementado en JS para todos los navegadores)
// 3. Campo de estrellas (con versión estática si se pide reducir movimiento)
// 4. Revelado de secciones al hacer scroll
// 5. Contadores animados en las estadísticas
// ============================================================



// Respeta la preferencia del sistema operativo: quien tenga activado "reducir
// movimiento" recibe la version estatica del sitio, sin estrellas animadas,
// sin revelados al hacer scroll y sin contadores que suben solos.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== 1. Menú móvil =====
const toggle = document.querySelector('.nav__toggle');
const links = document.querySelector('.nav__links');

if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });

  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('is-open'))
  );
}

// ===== 2. Scroll suave =====
// Interceptamos los clicks en links internos (#...) y animamos el scroll
// con una curva suave, descontando la altura de la barra de navegación.
const navHeight = () => document.querySelector('.nav').offsetHeight;

function smoothScrollTo(targetY, duration = 800) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  let start;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(timestamp) {
    if (start === undefined) start = timestamp;
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startY + diff * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href');
    if (id.length <= 1) return;

    // Caso especial: #top sube al inicio absoluto de la página
    if (id === '#top') {
      e.preventDefault();
      smoothScrollTo(0);
      history.pushState(null, '', id);
      return;
    }

    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - navHeight() - 12;
    if (reduceMotion) {
      window.scrollTo(0, y);
    } else {
      smoothScrollTo(Math.max(y, 0));
    }
    history.pushState(null, '', id);
  });
});

// ===== 3. Campo de estrellas =====
// Las estrellas viven en coordenadas de la PÁGINA (no de la pantalla):
// al hacer scroll, el canvas fijo muestra la franja del "cielo" que corresponde.
const canvas = document.getElementById('starfield');

if (canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];

  function skyHeight() {
    return document.documentElement.scrollHeight;
  }

  function makeStars() {
    const count = Math.floor((canvas.width * skyHeight()) / 5000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * skyHeight(),
      r: Math.random() * 1.4 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.2,
      // deriva errática: dirección y ritmo propios de cada estrella
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: 0.4 + Math.random() * 0.8,
      driftAmp: 1 + Math.random() * 3,
    }));
  }

  function drawFrame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // En modo día no hay estrellas: limpiamos y salimos
    if (document.body.classList.contains('day')) {
      requestAnimationFrame(drawFrame);
      return;
    }

    const offsetY = window.scrollY;

    for (const s of stars) {
      // Solo dibujamos las estrellas dentro de la franja visible
      const screenY = s.y - offsetY;
      if (screenY < -10 || screenY > canvas.height + 10) continue;

      const dx = Math.sin(s.driftPhase + t * 0.0009 * s.driftSpeed) * s.driftAmp;
      const dy = Math.cos(s.driftPhase * 1.7 + t * 0.0007 * s.driftSpeed) * s.driftAmp;
      const alpha = 0.2 + 0.7 * Math.abs(Math.sin(s.phase + t * 0.002 * s.speed));

      ctx.fillStyle = `rgba(242, 239, 230, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x + dx, screenY + dy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(drawFrame);
  }

  // Version estatica: mismas estrellas, sin parpadeo ni deriva. Se redibuja solo
  // cuando cambia lo que se ve (scroll, resize o cambio de tema).
  function drawStatic() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (document.body.classList.contains('day')) return;

    const offsetY = window.scrollY;
    for (const s of stars) {
      const screenY = s.y - offsetY;
      if (screenY < -10 || screenY > canvas.height + 10) continue;
      ctx.fillStyle = 'rgba(242, 239, 230, 0.75)';
      ctx.beginPath();
      ctx.arc(s.x, screenY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Permite que el interruptor de tema pida un redibujado en modo estatico.
  canvas.redibujar = drawStatic;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    makeStars();
    if (reduceMotion) drawStatic();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);
  resize();

  if (reduceMotion) {
    window.addEventListener('scroll', drawStatic, { passive: true });
    drawStatic();
  } else {
    requestAnimationFrame(drawFrame);
  }
}

// ===== 4. Revelado al hacer scroll =====
const revealEls = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach(el => el.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach(el => observer.observe(el));
}

// ===== 5. Contadores animados =====
const counters = document.querySelectorAll('[data-count]');

function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const duration = 1200;
  let start;

  function step(timestamp) {
    if (start === undefined) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    el.textContent = Math.round(target * progress);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

if (reduceMotion || !('IntersectionObserver' in window)) {
  counters.forEach(el => (el.textContent = el.dataset.count));
} else {
  const counterObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach(el => counterObserver.observe(el));
}

// ===== 6. Phi interactivo =====
// Las órbitas giran a velocidad crucero; al pasar el mouse aceleran
// suavemente y el phi se mece sobre su base. Todo con transiciones
// de velocidad (nada de saltos).
const phiWrap = document.querySelector('.hero__phi');
const bodyInner = document.querySelector('.phi__body--inner');
const bodyOuter = document.querySelector('.phi__body--outer');
const phiGlyph = document.querySelector('.phi__glyph');

if (phiWrap && bodyInner && bodyOuter) {
  let angleIn = 0, angleOut = 0;
  let speedIn = 26, speedOut = -16;          // velocidad crucero (grados/seg)
  let targetIn = 26, targetOut = -16;
  let wobble = 0, targetWobble = 0;          // intensidad del meneo del phi
  let last;

  phiWrap.addEventListener('mouseenter', () => {
    targetIn = 150; targetOut = -100; targetWobble = 1;
  });
  phiWrap.addEventListener('mouseleave', () => {
    targetIn = 26; targetOut = -16; targetWobble = 0;
  });

  function phiTick(t) {
    if (last === undefined) last = t;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;

    // Las velocidades persiguen su objetivo con suavidad
    speedIn  += (targetIn  - speedIn)  * Math.min(dt * 3, 1);
    speedOut += (targetOut - speedOut) * Math.min(dt * 3, 1);
    wobble   += (targetWobble - wobble) * Math.min(dt * 4, 1);

    angleIn  = (angleIn  + speedIn  * dt) % 360;
    angleOut = (angleOut + speedOut * dt) % 360;

    bodyInner.style.transform = `rotate(${angleIn}deg)`;
    bodyOuter.style.transform = `rotate(${angleOut}deg)`;

    if (phiGlyph) {
      const rock = Math.sin(t * 0.004) * 3 * wobble; // ±3° de vaivén
      phiGlyph.style.transform = `rotate(${rock}deg)`;
    }

    requestAnimationFrame(phiTick);
  }
  requestAnimationFrame(phiTick);
}
// ===== 7. Cuenta regresiva =====
// Lee la fecha límite del atributo data-deadline y actualiza cada segundo.
// Al llegar a cero muestra un mensaje de "en curso".
const countdownEl = document.querySelector('.countdown');

if (countdownEl) {
  const deadline = new Date(countdownEl.dataset.deadline).getTime();
  const cdNums = {
    days: countdownEl.querySelector('[data-cd="days"]'),
    hours: countdownEl.querySelector('[data-cd="hours"]'),
    mins: countdownEl.querySelector('[data-cd="mins"]'),
    secs: countdownEl.querySelector('[data-cd="secs"]'),
  };

  function updateCountdown() {
    const diff = deadline - Date.now();

    if (diff <= 0) {
      countdownEl.innerHTML = '<p class="countdown__live">¡El evento está en curso! 🎉</p>';
      clearInterval(cdTimer);
      return;
    }

    const secs = Math.floor(diff / 1000);
    cdNums.days.textContent = Math.floor(secs / 86400);
    cdNums.hours.textContent = String(Math.floor((secs % 86400) / 3600)).padStart(2, '0');
    cdNums.mins.textContent = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    cdNums.secs.textContent = String(secs % 60).padStart(2, '0');
  }

  const cdTimer = setInterval(updateCountdown, 1000);
  updateCountdown();
}

// ===== 8. Interruptor día / noche =====
const themeToggle = document.querySelector('.theme-toggle');

if (themeToggle) {
  function setTheme(isDay) {
    document.body.classList.toggle('day', isDay);

    // En modo estatico no hay bucle de animacion que repinte el cielo, asi que
    // se pide el redibujado explicitamente al cambiar de tema.
    if (reduceMotion && canvas && canvas.redibujar) canvas.redibujar();

    try { localStorage.setItem('cecfa-theme', isDay ? 'day' : 'night'); } catch (e) {}
  }

  // Al cargar, aplica la preferencia guardada (noche por defecto)
  // Al cargar, aplica la preferencia guardada (noche por defecto).
  // Ya venía aplicada por el script del <head>; aquí solo sincronizamos
  // la clase del body y el ícono, y retiramos la clase puente.
  let saved = 'night';
  try { saved = localStorage.getItem('cecfa-theme') || 'night'; } catch (e) {}
  document.body.classList.toggle('day', saved === 'day');
  
  document.documentElement.classList.remove('day-preload');
  // Reactiva las transiciones una vez aplicado el tema inicial
  // Reactiva las transiciones una vez que la página cargó del todo.
  // Usamos load + un pequeño margen para no depender del timing de pintado
  // (evita el parpadeo intermitente de la barra al navegar).
  window.addEventListener('load', () => {
    setTimeout(() => document.documentElement.classList.remove('preload'), 60);
  });

  themeToggle.addEventListener('click', () => {
    setTheme(!document.body.classList.contains('day'));
  });
}