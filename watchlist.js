(function () {
  if (window.__investmentDeskWatchlistSearchBound) return;

  const STORAGE_KEY = "investmentDeskWatchlistV1";
  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
  const MAX_ITEMS = 30;
  const SEARCH_DELAY = 260;

  const defaults = [
    { ticker: "SPY", name: "S&P 500 ETF", type: "ETF", price: 548.21, change: 0.8, signal: "Large-cap trend", source: "Sample", series: [100, 101.1, 100.6, 102.4, 103.1, 102.8, 104.2, 105.7, 106.8, 106.4, 108.2, 109.1] },
    { ticker: "AAPL", name: "Apple Inc.", type: "Stock", price: 228.51, change: 0.8, signal: "Quality momentum", source: "Sample", series: [100, 99.4, 100.8, 102.6, 101.9, 103.7, 105.2, 106.1, 105.5, 107.6, 109.2, 110.8] },
    { ticker: "BND", name: "Total Bond Market ETF", type: "Bond", price: 73.06, change: 0.2, signal: "Duration stabilizer", source: "Sample", series: [100, 99.8, 100.1, 100.4, 100.2, 100.7, 101.0, 100.8, 101.2, 101.5, 101.4, 101.8] },
    { ticker: "BTC", name: "Bitcoin", type: "Crypto", price: 64010, change: 2.1, signal: "High beta risk", source: "Sample", series: [100, 103.4, 101.2, 106.8, 110.1, 108.2, 113.6, 118.9, 116.4, 121.7, 126.3, 124.8] },
    { ticker: "GLD", name: "Gold Trust", type: "Commodity", price: 261.46, change: 0.9, signal: "Macro hedge", source: "Sample", series: [100, 100.6, 101.8, 101.2, 103.4, 104.6, 103.9, 105.2, 106.7, 108.3, 107.8, 109.5] },
    { ticker: "UUP", name: "US Dollar ETF", type: "Currency", price: 28.34, change: -0.1, signal: "Dollar watch", source: "Sample", series: [100, 100.4, 100.1, 100.8, 101.1, 100.9, 101.5, 101.2, 101.8, 101.6, 101.3, 101.0] },
  ];

  const universe = [
    ...defaults,
    { ticker: "QQQ", name: "Invesco Nasdaq 100 ETF", type: "ETF" },
    { ticker: "IWM", name: "iShares Russell 2000 ETF", type: "ETF" },
    { ticker: "DIA", name: "SPDR Dow Jones Industrial Average ETF", type: "ETF" },
    { ticker: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF" },
    { ticker: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF" },
    { ticker: "IVV", name: "iShares Core S&P 500 ETF", type: "ETF" },
    { ticker: "VEA", name: "Vanguard Developed Markets ETF", type: "ETF" },
    { ticker: "VWO", name: "Vanguard Emerging Markets ETF", type: "ETF" },
    { ticker: "EFA", name: "iShares MSCI EAFE ETF", type: "ETF" },
    { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", type: "ETF" },
    { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF" },
    { ticker: "VYM", name: "Vanguard High Dividend Yield ETF", type: "ETF" },
    { ticker: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", type: "Bond" },
    { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", type: "Bond" },
    { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", type: "Bond" },
    { ticker: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", type: "Bond" },
    { ticker: "LQD", name: "iShares Investment Grade Corporate Bond ETF", type: "Bond" },
    { ticker: "MUB", name: "iShares National Muni Bond ETF", type: "Bond" },
    { ticker: "HYG", name: "iShares High Yield Corporate Bond ETF", type: "Bond" },
    { ticker: "XLF", name: "Financial Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLK", name: "Technology Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLE", name: "Energy Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLV", name: "Health Care Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLP", name: "Consumer Staples Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLU", name: "Utilities Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLI", name: "Industrial Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLB", name: "Materials Select Sector SPDR Fund", type: "ETF" },
    { ticker: "XLRE", name: "Real Estate Select Sector SPDR Fund", type: "ETF" },
    { ticker: "USO", name: "United States Oil Fund", type: "Commodity" },
    { ticker: "SLV", name: "iShares Silver Trust", type: "Commodity" },
    { ticker: "DBC", name: "Invesco DB Commodity Index Tracking Fund", type: "Commodity" },
    { ticker: "MSFT", name: "Microsoft Corp.", type: "Stock" },
    { ticker: "NVDA", name: "NVIDIA Corp.", type: "Stock" },
    { ticker: "AMZN", name: "Amazon.com Inc.", type: "Stock" },
    { ticker: "GOOGL", name: "Alphabet Inc. Class A", type: "Stock" },
    { ticker: "META", name: "Meta Platforms Inc.", type: "Stock" },
    { ticker: "TSLA", name: "Tesla Inc.", type: "Stock" },
    { ticker: "BRK.B", name: "Berkshire Hathaway Inc. Class B", type: "Stock" },
    { ticker: "JPM", name: "JPMorgan Chase & Co.", type: "Stock" },
    { ticker: "V", name: "Visa Inc.", type: "Stock" },
    { ticker: "MA", name: "Mastercard Inc.", type: "Stock" },
    { ticker: "UNH", name: "UnitedHealth Group Inc.", type: "Stock" },
    { ticker: "LLY", name: "Eli Lilly and Co.", type: "Stock" },
    { ticker: "AVGO", name: "Broadcom Inc.", type: "Stock" },
    { ticker: "COST", name: "Costco Wholesale Corp.", type: "Stock" },
    { ticker: "NFLX", name: "Netflix Inc.", type: "Stock" },
    { ticker: "AMD", name: "Advanced Micro Devices Inc.", type: "Stock" },
    { ticker: "ORCL", name: "Oracle Corp.", type: "Stock" },
    { ticker: "KO", name: "Coca-Cola Co.", type: "Stock" },
    { ticker: "PEP", name: "PepsiCo Inc.", type: "Stock" },
    { ticker: "WMT", name: "Walmart Inc.", type: "Stock" },
    { ticker: "PG", name: "Procter & Gamble Co.", type: "Stock" },
    { ticker: "HD", name: "Home Depot Inc.", type: "Stock" },
    { ticker: "BAC", name: "Bank of America Corp.", type: "Stock" },
    { ticker: "XOM", name: "Exxon Mobil Corp.", type: "Stock" },
    { ticker: "CVX", name: "Chevron Corp.", type: "Stock" },
    { ticker: "ETH", name: "Ethereum", type: "Crypto" },
    { ticker: "SOL", name: "Solana", type: "Crypto" },
    { ticker: "ADA", name: "Cardano", type: "Crypto" },
    { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", type: "Crypto" },
    { ticker: "GBTC", name: "Grayscale Bitcoin Trust ETF", type: "Crypto" },
  ];

  let state = loadWatchlist();
  let selectedTicker = state[0]?.ticker || "";
  let timer = null;
  let results = [];
  let activeIndex = 0;
  const $ = (selector) => document.querySelector(selector);

  function escapeHTML(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function pct(value, digits = 1) {
    return `${Number(value || 0).toFixed(digits)}%`;
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }

  function normalizeSeries(series) {
    const values = Array.isArray(series) && series.length ? series.map(Number).filter(Number.isFinite) : [100, 101, 100.5, 102, 103, 102.5, 104, 105, 104.6, 106, 107, 106.7];
    const first = values[0] || 1;
    return values.map((value) => Number(((value / first) * 100).toFixed(2)));
  }

  function normalizeItem(item, index = 0) {
    const fallback = defaults.find((asset) => asset.ticker === item?.ticker) || universe.find((asset) => asset.ticker === item?.ticker) || defaults[index % defaults.length] || {};
    const ticker = String(item?.ticker || fallback.ticker || "").trim().toUpperCase();
    return {
      ticker,
      name: String(item?.name || fallback.name || `${ticker || "New"} watch item`),
      type: String(item?.type || fallback.type || "Stock"),
      price: Number(item?.price ?? fallback.price ?? 100),
      change: Number(item?.change ?? fallback.change ?? 0),
      signal: String(item?.signal || fallback.signal || "Manual watch"),
      source: String(item?.source || fallback.source || "Manual"),
      series: normalizeSeries(item?.series || fallback.series),
    };
  }

  function loadWatchlist() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(saved) || !saved.length) return defaults.map(normalizeItem);
      return saved.slice(0, MAX_ITEMS).map(normalizeItem).filter((item) => item.ticker);
    } catch {
      return defaults.map(normalizeItem);
    }
  }

  function saveWatchlist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function status(message) {
    if ($("#watchlistStatus")) $("#watchlistStatus").textContent = message;
  }

  function trendClass(value) {
    return Number(value || 0) >= 0 ? "positive" : "negative";
  }

  function makePath(points, width, height, padding) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points.map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
      const y = height - padding - ((point - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  function inferType(symbol, name = "") {
    const ticker = String(symbol || "").toUpperCase();
    const text = String(name || "").toLowerCase();
    if (["BTC", "ETH", "SOL", "ADA", "IBIT", "GBTC"].includes(ticker) || text.includes("bitcoin") || text.includes("ethereum")) return "Crypto";
    if (text.includes("bond") || text.includes("treasury") || text.includes("income")) return "Bond";
    if (text.includes("etf") || text.includes("fund") || text.includes("trust")) return "ETF";
    if (text.includes("gold") || text.includes("silver") || text.includes("oil") || text.includes("commodity")) return "Commodity";
    return "Stock";
  }

  function savedApiKey() {
    try {
      return JSON.parse(localStorage.getItem(DATA_SETTINGS_KEY))?.alphaVantageKey || "";
    } catch {
      return "";
    }
  }

  function searchBox() {
    let box = $("#watchSearchResults");
    if (box) return box;
    box = document.createElement("div");
    box.id = "watchSearchResults";
    box.className = "watch-search-results";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    $("#watchTicker")?.closest("label")?.appendChild(box);
    return box;
  }

  function localMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return universe.map((item) => {
      const ticker = item.ticker.toLowerCase();
      const name = item.name.toLowerCase();
      let score = 0;
      if (ticker === q) score += 100;
      if (ticker.startsWith(q)) score += 65;
      if (name.startsWith(q)) score += 45;
      if (ticker.includes(q)) score += 28;
      if (name.includes(q)) score += 20;
      return { ...item, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker)).slice(0, 8).map(({ score, ...item }) => item);
  }

  async function apiMatches(query) {
    const key = savedApiKey();
    if (!key || query.trim().length < 2) return [];
    const url = new URL(ALPHA_VANTAGE_URL);
    url.searchParams.set("function", "SYMBOL_SEARCH");
    url.searchParams.set("keywords", query.trim());
    url.searchParams.set("apikey", key);
    try {
      const response = await fetch(url);
      const payload = await response.json();
      return (payload.bestMatches || []).slice(0, 6).map((match) => {
        const ticker = String(match["1. symbol"] || "").toUpperCase();
        const name = String(match["2. name"] || ticker);
        return { ticker, name, type: inferType(ticker, name) };
      }).filter((item) => item.ticker);
    } catch {
      return [];
    }
  }

  function mergeMatches(a, b) {
    const seen = new Set();
    return [...a, ...b].filter((item) => {
      const key = item.ticker.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }

  function renderSearch(items, query) {
    const box = searchBox();
    results = items;
    if (!query.trim()) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    if (!items.length) {
      box.hidden = false;
      box.innerHTML = `<div class="watch-search-empty">No matches yet. You can still add ${escapeHTML(query.toUpperCase())} manually.</div>`;
      return;
    }
    box.hidden = false;
    box.innerHTML = items.map((item, index) => `
      <button class="watch-search-option ${index === activeIndex ? "active" : ""}" type="button" data-search-index="${index}" role="option" aria-selected="${index === activeIndex}">
        <strong>${escapeHTML(item.ticker)}</strong>
        <span>${escapeHTML(item.name)}</span>
        <em>${escapeHTML(item.type)}</em>
      </button>
    `).join("");
  }

  async function updateSearch() {
    const query = $("#watchTicker")?.value || "";
    activeIndex = 0;
    const local = localMatches(query);
    renderSearch(local, query);
    const remote = await apiMatches(query);
    if (($("#watchTicker")?.value || "") !== query) return;
    activeIndex = 0;
    renderSearch(mergeMatches(local, remote), query);
  }

  function queueSearch() {
    window.clearTimeout(timer);
    timer = window.setTimeout(updateSearch, SEARCH_DELAY);
  }

  function applyResult(item) {
    if (!item) return;
    $("#watchTicker").value = item.ticker;
    $("#watchName").value = item.name;
    $("#watchType").value = item.type;
    searchBox().hidden = true;
    status(`${item.ticker} selected`);
    $("#addWatchItem").focus();
  }

  function injectStyles() {
    if ($("#watchSearchStyles")) return;
    const style = document.createElement("style");
    style.id = "watchSearchStyles";
    style.textContent = `
      .watchlist-controls label{position:relative}.watch-search-results{width:min(420px,86vw);max-height:280px;overflow:auto;padding:6px;display:grid;gap:4px;position:absolute;z-index:20;top:calc(100% + 8px);left:0;border:1px solid rgba(10,132,255,.18);border-radius:14px;background:rgba(255,255,255,.97);box-shadow:0 18px 45px rgba(31,38,46,.14);backdrop-filter:blur(18px)}.watch-search-results[hidden]{display:none}.watch-search-option{min-height:48px;padding:9px 10px;display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:10px;border:0;border-radius:10px;background:transparent;color:var(--ink);text-align:left}.watch-search-option:hover,.watch-search-option.active{background:rgba(10,132,255,.1)}.watch-search-option strong{font-size:.88rem}.watch-search-option span{overflow:hidden;color:var(--ink);text-overflow:ellipsis;text-transform:none;white-space:nowrap}.watch-search-option em,.watch-search-empty{color:var(--muted);font-size:.74rem;font-style:normal;font-weight:800;text-transform:uppercase}.watch-search-empty{padding:12px;line-height:1.45;text-transform:none}.watch-card{position:relative}.watch-remove{width:24px;height:24px;display:grid;place-items:center;position:absolute;top:8px;right:8px;border:1px solid transparent;border-radius:999px;color:var(--muted);font-size:1.1rem;font-weight:800;line-height:1;opacity:0;transition:background 160ms ease,border-color 160ms ease,color 160ms ease,opacity 160ms ease}.watch-card:hover .watch-remove,.watch-card.active .watch-remove,.watch-remove:focus-visible{opacity:1}.watch-remove:hover{border-color:rgba(217,79,79,.2);background:#f8ecec;color:var(--red)}
    `;
    document.head.appendChild(style);
  }

  function miniLine(item) {
    const path = makePath(normalizeSeries(item.series), 140, 32, 4);
    const color = Number(item.change || 0) >= 0 ? "#1f9d63" : "#d94f4f";
    return `<svg class="watch-mini-line" viewBox="0 0 140 32" aria-hidden="true"><path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"></path></svg>`;
  }

  function metrics(item) {
    const series = normalizeSeries(item.series);
    const first = series[0] || 1;
    const last = series.at(-1) || first;
    const high = Math.max(...series);
    return { period: ((last / first - 1) * 100) || 0, drawdown: ((last / high - 1) * 100) || 0 };
  }

  function renderPerformance() {
    const item = state.find((asset) => asset.ticker === selectedTicker) || state[0];
    if (!item || !$("#watchPerformanceChart")) return;
    const series = normalizeSeries(item.series);
    const m = metrics(item);
    const width = 520;
    const height = 220;
    const padding = 26;
    const path = makePath(series, width, height, padding);
    const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
    const color = Number(item.change || 0) >= 0 ? "#1f9d63" : "#d94f4f";
    const gridlines = [0, 1, 2, 3].map((index) => {
      const y = padding + index * ((height - padding * 2) / 3);
      return `<line class="gridline" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
    }).join("");
    $("#watchSelectedType").textContent = item.type;
    $("#watchSelectedTicker").textContent = item.ticker;
    $("#watchSelectedName").textContent = item.name;
    $("#watchSelectedChange").textContent = `${item.change >= 0 ? "+" : ""}${pct(item.change)}`;
    $("#watchSelectedChange").className = trendClass(item.change);
    $("#watchLastPrice").textContent = money(item.price);
    $("#watchPeriodReturn").textContent = `${m.period >= 0 ? "+" : ""}${pct(m.period)}`;
    $("#watchPeriodReturn").className = trendClass(m.period);
    $("#watchDrawdown").textContent = pct(m.drawdown);
    $("#watchSource").textContent = item.source;
    $("#watchPerformanceChart").innerHTML = `${gridlines}<path d="${areaPath}" fill="${color}18"></path><path d="${path}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"></path><circle cx="${width - padding}" cy="${padding}" r="5" fill="${color}"></circle>`;
  }

  function renderWatchlist(message) {
    if (!$("#watchlistCards")) return;
    if (!state.length) state = defaults.map(normalizeItem);
    if (!state.some((item) => item.ticker === selectedTicker)) selectedTicker = state[0]?.ticker || "";
    $("#watchlistCards").innerHTML = state.map((item) => {
      const selected = item.ticker === selectedTicker;
      return `<button class="watch-card ${selected ? "active" : ""}" data-watch-ticker="${item.ticker}" type="button" aria-pressed="${selected}"><div class="watch-card-top"><div><span class="watch-card-type">${escapeHTML(item.type)}</span><strong>${escapeHTML(item.ticker)}</strong><small>${escapeHTML(item.name)}</small></div><span class="signal-pill ${trendClass(item.change)}">${item.change >= 0 ? "+" : ""}${pct(item.change)}</span></div>${miniLine(item)}<div class="watch-card-bottom"><span>${escapeHTML(item.signal)}</span><b>${money(item.price)}</b></div><span class="watch-remove" data-remove-watch="${escapeHTML(item.ticker)}" role="button" aria-label="Remove ${escapeHTML(item.ticker)}" title="Remove ${escapeHTML(item.ticker)}">×</span></button>`;
    }).join("");
    const full = state.length >= MAX_ITEMS;
    $("#addWatchItem").disabled = full;
    $("#watchTicker").disabled = full;
    $("#watchName").disabled = full;
    $("#watchType").disabled = full;
    status(message || `${state.length} watched assets`);
    renderPerformance();
  }

  function addWatchItem() {
    const tickerInput = $("#watchTicker");
    const nameInput = $("#watchName");
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) {
      status("Enter a ticker");
      tickerInput.focus();
      return;
    }
    if (state.length >= MAX_ITEMS) {
      status("Watchlist full");
      return;
    }
    const existing = state.find((item) => item.ticker === ticker);
    if (existing) {
      selectedTicker = existing.ticker;
      renderWatchlist(`${ticker} already watched`);
      return;
    }
    const seed = ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const series = Array.from({ length: 12 }, (_, index) => 100 + Math.sin((index + seed) / 2) * 2.6 + index * ((seed % 7) - 2) * 0.18);
    state.unshift(normalizeItem({ ticker, name: nameInput.value.trim() || `${ticker} watch item`, type: $("#watchType").value, price: 100 + (seed % 180), change: ((seed % 60) - 24) / 10, signal: "Manual watch", source: "Manual", series }));
    selectedTicker = ticker;
    saveWatchlist();
    tickerInput.value = "";
    nameInput.value = "";
    searchBox().hidden = true;
    renderWatchlist(`${ticker} added`);
  }

  function removeWatchItem(ticker) {
    state = state.filter((item) => item.ticker !== ticker);
    if (!state.length) state = defaults.map(normalizeItem);
    selectedTicker = state[0].ticker;
    saveWatchlist();
    renderWatchlist(`${ticker} removed`);
  }

  function bind() {
    $("#addWatchItem")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      addWatchItem();
    }, true);
    $("#watchTicker")?.addEventListener("input", queueSearch);
    $("#watchTicker")?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && results.length) {
        event.preventDefault();
        activeIndex = Math.min(results.length - 1, activeIndex + 1);
        renderSearch(results, $("#watchTicker").value);
      }
      if (event.key === "ArrowUp" && results.length) {
        event.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        renderSearch(results, $("#watchTicker").value);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (!searchBox().hidden && results[activeIndex]) applyResult(results[activeIndex]);
        else addWatchItem();
      }
      if (event.key === "Escape") searchBox().hidden = true;
    });
    $("#watchName")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addWatchItem();
    });
    searchBox().addEventListener("mousedown", (event) => {
      const option = event.target.closest("[data-search-index]");
      if (!option) return;
      event.preventDefault();
      applyResult(results[Number(option.dataset.searchIndex)]);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#watchSearchResults") && event.target !== $("#watchTicker")) searchBox().hidden = true;
    });
    $("#watchlistCards")?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-watch]");
      if (remove) {
        event.preventDefault();
        event.stopPropagation();
        removeWatchItem(remove.dataset.removeWatch);
        return;
      }
      const card = event.target.closest("[data-watch-ticker]");
      if (!card) return;
      selectedTicker = card.dataset.watchTicker;
      renderWatchlist();
    });
  }

  function init() {
    if (!$("#watchlistCards")) return;
    window.__investmentDeskWatchlistSearchBound = true;
    injectStyles();
    renderWatchlist();
    bind();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
