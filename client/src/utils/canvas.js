export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function normalizePoint(clientX, clientY, rect) {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function denormalizePoint(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}

export function resizeCanvasToDisplaySize(canvas, dpr = window.devicePixelRatio || 1) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

function pathFromPoints(ctx, points, width, height) {
  if (!points?.length) return;
  const first = denormalizePoint(points[0], width, height);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = denormalizePoint(points[i], width, height);
    ctx.lineTo(point.x, point.y);
  }
}

export function drawGrid(ctx, width, height) {
  const spacing = Math.max(24, Math.round(Math.min(width, height) / 28));
  ctx.save();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderAction(ctx, action, width, height, options = {}) {
  const scale = Math.min(width, height);
  ctx.save();

  if (action.type === 'stroke') {
    if (!action.points?.length) return ctx.restore();
    ctx.strokeStyle = action.color || '#0f172a';
    ctx.lineWidth = Math.max(1, (action.size || 4) * (scale / 900));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    pathFromPoints(ctx, action.points, width, height);
    if (action.points.length === 1) {
      const p = denormalizePoint(action.points[0], width, height);
      ctx.fillStyle = action.color || '#0f172a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  if (action.type === 'rect' || action.type === 'circle') {
    const x1 = action.start.x * width;
    const y1 = action.start.y * height;
    const x2 = action.end.x * width;
    const y2 = action.end.y * height;
    const w = x2 - x1;
    const h = y2 - y1;
    ctx.strokeStyle = action.color || '#0f172a';
    ctx.lineWidth = Math.max(1, (action.size || 4) * (scale / 900));
    ctx.fillStyle = action.fill || 'transparent';
    if (action.type === 'rect') {
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(w), Math.abs(h));
    } else {
      ctx.beginPath();
      ctx.ellipse(x1 + w / 2, y1 + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (action.type === 'text') {
    const fontPx = Math.max(10, (action.fontSize || 24) * (scale / 900));
    ctx.fillStyle = action.color || '#0f172a';
    ctx.font = `${action.fontWeight || 500} ${fontPx}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(action.text, action.x * width, action.y * height, options.maxTextWidth || width * 0.8);
  }

  ctx.restore();
}

export function renderBoard(canvas, actions) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  actions.forEach((action) => renderAction(ctx, action, width, height));
  ctx.restore();
}
