// drawing-canvas.js
// Componente reutilizável: canvas de desenho com caneta, borracha e limpar tudo.
// Retorna getDataURL() pra pegar o desenho como imagem (PNG base64).

export function createDrawingCanvas({ container, width = 280, height = 280 }) {
  container.innerHTML = `
    <canvas id="draw-canvas" width="${width}" height="${height}" style="background:#fff; border-radius:8px; touch-action:none; cursor:crosshair; max-width:100%;"></canvas>
    <div style="margin-top:6px; display:flex; gap:6px; justify-content:center;">
      <button id="draw-pen-btn" type="button">✏️ Caneta</button>
      <button id="draw-eraser-btn" type="button">🧹 Apagar</button>
      <button id="draw-clear-btn" type="button">🗑️ Limpar tudo</button>
    </div>
  `;
  const canvas = container.querySelector("#draw-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let mode = "pen"; // pen | eraser
  let drawing = false;

  function setMode(m) {
    mode = m;
    container.querySelector("#draw-pen-btn").style.outline = m === "pen" ? "3px solid var(--mg-accent, #ff5e5e)" : "none";
    container.querySelector("#draw-eraser-btn").style.outline = m === "eraser" ? "3px solid var(--mg-accent, #ff5e5e)" : "none";
  }
  setMode("pen");

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: ((clientX - rect.left) / rect.width) * width, y: ((clientY - rect.top) / rect.height) * height };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineWidth = mode === "eraser" ? 22 : 4;
    ctx.strokeStyle = mode === "eraser" ? "#fff" : "#000";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  container.querySelector("#draw-pen-btn").addEventListener("click", () => setMode("pen"));
  container.querySelector("#draw-eraser-btn").addEventListener("click", () => setMode("eraser"));
  container.querySelector("#draw-clear-btn").addEventListener("click", () => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  });

  return {
    getDataURL: () => canvas.toDataURL("image/png"),
    destroy: () => window.removeEventListener("mouseup", end),
  };
}
