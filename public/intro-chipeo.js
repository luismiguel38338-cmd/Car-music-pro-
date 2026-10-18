/**
 * RADIO CHIPEO — INTRO CINEMÁTICA CON CYBER GRID, NEON GLITCH Y DESCARGA ELÉCTRICA
 * Recrea fielmente el video del usuario con 60 FPS Canvas y Web Audio
 */

(function () {
  function startChipeoIntro() {
    // Si ya existe el contenedor, evitar duplicados
    if (document.getElementById('chipeo-intro')) return;

    // Eliminar el loader antiguo de imagen si existe
    const oldLd = document.getElementById('ld');
    if (oldLd) {
      oldLd.style.display = 'none';
      oldLd.remove();
    }

    const container = document.createElement('div');
    container.id = 'chipeo-intro';
    container.innerHTML = `
      <canvas id="chipeo-canvas"></canvas>
      <div class="chipeo-content">
        <!-- Logo con efecto Glitch -->
        <div class="chipeo-logo-wrap">
          <h1 class="chipeo-text">radio</h1>
          <h1 class="chipeo-text">chipeo</h1>
          <!-- Capas glitch superpuestas -->
          <div class="chipeo-glitch-layer chipeo-glitch-1" aria-hidden="true">
            <h1 class="chipeo-text">radio</h1>
            <h1 class="chipeo-text">chipeo</h1>
          </div>
          <div class="chipeo-glitch-layer chipeo-glitch-2" aria-hidden="true">
            <h1 class="chipeo-text">radio</h1>
            <h1 class="chipeo-text">chipeo</h1>
          </div>
        </div>

        <!-- Barra de progreso eléctrica -->
        <div class="chipeo-bar-outer">
          <div class="chipeo-bar-fill" id="chipeoBarFill">
            <div class="chipeo-bar-sparks" id="chipeoSparks">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#00e5ff" stroke="#fff" stroke-width="1.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Explosión y onda expansiva de luz final -->
      <div class="chipeo-explosion" id="chipeoExplosion">
        <div class="chipeo-shockwave"></div>
      </div>

      <button class="chipeo-skip-btn" id="chipeoSkipBtn" type="button">Omitir ⏭</button>
    `;

    document.body.appendChild(container);

    // Canvas 3D Cyber Grid & Electric Particles
    const canvas = document.getElementById('chipeo-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Partículas y lluvia de luz vertical
    const particles = [];
    const PARTICLE_COUNT = 55;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 1.5 + Math.random() * 4.5,
        len: 8 + Math.random() * 26,
        opacity: 0.2 + Math.random() * 0.7,
        size: 1 + Math.random() * 2,
      });
    }

    // Rayos y chispas eléctricas alrededor de la barra
    const sparks = [];
    let progress = 0;
    const DURATION_MS = 3800; // ~3.8s coincidiendo con el video
    const startTime = Date.now();
    let isFinished = false;
    let animId = null;

    // Web Audio Synthesizer para efectos de carga eléctrica y explosión
    let audioCtx = null;
    function playChargeSound() {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 3.4);

        gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 3.2);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3.7);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 3.8);
      } catch (e) {}
    }

    function playExplosionSound() {
      try {
        if (!audioCtx) {
          const AudioClass = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioClass();
        }
        // Sub-bass thump
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(32, audioCtx.currentTime + 0.6);

        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.7);
      } catch (e) {}
    }

    // Intentar sonido sutil si se permite
    try {
      playChargeSound();
    } catch (e) {}

    // Loop de renderizado
    function render() {
      ctx.clearRect(0, 0, width, height);

      // 1. Fondo Degradado Profundo
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#02050c');
      bgGrad.addColorStop(0.65, '#040b17');
      bgGrad.addColorStop(1, '#010307');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Cuadrícula Cyber Grid en perspectiva 3D (piso)
      const horizonY = height * 0.58;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.14)';
      ctx.lineWidth = 1;

      // Líneas verticales convergentes hacia el centro de fuga
      const vpX = width / 2;
      const vpY = horizonY;
      const lineCount = 28;
      for (let i = -lineCount; i <= lineCount; i++) {
        const xBottom = vpX + i * (width / 16);
        ctx.beginPath();
        ctx.moveTo(vpX + (i * (width / 120)), vpY);
        ctx.lineTo(xBottom, height);
        ctx.stroke();
      }

      // Líneas horizontales de profundidad exponencial en el piso
      for (let y = 0; y < 16; y++) {
        const py = vpY + Math.pow(y / 15, 2.2) * (height - vpY);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }

      // Cuadrícula superior de la pared de fondo
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.06)';
      const wallGridSize = Math.max(30, width / 20);
      for (let x = 0; x < width; x += wallGridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, horizonY);
        ctx.stroke();
      }
      for (let y = 0; y < horizonY; y += wallGridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Lluvia vertical de partículas de neón
      ctx.fillStyle = '#00e5ff';
      particles.forEach((p) => {
        p.y += p.speed;
        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        ctx.strokeStyle = `rgba(0, 229, 255, ${p.opacity})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.len);
        ctx.stroke();
      });

      // 4. Calcular Progreso de Carga
      const elapsed = Date.now() - startTime;
      progress = Math.min(1, elapsed / DURATION_MS);

      const barFill = document.getElementById('chipeoBarFill');
      if (barFill) {
        barFill.style.width = `${progress * 100}%`;
      }

      // 5. Generar arcos de rayos eléctricos saliendo de la punta de la barra
      const barOuter = document.querySelector('.chipeo-bar-outer');
      if (barOuter && progress > 0.02 && progress < 0.99) {
        const rect = barOuter.getBoundingClientRect();
        const headX = rect.left + rect.width * progress;
        const headY = rect.top + rect.height / 2;

        // Dibujar 2 a 4 rayos aleatorios
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 1.5;

        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          let cx = headX;
          let cy = headY;
          ctx.moveTo(cx, cy);

          const segments = 4;
          for (let s = 0; s < segments; s++) {
            cx += (Math.random() - 0.5) * 24;
            cy += (Math.random() - 0.5) * 20;
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      // 6. Al llegar al 100%: Gran Explosión de Partículas y Shockwave
      if (progress >= 1 && !isFinished) {
        isFinished = true;
        playExplosionSound();

        const expl = document.getElementById('chipeoExplosion');
        if (expl) expl.classList.add('active');

        setTimeout(() => {
          finishIntro();
        }, 550);
        return;
      }

      if (!isFinished) {
        animId = requestAnimationFrame(render);
      }
    }

    function finishIntro() {
      if (animId) cancelAnimationFrame(animId);
      container.classList.add('fade-out');
      setTimeout(() => {
        container.remove();
      }, 800);
    }

    // Skip handlers
    document.getElementById('chipeoSkipBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      finishIntro();
    });
    container.addEventListener('click', () => {
      // Un toque acelera y finaliza si el usuario lo desea
      finishIntro();
    });

    animId = requestAnimationFrame(render);
  }

  // Inicializar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startChipeoIntro);
  } else {
    startChipeoIntro();
  }
})();
