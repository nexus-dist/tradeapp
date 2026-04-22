// ── Constants ──────────────────────────────────────────
const CANDLE_COUNT = 40;

const BASE_PRICES = {
  // OTC (синтетические, не привязаны к рынку — допустимо отклонение)
  'GBP/USD OTC': 1.32180, 'USD/CAD OTC': 1.38520, 'EUR/GBP OTC': 0.86140,
  'EUR/JPY OTC': 161.340, 'GBP/JPY OTC': 187.620, 'AUD/NZD OTC': 1.09180,
  'USD/RUB OTC': 81.250,  'CAD/JPY OTC': 103.480, 'CHF/JPY OTC': 160.740,
  'EUR/CHF OTC': 0.93560, 'AUD/CAD OTC': 0.88230, 'AED/CNY OTC': 1.97840,
  // Реальные пары — актуальные курсы апрель 2025
  'EUR/USD': 1.13520, 'BTC/USD': 87450.0, 'XAU/USD': 3320.50,
  'ETH/USD': 1620.40, 'USD/RUB': 81.430,  'USD/JPY': 142.380,
  'GBP/USD': 1.32150, 'USD/CHF': 0.87840, 'AUD/USD': 0.63520,
  'USD/CAD': 1.38640, 'NZD/USD': 0.58960, 'EUR/GBP': 0.86020,
  'EUR/JPY': 161.540, 'GBP/JPY': 187.840, 'AUD/JPY': 90.320,
  'CHF/JPY': 162.140, 'EUR/AUD': 1.78760, 'EUR/CAD': 1.57340,
  'GBP/AUD': 2.07820, 'GBP/CAD': 1.83240, 'AUD/CAD': 0.88340,
  'AUD/CHF': 0.55820, 'NZD/JPY': 83.940,  'NZD/CHF': 0.51760,
};

const translations = {
  ru: {
    generateButton: 'Получить сигнал',
    placeholder: 'Нажмите «Получить сигнал»',
    buy: 'ПОКУПКА',
    sell: 'ПРОДАЖА',
    accuracyLabel: 'точность',
    tfLabels: { 5000: '5 сек', 15000: '15 сек', 60000: '1 мин', 180000: '3 мин', 300000: '5 мин', 600000: '10 мин' },
  },
  en: {
    generateButton: 'Get Signal',
    placeholder: 'Press «Get Signal»',
    buy: 'BUY',
    sell: 'SELL',
    accuracyLabel: 'accuracy',
    tfLabels: { 5000: '5 sec', 15000: '15 sec', 60000: '1 min', 180000: '3 min', 300000: '5 min', 600000: '10 min' },
  },
  uz: {
    generateButton: 'Signal Olish',
    placeholder: '«Signal Olish» tugmasini bosing',
    buy: 'SOTIB OLISH',
    sell: 'SOTISH',
    accuracyLabel: 'aniqlik',
    tfLabels: { 5000: '5 son', 15000: '15 son', 60000: '1 daq', 180000: '3 daq', 300000: '5 daq', 600000: '10 daq' },
  },
};

// ── State ──────────────────────────────────────────────
let currentPair = 'GBP/USD OTC';
let currentLang = 'ru';
let selectedTfMs = 5000;
let cooldowns = {};
let candles = [];
let currentPrice = 0;
let startPrice = 0;
let chartState = null;
let priceTimer = null;
let candleTimer = null;

// ── Helpers ────────────────────────────────────────────
function getBase(pair) { return BASE_PRICES[pair] ?? 1.08456; }

function getDecimals(pair) {
  if (/JPY|RUB/.test(pair)) return 3;
  if (/BTC|ETH|XAU/.test(pair)) return 2;
  return 5;
}

function getVolatility(pair) {
  if (/BTC|ETH/.test(pair)) return 0.0007;
  if (/XAU/.test(pair))      return 0.0004;
  if (/JPY|RUB/.test(pair))  return 0.0003;
  return 0.00018;
}

// ── Candle generation ──────────────────────────────────
function makeCandle(prevClose, pair) {
  const base = getBase(pair);
  const vol  = getVolatility(pair);
  const move = (Math.random() - 0.48) * base * vol;
  const open  = prevClose;
  const close = open + move;
  const wick  = Math.abs(move) * (0.4 + Math.random() * 0.8);
  return {
    open,
    close,
    high: Math.max(open, close) + wick * Math.random(),
    low:  Math.min(open, close) - wick * Math.random(),
    vol:  20 + Math.random() * 80,
  };
}

function buildInitialCandles(pair) {
  const base = getBase(pair);
  let price = base * (1 + (Math.random() - 0.5) * 0.002);
  const result = [];
  for (let i = 0; i < CANDLE_COUNT; i++) {
    const c = makeCandle(price, pair);
    result.push(c);
    price = c.close;
  }
  return result;
}

// ── Chart ──────────────────────────────────────────────
function initChart(pair) {
  const el = document.getElementById('chart-container');
  d3.select('#chart-container').selectAll('*').remove();

  const W = el.clientWidth - 28; // 14px padding each side
  const H = el.clientHeight;
  const m = { top: 8, right: 54, bottom: 20, left: 4 };
  const iW = W - m.left - m.right;
  const iH = H - m.top - m.bottom;
  const volH   = Math.floor(iH * 0.18);
  const priceH = iH - volH - 4;

  const svg = d3.select('#chart-container').append('svg').attr('width', W).attr('height', H);
  svg.append('defs').append('clipPath').attr('id', 'clip')
    .append('rect').attr('width', iW).attr('height', priceH + volH + 4);

  const root = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const clip = root.append('g').attr('clip-path', 'url(#clip)');

  chartState = { svg, root, clip, iW, iH, priceH, volH, cw: Math.max(2, iW / CANDLE_COUNT - 1.5) };

  candles   = buildInitialCandles(pair);
  currentPrice = candles[candles.length - 1].close;
  startPrice   = currentPrice;

  drawChart();
  refreshHeader();
}

function drawChart() {
  if (!chartState) return;
  const { root, clip, iW, priceH, volH, cw } = chartState;

  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);
  const yMin  = Math.min(...lows);
  const yMax  = Math.max(...highs);
  const pad   = (yMax - yMin) * 0.12 || 0.001;

  const xSc = d3.scaleLinear().domain([0, CANDLE_COUNT - 1]).range([0, iW]);
  const ySc = d3.scaleLinear().domain([yMin - pad, yMax + pad]).range([priceH, 0]);
  const maxVol = Math.max(...candles.map(c => c.vol));
  const yVol = d3.scaleLinear().domain([0, maxVol]).range([volH, 0]);

  root.selectAll('.g-grid, .g-yaxis, .g-ptag').remove();
  clip.selectAll('*').remove();

  // Grid
  const gridG = root.append('g').attr('class', 'g-grid');
  ySc.ticks(4).forEach(t => {
    gridG.append('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', ySc(t)).attr('y2', ySc(t))
      .attr('stroke', '#1e1e32').attr('stroke-width', 0.8);
  });

  // Y axis
  const dec = getDecimals(currentPair);
  root.append('g').attr('class', 'g-yaxis')
    .attr('transform', `translate(${iW},0)`)
    .call(d3.axisRight(ySc).ticks(4).tickSize(0).tickFormat(d => d.toFixed(dec)))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick text')
      .attr('fill', '#475569').attr('font-size', '9px')
      .attr('dx', 4).attr('font-family', 'Inter, sans-serif'));

  // Volume
  candles.forEach((c, i) => {
    const x = xSc(i);
    const col = c.close >= c.open ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)';
    clip.append('rect')
      .attr('x', x - cw / 2).attr('y', priceH + 4 + yVol(c.vol))
      .attr('width', cw).attr('height', Math.max(1, volH - yVol(c.vol)))
      .attr('fill', col).attr('rx', 1);
  });

  // Candles
  candles.forEach((c, i) => {
    const x     = xSc(i);
    const isUp  = c.close >= c.open;
    const col   = isUp ? '#22c55e' : '#ef4444';
    const bTop  = Math.min(ySc(c.open), ySc(c.close));
    const bH    = Math.max(1, Math.abs(ySc(c.open) - ySc(c.close)));
    const cg    = clip.append('g');
    cg.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', ySc(c.high)).attr('y2', ySc(c.low))
      .attr('stroke', col).attr('stroke-width', 1);
    cg.append('rect')
      .attr('x', x - cw / 2).attr('y', bTop)
      .attr('width', cw).attr('height', bH)
      .attr('fill', col).attr('rx', 1);
  });

  // Price dashed line + tag
  const last = candles[candles.length - 1].close;
  const ly   = ySc(last);
  const ptag = root.append('g').attr('class', 'g-ptag');
  ptag.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', ly).attr('y2', ly)
    .attr('stroke', '#6366f1').attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3');
  ptag.append('rect')
    .attr('x', iW + 2).attr('y', ly - 9)
    .attr('width', 48).attr('height', 18)
    .attr('fill', '#6366f1').attr('rx', 3);
  ptag.append('text')
    .attr('x', iW + 26).attr('y', ly + 4.5)
    .attr('text-anchor', 'middle')
    .attr('fill', '#fff').attr('font-size', '9px')
    .attr('font-family', 'Inter, sans-serif').attr('font-weight', '600')
    .text(last.toFixed(dec));
}

// ── Price ticker ───────────────────────────────────────
function refreshHeader() {
  const dec  = getDecimals(currentPair);
  const base = getBase(currentPair);
  document.getElementById('current-price').textContent = currentPrice.toFixed(dec);
  const pct  = (currentPrice - base) / base * 100;
  const el   = document.getElementById('price-change');
  el.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  el.className   = pct >= 0 ? 'positive' : 'negative';
}

function addCandle() {
  const last = candles[candles.length - 1].close;
  const c = makeCandle(last, currentPair);
  candles.push(c);
  if (candles.length > CANDLE_COUNT) candles.shift();
  currentPrice = c.close;
  drawChart();
  refreshHeader();
}

function tickPrice() {
  const vol = getVolatility(currentPair);
  currentPrice += (Math.random() - 0.5) * getBase(currentPair) * vol * 0.35;
  refreshHeader();
}

function startTimers() {
  clearInterval(priceTimer);
  clearInterval(candleTimer);
  priceTimer  = setInterval(tickPrice,  1000);
  candleTimer = setInterval(addCandle,  2000);
}

// ── Signal display ─────────────────────────────────────
function showSignal(pair, isBuy, accuracy, tfMs) {
  const t = translations[currentLang];
  document.getElementById('signal-dir-icon').textContent  = isBuy ? '▲' : '▼';
  document.getElementById('signal-dir-icon').className    = 'dir-icon ' + (isBuy ? 'buy' : 'sell');
  document.getElementById('signal-dir-text').textContent  = isBuy ? t.buy : t.sell;
  document.getElementById('signal-dir-text').className    = 'dir-text ' + (isBuy ? 'buy' : 'sell');
  document.getElementById('signal-meta').textContent      = `${pair} · ${t.tfLabels[tfMs]}`;
  document.getElementById('signal-accuracy').textContent  = accuracy + '%';
  document.getElementById('signal-acc-label').textContent = t.accuracyLabel;
  const content = document.getElementById('signal-content');
  content.className = 'signal-content ' + (isBuy ? 'buy' : 'sell');
  document.getElementById('signal-placeholder').style.display = 'none';
  content.style.display = 'flex';
}

function hideSignal() {
  document.getElementById('signal-placeholder').style.display = 'flex';
  document.getElementById('signal-content').style.display     = 'none';
}

// ── Cooldown ───────────────────────────────────────────
function startCooldown(pair, endTime) {
  const btn  = document.getElementById('generate-btn');
  const span = document.getElementById('btn-text');

  if (cooldowns[pair]?.id) clearInterval(cooldowns[pair].id);

  function tick() {
    const rem = Math.ceil((endTime - Date.now()) / 1000);
    if (rem <= 0) {
      clearInterval(cooldowns[pair]?.id);
      delete cooldowns[pair];
      btn.disabled    = false;
      span.textContent = translations[currentLang].generateButton;
      return;
    }
    btn.disabled     = true;
    span.textContent = `${translations[currentLang].generateButton} (${rem}s)`;
  }

  tick();
  cooldowns[pair] = { endTime, id: setInterval(tick, 500) };
}

// ── Language ───────────────────────────────────────────
function applyLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  document.getElementById('placeholder-text').textContent = translations[lang].placeholder;
  document.getElementById('signal-acc-label').textContent = translations[lang].accuracyLabel;
  const btn = document.getElementById('generate-btn');
  if (!btn.disabled) {
    document.getElementById('btn-text').textContent = translations[lang].generateButton;
  }
  hideSignal();
}

// ── Bootstrap ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const pairSel = document.getElementById('currency-pair');
  const genBtn  = document.getElementById('generate-btn');

  currentPair = pairSel.value;
  document.getElementById('pair-name').textContent = currentPair;

  initChart(currentPair);
  startTimers();

  // Pair change
  pairSel.addEventListener('change', () => {
    currentPair = pairSel.value;
    document.getElementById('pair-name').textContent = currentPair;

    if (cooldowns[currentPair]?.endTime > Date.now()) {
      startCooldown(currentPair, cooldowns[currentPair].endTime);
    } else {
      genBtn.disabled = false;
      document.getElementById('btn-text').textContent = translations[currentLang].generateButton;
    }

    hideSignal();
    initChart(currentPair);
    startTimers();
  });

  // Timeframe
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTfMs = parseInt(btn.dataset.ms);
    });
  });

  // Language
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
  });

  // Generate signal
  genBtn.addEventListener('click', () => {
    const pair  = currentPair;
    const tfMs  = selectedTfMs;
    genBtn.disabled = true;
    document.getElementById('btn-text').textContent = translations[currentLang].generateButton + '...';

    setTimeout(() => {
      const isBuy   = Math.random() > 0.5;
      const accuracy = (85 + Math.random() * 10).toFixed(1);
      showSignal(pair, isBuy, accuracy, tfMs);
      startCooldown(pair, Date.now() + tfMs);
    }, 800);
  });

  // Resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => initChart(currentPair), 150);
  });
});
