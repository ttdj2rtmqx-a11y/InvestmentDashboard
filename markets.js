(function () {
  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
  const waitingSeries = Array.from({ length: 12 }, () => 100);
  const indexModels = [
    { symbol: "SPY", label: "S&P 500", color: "#0a84ff", series: waitingSeries },
    { symbol: "QQQ", label: "Nasdaq 100", color: "#7c5cff", series: waitingSeries },
    { symbol: "DIA", label: "Dow 30", color: "#1f9d63", series: waitingSeries },
    { symbol: "IWM", label: "Russell 2000", color: "#c48a22", series: waitingSeries },
    { symbol: "EFA", label: "Developed ex-US", color: "#3867d6", series: waitingSeries },
  ];
  let indexState = indexModels.map((item) => ({ ...item, source: "Refresh needed" }));

  const $ = (selector) => document.querySelector(selector);

  function pct(value, decimals = 1) {
    return `${Number(value).toFixed(decimals)}%`;
  }

  function alphaUrl(params) {
    const url = new URL(ALPHA_VANTAGE_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }

  function savedApiKey() {
    try {
      return JSON.parse(localStorage.getItem(DATA_SETTINGS_KEY))?.alphaVantageKey || "";
    } catch {
      return "";
    }
  }

  function makePath(points, width = 280, height = 94, padding = 10) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
        const y = height - padding - ((point - min) / range) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function indexMetrics(series) {
    const first = series[0] || 1;
    const last = series.at(-1) || first;
    const previous = series.at(-2) || first;
    const oneDay = ((last / previous - 1) * 100) || 0;
    const period = ((last / first - 1) * 100) || 0;
    const high = Math.max(...series);
    const drawdown = ((last / high - 1) * 100) || 0;
    return { oneDay, period, drawdown };
  }

  function renderIndexCards() {
    const cards = indexState
      .map((item) => {
        const metrics = indexMetrics(item.series);
        const tone = metrics.oneDay >= 0 ? "positive" : "negative";
        return `
          <article class="index-card">
            <div class="index-card-top">
              <div>
                <span>${item.symbol}</span>
                <strong>${item.label}</strong>
              </div>
              <b class="${tone}">${metrics.oneDay >= 0 ? "+" : ""}${pct(metrics.oneDay)}</b>
            </div>
            <svg class="index-sparkline" viewBox="0 0 280 94" role="img" aria-label="${item.label} price chart">
              <path class="index-fill" d="${makePath(item.series)} L 270 84 L 10 84 Z" fill="${item.color}22"></path>
              <path d="${makePath(item.series)}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round"></path>
            </svg>
            <div class="index-metrics">
              <span>Period <strong class="${metrics.period >= 0 ? "positive" : "negative"}">${metrics.period >= 0 ? "+" : ""}${pct(metrics.period)}</strong></span>
              <span>Drawdown <strong>${pct(metrics.drawdown)}</strong></span>
              <span>${item.source}</span>
            </div>
          </article>
        `;
      })
      .join("");
    $("#indexCards").innerHTML = cards;
    renderIndexSummary();
  }

  function renderIndexSummary() {
    const metrics = indexState.map((item) => ({ item, ...indexMetrics(item.series) }));
    const positive = metrics.filter((item) => item.oneDay >= 0).length;
    const averagePeriod = metrics.reduce((sum, item) => sum + item.period, 0) / metrics.length;
    const hasLiveData = indexState.some((item) => item.source === "Alpha Vantage");
    const riskTone = !hasLiveData ? "Connect data" : averagePeriod > 8 && positive >= 4 ? "Risk-on" : averagePeriod > 2 && positive >= 3 ? "Constructive" : positive >= 3 ? "Mixed" : "Defensive";
    $("#indexRiskTone").textContent = riskTone;
    $("#indexRiskDetail").textContent = hasLiveData ? `${positive} of ${metrics.length} indexes are positive on the latest session.` : "Save an Alpha Vantage key and refresh to load live index history.";
    $("#indexBreadthBars").innerHTML = metrics
      .map(({ item, oneDay }) => `
        <div>
          <span>${item.label}</span>
          <i><b style="width:${Math.min(100, Math.max(4, 50 + oneDay * 12))}%; background:${item.color}"></b></i>
          <strong class="${oneDay >= 0 ? "positive" : "negative"}">${oneDay >= 0 ? "+" : ""}${pct(oneDay)}</strong>
        </div>
      `)
      .join("");
  }

  function setIndexStatus(label, state = "neutral") {
    const badge = $("#indexDataStatus");
    if (!badge) return;
    badge.textContent = label;
    badge.className = `data-badge ${state}`;
  }

  async function fetchDailySeries(symbol, apiKey) {
    const response = await fetch(alphaUrl({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact", apikey: apiKey }));
    const payload = await response.json();
    if (payload.Note || payload.Information) throw new Error(payload.Note || payload.Information);
    const series = payload["Time Series (Daily)"];
    if (!series) throw new Error(`No daily series returned for ${symbol}.`);
    return Object.entries(series)
      .map(([date, values]) => ({ date, close: Number(values["4. close"]) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async function refreshIndexes() {
    const apiKey = savedApiKey();
    if (!apiKey) {
      setIndexStatus("Live key needed", "neutral");
      renderIndexCards();
      return;
    }
    setIndexStatus("Refreshing indexes", "neutral");
    const updated = [];
    for (const item of indexModels) {
      try {
        const candles = await fetchDailySeries(item.symbol, apiKey);
        const closes = candles.slice(-60).map((candle) => candle.close);
        const base = closes[0] || 1;
        updated.push({ ...item, series: closes.map((close) => (close / base) * 100), source: "Alpha Vantage" });
      } catch {
        updated.push({ ...item, source: "Refresh needed" });
      }
    }
    indexState = updated;
    renderIndexCards();
    setIndexStatus(updated.some((item) => item.source === "Alpha Vantage") ? "Live index data" : "Live data needed", updated.some((item) => item.source === "Alpha Vantage") ? "positive" : "negative");
  }

  function initMarketCharts() {
    if (!$("#indexCards")) return;
    renderIndexCards();
    refreshIndexes();
    $("#refreshMarketData")?.addEventListener("click", () => {
      window.setTimeout(refreshIndexes, 600);
    });
    $("#saveMarketDataKey")?.addEventListener("click", () => {
      window.setTimeout(refreshIndexes, 200);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMarketCharts);
  else initMarketCharts();
})();

(function () {
  if (window.__investmentDeskPerformancePatch) return;
  window.__investmentDeskPerformancePatch = true;

  const windows = { "1Y": 60, "3Y": 180, "5Y": 260 };
  const benchmarkByCategory = {
    "US equities": "SPY",
    "International equities": "EFA",
    "Fixed income": "BND",
    Credit: "HYG",
    Commodities: "GLD",
    "Real estate": "VNQ",
    "Crypto assets": "BTC",
    Alternatives: "SPY",
    Cash: "CASH",
  };
  const returnProfiles = {
    "US equities": { drift: 7.2, wave: 2.4 },
    "International equities": { drift: 5.8, wave: 2.1 },
    "Fixed income": { drift: 3.8, wave: 0.8 },
    Credit: { drift: 5.1, wave: 1.2 },
    Commodities: { drift: 3.2, wave: 2.7 },
    "Real estate": { drift: 4.8, wave: 2 },
    "Crypto assets": { drift: 10.5, wave: 6.4 },
    Alternatives: { drift: 4.5, wave: 1.5 },
    Cash: { drift: 2.8, wave: 0.1 },
  };
  let selectedWindow = "1Y";

  const $ = (selector) => document.querySelector(selector);

  function pct(value) {
    return `${value >= 0 ? "+" : ""}${Number(value || 0).toFixed(1)}%`;
  }

  function normalize(values) {
    const clean = Array.isArray(values) && values.length ? values.map(Number).filter(Number.isFinite) : [100];
    const first = clean[0] || 1;
    return clean.map((value) => Number(((value / first) * 100).toFixed(2)));
  }

  function activePortfolioHoldings() {
    try {
      if (typeof activeHoldings === "function") return activeHoldings().filter((item) => Number(item.value || 0) > 0);
      return (appState?.holdings || []).filter((item) => String(item.ticker || "").trim() && item.name !== "Open portfolio slot" && Number(item.value || 0) > 0);
    } catch {
      return [];
    }
  }

  function alignSeries(series, length) {
    const normalized = normalize(series);
    if (normalized.length >= length) return normalized.slice(-length);
    return [...Array.from({ length: length - normalized.length }, () => normalized[0] || 100), ...normalized];
  }

  function modeledSeries(category, length, risk = 50) {
    const profile = returnProfiles[category] || returnProfiles.Alternatives;
    const riskTilt = Math.max(-2.5, Math.min(4.5, (Number(risk || 50) - 50) / 18));
    const periodDrift = (profile.drift + riskTilt) * (length / 260);
    return Array.from({ length }, (_, index) => {
      const progress = length <= 1 ? 0 : index / (length - 1);
      const wave = Math.sin(progress * Math.PI * 2.35) * profile.wave;
      const chop = Math.sin(progress * Math.PI * 7.1 + profile.wave) * (profile.wave * 0.34);
      return Number((100 + periodDrift * progress + wave + chop).toFixed(2));
    });
  }

  function path(points, width, height, padding) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
        const y = height - padding - ((point - min) / range) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function blend(items, length) {
    const total = items.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
    return Array.from({ length }, (_, index) => Number(items.reduce((sum, item) => sum + item.series[index] * (Number(item.weight || 0) / total), 0).toFixed(2)));
  }

  function holdingSeries(holding, length) {
    const hasLive = Array.isArray(holding.series) && holding.series.length > 1 && !["Manual", "Sample"].includes(holding.lastPriceSource || holding.source);
    return {
      source: hasLive ? "live" : "modeled",
      series: hasLive ? alignSeries(holding.series, length) : modeledSeries(holding.category || "Alternatives", length, holding.risk),
      weight: Number(holding.value || 0),
    };
  }

  function benchmarkSeries(length) {
    const targets = riskProfiles?.[appState?.riskProfile]?.categoryTargets || riskProfiles?.balanced?.categoryTargets || {};
    return blend(
      Object.entries(targets).map(([category, weight]) => {
        const ticker = benchmarkByCategory[category];
        const live = (typeof technicals !== "undefined" ? technicals : []).find((item) => item.ticker === ticker && Array.isArray(item.series) && item.series.length > 1);
        return { weight, series: live ? alignSeries(live.series, length) : modeledSeries(category, length) };
      }),
      length
    );
  }

  function drawPerformance() {
    const svg = $("#lineChart");
    if (!svg) return;
    const holdings = activePortfolioHoldings();
    const width = 720;
    const height = 300;
    const padding = 36;
    const length = windows[selectedWindow] || windows["1Y"];

    document.querySelectorAll(".segmented button").forEach((button) => button.classList.toggle("active", button.textContent.trim() === selectedWindow));

    if (!holdings.length) {
      svg.innerHTML = `<text x="40" y="140" fill="#6b7280" font-size="18" font-weight="800">Add holdings to build portfolio performance.</text><text x="40" y="172" fill="#8a94a6" font-size="13" font-weight="700">This chart updates from your positions, risk profile, and refreshed market history.</text>`;
      return;
    }

    const holdingItems = holdings.map((holding) => holdingSeries(holding, length));
    const portfolio = blend(holdingItems, length);
    const benchmark = benchmarkSeries(length);
    const portfolioPath = path(portfolio, width, height, padding);
    const benchmarkPath = path(benchmark, width, height, padding);
    const areaPath = `${portfolioPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
    const liveCount = holdingItems.filter((item) => item.source === "live").length;
    const source = liveCount === holdings.length ? "Live history" : liveCount ? `${liveCount}/${holdings.length} live histories` : "Modeled until refresh";
    const gridlines = [0, 1, 2, 3]
      .map((index) => {
        const y = padding + index * ((height - padding * 2) / 3);
        return `<line class="gridline" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
      })
      .join("");

    svg.innerHTML = `${gridlines}<path class="area-fill" d="${areaPath}" /><path class="line-benchmark" d="${benchmarkPath}" /><path class="line-portfolio" d="${portfolioPath}" /><circle cx="${width - padding}" cy="54" r="6" fill="#0f8f8c" /><text x="${width - padding - 184}" y="58" fill="#17202a" font-size="14" font-weight="800">Portfolio ${pct(portfolio.at(-1) - portfolio[0])}</text><circle cx="${width - padding}" cy="82" r="6" fill="#c88a24" /><text x="${width - padding - 184}" y="86" fill="#17202a" font-size="14" font-weight="800">Benchmark ${pct(benchmark.at(-1) - benchmark[0])}</text><text x="${padding}" y="${height - 12}" fill="#6b7280" font-size="12" font-weight="800">${selectedWindow} · ${source}</text>`;
  }

  function bindPerformancePatch() {
    document.querySelectorAll(".segmented button").forEach((button) => {
      button.addEventListener("click", () => {
        selectedWindow = button.textContent.trim();
        drawPerformance();
      });
    });
    document.addEventListener("input", (event) => {
      if (event.target.closest("#holdingsRows") || event.target.closest("#rebalance")) window.setTimeout(drawPerformance, 0);
    });
    document.addEventListener("change", (event) => {
      if (event.target.closest("#holdingsRows") || event.target.closest("#rebalance")) window.setTimeout(drawPerformance, 0);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("#addHolding") || event.target.closest("#resetPortfolio") || event.target.closest("[data-remove]") || event.target.closest("#runRebalance")) {
        window.setTimeout(drawPerformance, 80);
      }
    });
  }

  try {
    if (typeof renderChart === "function") renderChart = drawPerformance;
    if (typeof renderAll === "function" && !window.__investmentDeskRenderAllPerformanceWrapped) {
      const originalRenderAll = renderAll;
      renderAll = function (...args) {
        const result = originalRenderAll.apply(this, args);
        drawPerformance();
        return result;
      };
      window.__investmentDeskRenderAllPerformanceWrapped = true;
    }
  } catch {
    window.renderChart = drawPerformance;
  }

  bindPerformancePatch();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drawPerformance);
  else drawPerformance();
})();

(function () {
  if (window.__investmentDeskTechnicalPatch) return;
  window.__investmentDeskTechnicalPatch = true;

  const TECHNICAL_STORAGE_KEY = "investmentDeskTechnicalsV1";
  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const MAX_TECHNICAL_ITEMS = 40;
  const categoryOptions = ["Stock", "ETF", "Bond", "Treasury", "Credit", "Commodity", "Crypto", "Currency", "Real estate", "Alternative"];
  const $ = (selector) => document.querySelector(selector);

  function readSavedSettings() {
    try {
      return JSON.parse(localStorage.getItem(DATA_SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function clean(value, fallback = "") {
    return String(value ?? fallback).trim();
  }

  function html(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function classFor(value) {
    try {
      if (typeof trendClass === "function") return trendClass(value);
    } catch {
      // Continue with the local classifier.
    }
    const text = String(value || "").toLowerCase();
    if (text.includes("up") || text.includes("buy") || text.includes("bull") || text.includes("positive") || text.includes("oversold")) return "positive";
    if (text.includes("down") || text.includes("hedge") || text.includes("negative") || text.includes("extended")) return "negative";
    return "neutral";
  }

  function renderSignal(label) {
    try {
      if (typeof signalPill === "function") return signalPill(html(label));
    } catch {
      // Continue with the local pill.
    }
    return `<span class="signal-pill ${classFor(label)}">${html(label)}</span>`;
  }

  function renderRsi(value) {
    const rsi = Math.round(Number(value || 50));
    try {
      if (typeof rsiPill === "function") return rsiPill(rsi);
    } catch {
      // Continue with the local RSI badge.
    }
    const state = rsi >= 70 ? "Overbought" : rsi <= 35 ? "Oversold" : rsi > 55 ? "Bullish" : "Neutral";
    return `<span class="rsi"><strong>${rsi}</strong><small>${state}</small></span>`;
  }

  function normalizeItem(item = {}) {
    const ticker = clean(item.ticker).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
    return {
      ticker,
      name: clean(item.name, ticker ? `${ticker} instrument` : "New instrument"),
      category: clean(item.category, "Stock"),
      trend: clean(item.trend, "Refresh needed"),
      rsi: Number.isFinite(Number(item.rsi)) ? Math.round(Number(item.rsi)) : 50,
      macd: clean(item.macd, "Refresh"),
      dma: clean(item.dma, "0.0%"),
      atr: clean(item.atr, "0.0%"),
      signal: clean(item.signal, "Connect data"),
      series: Array.isArray(item.series) ? item.series : [],
    };
  }

  function defaultItems() {
    try {
      if (Array.isArray(technicals) && technicals.length) return technicals.map(normalizeItem);
    } catch {
      // Fall through to a compact default list.
    }
    return [
      { ticker: "SPY", name: "S&P 500 ETF", category: "ETF" },
      { ticker: "QQQ", name: "Nasdaq 100 ETF", category: "ETF" },
      { ticker: "TLT", name: "20+ Year Treasury ETF", category: "Treasury" },
      { ticker: "HYG", name: "High Yield Bond ETF", category: "Credit" },
      { ticker: "GLD", name: "Gold Trust", category: "Commodity" },
      { ticker: "BTC", name: "Bitcoin", category: "Crypto" },
    ].map(normalizeItem);
  }

  function loadItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(TECHNICAL_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved.map(normalizeItem).filter((item) => item.ticker).slice(0, MAX_TECHNICAL_ITEMS);
    } catch {
      // Ignore corrupt browser storage and rebuild from defaults.
    }
    return defaultItems();
  }

  function writeItems(items) {
    localStorage.setItem(TECHNICAL_STORAGE_KEY, JSON.stringify(items.map(normalizeItem).filter((item) => item.ticker)));
  }

  function syncGlobalItems(items) {
    try {
      if (Array.isArray(technicals)) {
        technicals.splice(0, technicals.length, ...items);
        return;
      }
    } catch {
      // Continue to expose the data on window for any future scripts.
    }
    window.technicals = items;
  }

  function currentItems() {
    try {
      if (Array.isArray(technicals)) return technicals;
    } catch {
      // Fall through to window-scoped data.
    }
    return Array.isArray(window.technicals) ? window.technicals : [];
  }

  function setTechnicalStatus(text, state = "neutral") {
    const badge = $("#technicalDataStatus");
    if (!badge) return;
    badge.textContent = text;
    badge.className = `data-badge ${state}`;
  }

  function renderInteractiveTechnicals() {
    ensureTechnicalControls();
    const rows = currentItems()
      .map((item, index) => {
        const ticker = clean(item.ticker).toUpperCase();
        const initials = html(ticker.slice(0, 3) || "NA");
        return `
          <tr>
            <td>
              <div class="asset-cell">
                <span class="ticker">${initials}</span>
                <div>
                  <strong>${html(ticker)}</strong><br />
                  <span>${html(item.name)}</span>
                </div>
              </div>
            </td>
            <td>${html(item.category)}</td>
            <td>${renderSignal(item.trend)}</td>
            <td>${renderRsi(item.rsi)}</td>
            <td>${renderSignal(item.macd)}</td>
            <td class="${classFor(item.dma)}">${html(item.dma)}</td>
            <td>${html(item.atr)}</td>
            <td>
              <div class="technical-action-cell">
                ${renderSignal(item.signal)}
                <button class="technical-remove" type="button" data-remove-technical="${index}" aria-label="Remove ${html(ticker)} from technical analysis">&times;</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
    const body = $("#technicalRows");
    if (body) body.innerHTML = rows || `<tr><td colspan="8"><div class="empty-state">Add an instrument to start building your technical matrix.</div></td></tr>`;
    const count = currentItems().length;
    const hasKey = Boolean(readSavedSettings().alphaVantageKey);
    setTechnicalStatus(hasKey ? `${count} tracked · live ready` : `${count} tracked · key needed`, hasKey ? "positive" : "neutral");
    const counter = $("#technicalCount");
    if (counter) counter.textContent = `${count}/${MAX_TECHNICAL_ITEMS}`;
  }

  function injectTechnicalStyles() {
    if ($("#technicalPatchStyles")) return;
    const style = document.createElement("style");
    style.id = "technicalPatchStyles";
    style.textContent = `
      .technical-builder {
        display: grid;
        gap: 10px;
        margin: 14px 0 4px;
      }
      .technical-controls {
        grid-template-columns: minmax(90px, 0.4fr) minmax(180px, 1fr) minmax(140px, 0.55fr) auto auto;
      }
      .technical-builder-actions {
        display: flex;
        gap: 8px;
        align-items: end;
      }
      .technical-builder-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 800;
      }
      .technical-action-cell {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
      .technical-remove {
        width: 30px;
        min-height: 30px;
        padding: 0;
        border: 1px solid rgba(217, 79, 79, 0.22);
        border-radius: 999px;
        background: rgba(217, 79, 79, 0.07);
        color: #b33a3a;
        font-size: 1rem;
        font-weight: 900;
        cursor: pointer;
      }
      .technical-remove:hover {
        background: rgba(217, 79, 79, 0.12);
      }
      @media (max-width: 820px) {
        .technical-controls {
          grid-template-columns: 1fr;
        }
        .technical-builder-actions,
        .technical-action-cell {
          justify-content: flex-start;
        }
      }
    `;
    document.head.append(style);
  }

  function ensureTechnicalControls() {
    const panel = $("#technicals");
    const tableWrap = panel?.querySelector(".table-wrap");
    if (!panel || !tableWrap || $("#technicalBuilder")) return;
    injectTechnicalStyles();
    const builder = document.createElement("div");
    builder.className = "technical-builder";
    builder.id = "technicalBuilder";
    builder.innerHTML = `
      <div class="watchlist-controls technical-controls">
        <label>
          <span>Ticker</span>
          <input id="technicalTickerInput" type="text" placeholder="AAPL, BND, BTC" autocomplete="off" />
        </label>
        <label>
          <span>Name</span>
          <input id="technicalNameInput" type="text" placeholder="Instrument name" autocomplete="off" />
        </label>
        <label>
          <span>Category</span>
          <select id="technicalCategoryInput">
            ${categoryOptions.map((category) => `<option value="${html(category)}">${html(category)}</option>`).join("")}
          </select>
        </label>
        <button class="primary-button" id="addTechnicalItem" type="button">Add</button>
        <button class="text-button" id="refreshTechnicals" type="button">Refresh</button>
      </div>
      <div class="technical-builder-meta">
        <span id="technicalHelper">Custom technical universe</span>
        <strong id="technicalCount">0/${MAX_TECHNICAL_ITEMS}</strong>
      </div>
    `;
    tableWrap.before(builder);
  }

  function addTechnicalItem() {
    const tickerInput = $("#technicalTickerInput");
    const nameInput = $("#technicalNameInput");
    const categoryInput = $("#technicalCategoryInput");
    const ticker = clean(tickerInput?.value).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
    if (!ticker) {
      tickerInput?.focus();
      setTechnicalStatus("Enter a ticker", "negative");
      return;
    }
    const items = currentItems().map(normalizeItem);
    if (items.some((item) => item.ticker === ticker)) {
      setTechnicalStatus(`${ticker} already tracked`, "neutral");
      return;
    }
    if (items.length >= MAX_TECHNICAL_ITEMS) {
      setTechnicalStatus(`Limit is ${MAX_TECHNICAL_ITEMS} instruments`, "negative");
      return;
    }
    const nextItem = normalizeItem({
      ticker,
      name: clean(nameInput?.value, `${ticker} instrument`),
      category: clean(categoryInput?.value, "Stock"),
    });
    items.push(nextItem);
    syncGlobalItems(items);
    writeItems(items);
    if (tickerInput) tickerInput.value = "";
    if (nameInput) nameInput.value = "";
    renderInteractiveTechnicals();
    refreshSingleTechnical(nextItem, items.length - 1);
  }

  async function refreshSingleTechnical(item, index) {
    const settings = readSavedSettings();
    const ticker = clean(item.ticker).toUpperCase();
    const items = currentItems();
    if (!settings.alphaVantageKey) {
      setTechnicalStatus("Add market-data key", "neutral");
      return false;
    }
    try {
      let updated;
      if (typeof fetchDailySeries === "function" && typeof technicalFromSeries === "function") {
        updated = technicalFromSeries(item, await fetchDailySeries(ticker));
      } else {
        throw new Error("Technical engine unavailable");
      }
      items.splice(index, 1, normalizeItem(updated));
      writeItems(items);
      renderInteractiveTechnicals();
      return true;
    } catch (error) {
      items[index] = normalizeItem({
        ...item,
        trend: item.trend || "Refresh needed",
        macd: item.macd || "Refresh",
        signal: clean(error?.message, "Refresh failed").slice(0, 80),
      });
      syncGlobalItems(items);
      writeItems(items);
      renderInteractiveTechnicals();
      return false;
    }
  }

  async function refreshTechnicalMatrix() {
    const button = $("#refreshTechnicals");
    const items = currentItems().map(normalizeItem);
    if (!items.length) {
      setTechnicalStatus("Add instruments first", "neutral");
      return;
    }
    if (!readSavedSettings().alphaVantageKey) {
      setTechnicalStatus("Add market-data key", "neutral");
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = "Refreshing...";
    }
    setTechnicalStatus("Refreshing technicals", "neutral");
    let updated = 0;
    let failed = 0;
    try {
      for (let index = 0; index < items.length; index += 1) {
        const ok = await refreshSingleTechnical(items[index], index);
        if (ok) updated += 1;
        else failed += 1;
      }
      setTechnicalStatus(failed ? `${updated} live · ${failed} need review` : `${updated} live technicals`, failed ? "neutral" : "positive");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Refresh";
      }
    }
  }

  function bindTechnicalControls() {
    document.addEventListener("click", (event) => {
      const addButton = event.target.closest("#addTechnicalItem");
      const refreshButton = event.target.closest("#refreshTechnicals");
      const removeButton = event.target.closest("[data-remove-technical]");
      if (addButton) addTechnicalItem();
      if (refreshButton) refreshTechnicalMatrix();
      if (removeButton) {
        const index = Number(removeButton.dataset.removeTechnical);
        const items = currentItems().map(normalizeItem);
        if (Number.isInteger(index) && items[index]) {
          items.splice(index, 1);
          syncGlobalItems(items);
          writeItems(items);
          renderInteractiveTechnicals();
        }
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.closest("#technicalBuilder")) {
        event.preventDefault();
        addTechnicalItem();
      }
    });
    $("#refreshMarketData")?.addEventListener("click", () => {
      window.setTimeout(refreshTechnicalMatrix, 900);
    });
    $("#saveMarketDataKey")?.addEventListener("click", () => {
      window.setTimeout(renderInteractiveTechnicals, 100);
    });
  }

  function initTechnicalPatch() {
    const items = loadItems();
    syncGlobalItems(items);
    ensureTechnicalControls();
    try {
      if (typeof renderTechnicals === "function") renderTechnicals = renderInteractiveTechnicals;
    } catch {
      window.renderTechnicals = renderInteractiveTechnicals;
    }
    bindTechnicalControls();
    renderInteractiveTechnicals();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTechnicalPatch);
  else initTechnicalPatch();
})();