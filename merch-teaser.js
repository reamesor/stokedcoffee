(function () {
  const root = document.querySelector("[data-merch-teaser]");
  if (!root) return;

  const scene = root.querySelector(".merch-teaser-scene");
  const grain = root.querySelector(".merch-teaser-grain");
  if (!scene || !grain) return;

  const ctx = scene.getContext("2d", { alpha: false });
  const grainCtx = grain.getContext("2d", { alpha: false });
  if (!ctx || !grainCtx) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 700px)");

  let raf = 0;
  let grainTimer = 0;
  let lastGrain = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let trail = [];
  let figure = null;
  let running = false;

  const GRAIN_MS = 90;
  const GRAIN_W = 160;
  const GRAIN_H = 100;

  function trailLen() {
    return mobile.matches ? 6 : 10;
  }

  function stampFigure(scale) {
    const pad = 48;
    const fw = Math.ceil(92 * scale + pad * 2);
    const fh = Math.ceil(130 * scale + pad * 2);
    const c = document.createElement("canvas");
    c.width = fw;
    c.height = fh;
    const g = c.getContext("2d");
    if (!g) return null;
    const cx = fw / 2;
    const cy = fh / 2 + 8 * scale;
    g.filter = "blur(" + (mobile.matches ? 7 : 11) + "px)";
    g.fillStyle = "rgba(6, 6, 14, 0.92)";
    g.beginPath();
    g.ellipse(cx, cy - 38 * scale, 16 * scale, 20 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy + 18 * scale, 34 * scale, 46 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.filter = "none";
    return { canvas: c, cx: cx, cy: cy };
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.5 : 2);
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    scene.width = Math.round(w * dpr);
    scene.height = Math.round(h * dpr);
    scene.style.width = w + "px";
    scene.style.height = h + "px";
    grain.width = GRAIN_W;
    grain.height = GRAIN_H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.min(w, h) / 420;
    figure = stampFigure(Math.max(0.72, scale));
    trail = [];
    paintGrain();
    draw(performance.now() * 0.001);
  }

  function paintGrain() {
    const img = grainCtx.createImageData(GRAIN_W, GRAIN_H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = 90 + Math.random() * 80;
      d[i] = n;
      d[i + 1] = n;
      d[i + 2] = n;
      d[i + 3] = 255;
    }
    grainCtx.putImageData(img, 0, 0);
  }

  function glow(t, ox, oy, radius, rgb, phase, speed) {
    const x = w * (0.5 + ox + Math.sin(t * speed + phase) * 0.06);
    const y = h * (0.48 + oy + Math.cos(t * speed * 0.85 + phase) * 0.05);
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, "rgba(" + rgb + ",0.42)");
    g.addColorStop(0.45, "rgba(" + rgb + ",0.16)");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function pose(t) {
    const ampX = w * 0.12;
    const ampY = h * 0.045;
    return {
      x: w * 0.5 + Math.sin(t * 0.55) * ampX,
      y: h * 0.46 + Math.sin(t * 0.82 + 0.9) * ampY
    };
  }

  function draw(t) {
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    glow(t, -0.16, 0.02, w * 0.48, "255,146,108", 0.2, 0.23);
    glow(t, 0.18, -0.1, w * 0.44, "46,168,162", 1.7, 0.17);
    glow(t, 0.02, 0.16, w * 0.4, "232,122,158", 3.1, 0.2);
    ctx.restore();

    const now = pose(t);
    trail.push(now);
    const max = trailLen();
    if (trail.length > max) trail.splice(0, trail.length - max);

    const last = trail[trail.length - 1] || now;
    ctx.save();
    ctx.strokeStyle = "rgba(242,238,227,0.12)";
    ctx.lineWidth = 1.15;
    for (let i = 0; i < 3; i++) {
      const drift = Math.sin(t * 0.7 + i * 1.1) * 5;
      ctx.beginPath();
      ctx.ellipse(
        last.x,
        last.y + h * 0.22 + drift + i * 7,
        w * (0.11 + i * 0.045),
        h * (0.018 + i * 0.008),
        0,
        0,
        Math.PI * 2
      );
      ctx.globalAlpha = 0.55 - i * 0.14;
      ctx.stroke();
    }
    ctx.restore();

    if (figure) {
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const fade = (i + 1) / trail.length;
        ctx.globalAlpha = 0.08 + fade * 0.72;
        ctx.drawImage(figure.canvas, p.x - figure.cx, p.y - figure.cy);
      }
      ctx.globalAlpha = 1;
    }
  }

  function loop(now) {
    draw(now * 0.001);
    if (now - lastGrain >= GRAIN_MS) {
      paintGrain();
      lastGrain = now;
    }
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (grainTimer) window.clearInterval(grainTimer);
    grainTimer = 0;
  }

  function start() {
    stop();
    running = true;
    lastGrain = 0;
    if (reduced.matches) {
      paintGrain();
      draw(0.4);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function onVis() {
    if (document.hidden) stop();
    else start();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();
  start();

  document.addEventListener("visibilitychange", onVis);
  reduced.addEventListener("change", start);
  mobile.addEventListener("change", resize);

  window.addEventListener("pagehide", function cleanup() {
    stop();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    reduced.removeEventListener("change", start);
    mobile.removeEventListener("change", resize);
  }, { once: true });
})();
