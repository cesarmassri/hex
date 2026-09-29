(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");
  const leftTouch = document.getElementById("leftTouch");
  const rightTouch = document.getElementById("rightTouch");

  let W = 0, H = 0, DPR = 1;
  let running = false;
  let last = performance.now();
  let elapsed = 0;
  let spawnTimer = 0;
  let rotation = 0;
  let shake = 0;
  let flash = 0;

  const input = { left: false, right: false };

  const player = {
    angle: -Math.PI / 2,
    orbit: 92,
    radius: 8,
    speed: 4.25
  };

  let walls = [];

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const m = Math.min(W, H);
    player.orbit = Math.max(70, Math.min(112, m * 0.16));
  }

  addEventListener("resize", resize, { passive: true });
  resize();

  function normalizeAngle(a) {
    a %= Math.PI * 2;
    if (a < 0) a += Math.PI * 2;
    return a;
  }

  function resetGame() {
    elapsed = 0;
    spawnTimer = 0.4;
    rotation = 0;
    shake = 0;
    flash = 0;
    walls = [];
    player.angle = -Math.PI / 2;
    scoreEl.textContent = "0.0";
  }

  function startGame() {
    resetGame();
    running = true;
    overlay.classList.add("hidden");
    last = performance.now();
  }

  function gameOver() {
    running = false;
    shake = 10;
    flash = 1;
    overlay.classList.remove("hidden");

    const panel = overlay.querySelector(".panel");
    panel.querySelector("h1").textContent = `${elapsed.toFixed(1)}s`;
    panel.querySelector("p").textContent =
      elapsed >= 30
        ? "Muy bien. La velocidad ya estaba bastante alta."
        : "La pared te alcanzó. Probá otra vez.";
    startBtn.textContent = "REINTENTAR";
  }

  startBtn.addEventListener("click", startGame);

  addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
    if (e.code === "Space" && !running) startGame();
  });

  addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
  });

  function bindTouch(btn, key) {
    const down = (e) => {
      e.preventDefault();
      input[key] = true;
    };
    const up = (e) => {
      e.preventDefault();
      input[key] = false;
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  bindTouch(leftTouch, "left");
  bindTouch(rightTouch, "right");

  canvas.addEventListener("pointerdown", (e) => {
    if (!running) return;
    if (e.clientX < W / 2) input.left = true;
    else input.right = true;
  });

  canvas.addEventListener("pointerup", () => {
    input.left = false;
    input.right = false;
  });

  function difficulty() {
    return Math.min(1, elapsed / 55);
  }

  function spawnWall() {
    const d = difficulty();
    const segments = 6;
    const gapIndex = Math.floor(Math.random() * segments);
    const extraGapChance = d < 0.25 ? 0.35 : 0.12;

    const blocked = Array.from({ length: segments }, (_, i) => i !== gapIndex);

    if (Math.random() < extraGapChance) {
      blocked[(gapIndex + 1 + (Math.random() < .5 ? 1 : segments - 1)) % segments] = false;
    }

    const minDim = Math.min(W, H);
    walls.push({
      r: Math.max(320, minDim * 0.58),
      thickness: 30 + d * 8,
      blocked,
      speed: 120 + d * 150,
      phase: Math.random() * Math.PI * 2
    });

    spawnTimer = Math.max(0.48, 1.08 - d * 0.44);
  }

  function update(dt) {
    if (!running) {
      rotation += dt * 0.08;
      flash = Math.max(0, flash - dt * 2.4);
      shake = Math.max(0, shake - dt * 30);
      return;
    }

    elapsed += dt;
    scoreEl.textContent = elapsed.toFixed(1);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    player.angle += dir * player.speed * (1 + difficulty() * .18) * dt;

    rotation += dt * (0.22 + difficulty() * 0.72);

    spawnTimer -= dt;
    if (spawnTimer <= 0) spawnWall();

    for (const wall of walls) {
      wall.r -= wall.speed * dt;
    }

    for (const wall of walls) {
      // La derrota ocurre cuando la punta exterior del triángulo toca la pared.
      const tipRadius = player.orbit + 11;
      const tipTouchesWall =
        Math.abs(wall.r - tipRadius) <= wall.thickness / 2;

      if (!tipTouchesWall) continue;

      const segAngle = Math.PI * 2 / 6;
      const localAngle = normalizeAngle(player.angle - rotation - wall.phase);
      const idx = Math.floor((localAngle + segAngle / 2) / segAngle) % 6;

      if (wall.blocked[idx]) {
        gameOver();
        break;
      }
    }

    walls = walls.filter(w => w.r > 34);

    flash = Math.max(0, flash - dt * 2.5);
    shake = Math.max(0, shake - dt * 28);
  }

  function polygonPath(radius, sides, angleOffset = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angleOffset + i * Math.PI * 2 / sides;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawBackground() {
    const hue = (elapsed * 18 + 220) % 360;
    ctx.fillStyle = `hsl(${hue} 28% 9%)`;
    ctx.fillRect(-W, -H, W * 2, H * 2);

    const slice = Math.PI * 2 / 6;
    const far = Math.max(W, H) * 1.1;

    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const a1 = rotation + i * slice;
      const a2 = rotation + (i + 1) * slice;
      ctx.arc(0, 0, far, a1, a2);
      ctx.closePath();
      ctx.fillStyle = i % 2
        ? `hsla(${hue + 18} 55% 38% / .22)`
        : `hsla(${hue - 10} 45% 24% / .12)`;
      ctx.fill();
    }
  }

  function drawWalls() {
    const slice = Math.PI * 2 / 6;

    for (const wall of walls) {
      ctx.save();
      ctx.rotate(rotation + wall.phase);
      ctx.lineCap = "butt";
      ctx.lineWidth = wall.thickness;
      ctx.strokeStyle = "rgba(255,255,255,.94)";

      for (let i = 0; i < 6; i++) {
        if (!wall.blocked[i]) continue;

        const a1 = i * slice - slice * 0.49;
        const a2 = (i + 1) * slice - slice * 0.51;

        ctx.beginPath();
        ctx.arc(0, 0, wall.r, a1, a2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawCore() {
    ctx.save();
    ctx.rotate(rotation * 1.18);
    polygonPath(player.orbit * .52, 6, Math.PI / 6);
    ctx.fillStyle = "rgba(255,255,255,.98)";
    ctx.fill();

    polygonPath(player.orbit * .36, 6, Math.PI / 6);
    ctx.fillStyle = "rgba(10,10,14,.92)";
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const a = player.angle;
    const x = Math.cos(a) * player.orbit;
    const y = Math.sin(a) * player.orbit;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);

    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 9);
    ctx.lineTo(-8, 9);
    ctx.closePath();

    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(255,255,255,.65)";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.save();

    const sx = shake ? (Math.random() - .5) * shake : 0;
    const sy = shake ? (Math.random() - .5) * shake : 0;
    ctx.translate(W / 2 + sx, H / 2 + sy);

    drawBackground();
    drawWalls();
    drawCore();
    drawPlayer();

    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(.55, flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;

    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
