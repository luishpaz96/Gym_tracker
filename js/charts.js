// Gráficas con Chart.js (CDN, SRI). Si la librería no carga, se dibuja una versión simple en canvas.
const live = new Map();

const css = (name, fb) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;

export function drawChart(canvas, { type, labels, datasets, yTitle, zero = true }) {
  const prev = live.get(canvas);
  if (prev) { prev.destroy(); live.delete(canvas); }
  const text = css('--muted', '#999'), grid = css('--line', '#333');
  const palette = [css('--accent', '#4aa3ff'), css('--warn', '#f5b83d'), css('--good', '#3ccf7e')];
  const ds = datasets.map((d, i) => ({ borderColor: palette[i % 3], backgroundColor: i === 0 ? palette[0] + 'cc' : 'transparent', borderWidth: 2, tension: 0.25, pointRadius: 3, ...d }));
  if (window.Chart) {
    const chart = new window.Chart(canvas, {
      type, data: { labels, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: ds.length > 1, labels: { color: text } } },
        scales: { x: { ticks: { color: text, maxRotation: 0, autoSkip: true }, grid: { color: grid } },
          y: { beginAtZero: zero, ticks: { color: text }, grid: { color: grid }, title: { display: !!yTitle, text: yTitle, color: text } } },
      },
    });
    live.set(canvas, chart);
    return;
  }
  drawFallback(canvas, type, labels, ds, text, grid, zero);
}

function drawFallback(canvas, type, labels, ds, text, grid, zero = true) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 320, H = canvas.clientHeight || 220;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
  const pad = { l: 36, r: 8, t: 10, b: 24 };
  const all = ds.flatMap((d) => d.data.map((v) => +v || 0));
  const lo = zero ? 0 : Math.floor(Math.min(...all) - 1);
  const max = zero ? Math.max(1, ...all) * 1.1 : Math.ceil(Math.max(...all) + 1);
  const x = (i) => pad.l + ((W - pad.l - pad.r) * (i + 0.5)) / Math.max(1, labels.length);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (max - lo));
  c.font = '11px system-ui, sans-serif'; c.fillStyle = text; c.strokeStyle = grid; c.lineWidth = 1;
  for (let k = 0; k <= 4; k++) { const v = lo + ((max - lo) * k) / 4, yy = y(v); c.beginPath(); c.moveTo(pad.l, yy); c.lineTo(W - pad.r, yy); c.stroke(); c.textAlign = 'right'; c.fillText(String((max - lo) > 30 ? Math.round(v) : Math.round(v * 10) / 10), pad.l - 4, yy + 4); }
  const step = Math.ceil(labels.length / 6);
  c.textAlign = 'center'; labels.forEach((l, i) => { if (i % step === 0) c.fillText(l, x(i), H - 6); });
  ds.forEach((d, di) => {
    c.setLineDash(d.borderDash || []); c.strokeStyle = d.borderColor; c.fillStyle = d.type === 'line' || type === 'line' ? d.borderColor : d.backgroundColor; c.lineWidth = 2;
    if ((d.type || type) === 'bar') {
      const bw = Math.max(4, ((W - pad.l - pad.r) / labels.length) * 0.6);
      d.data.forEach((v, i) => { c.fillRect(x(i) - bw / 2, y(v), bw, y(0) - y(v)); });
    } else {
      c.beginPath(); d.data.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v)))); c.stroke();
      c.setLineDash([]);
      if (d.pointRadius !== 0) d.data.forEach((v, i) => { c.beginPath(); c.arc(x(i), y(v), 3, 0, 7); c.fill(); });
    }
  });
}
