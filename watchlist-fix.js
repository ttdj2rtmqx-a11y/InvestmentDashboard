(function () {
  if (window.__investmentDeskWatchlistFixBound) return;
  window.__investmentDeskWatchlistFixBound = true;

  const STORAGE_KEY = "investmentDeskWatchlistV1";
  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
  const MAX_ITEMS = 30;
  const SEARCH_DEBOUNCE_MS = 260;
  const defaults = [
    { ticker: "SPY", name: "S&P 500 ETF", type: "ETF", price: 0, change: 0, signal: "Refresh for live quote", source: "Refresh needed", series: [] },
    { ticker: "AAPL", name: "Apple Inc.", type: "Stock", price: 0, change: 0, signal: "Refresh for live quote", source: "Refresh needed", series: [] },
    { ticker: "BND", name: "Total Bond Market ETF", type: "Bond", price: 0, change: 0, signal: "Refresh for live quote", source: "Refresh needed", series: [] },
    { ticker: "BTC", name: "Bitcoin", type: "Crypto", price: 0, change: 0, signal: "Refresh for live quote", source: "Refresh needed", series: [] },
    { ticker: "GLD", name: "Gold Trust", type: "Commodity", price: 0, change: 0, signal: "Refresh for live quote", source: "Refresh needed", series: [] },
    { ticker: "UUP", name: "US Dollar ETF", type: "Currency", price: 0, change: 0, signal: "Refresh for live quote", source: "Refresh needed", series: [] },
  ];
  const searchUniverse = [
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
    { ticker: "AAPL", name: "Apple Inc.", type: "Stock" },
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
  let searchTimer = null;
  let searchResults = [];
  let highlightedResult = 0;
  const $ = (selector) => document.querySelector(selector);

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pct(value, digits = 1) {
    return `${Number(value || 0).toFixed(digits)}%`;
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }

  function trendClass(value) {
    return Number(value || 0) >= 0 ? "positive" : "negative";
  }

  function normalizeSeries(series) {
    const values = Array.isArray(series) && series.length ? series.map(Number).filter(Number.isFinite) : [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const first = values[0] || 1;
    return values.map((value) => Number(((value / first) * 100).toFixed(2)));
  }

  function normalizeItem(item, index = 0) {
    const fallback = defaults.find((asset) => asset.ticker === item?.ticker) || defaults[index % defaults.length] || {};
    const ticker = String(item?.ticker || fallback.ticker || "").trim().toUpperCase();
    return {
      ticker,
      name: String(item?.name || fallback.name || `${ticker || "New"} watch item`),
      type: String(item?.type || fallback.type || "Stock"),
      price: Number(item?.price ?? fallback.price ?? 0),
      change: Number(item?.change ?? fallback.change ?? 0),
      signal: String(item?.signal || fallback.signal || "Manual watch"),
      source: String(item?.source || fallback.source || "Refresh needed"),
      series: normalizeSeries(item?.series || fallback.series),
    };
  }

  function loadWatchlist() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(saved) || !saved.length) return defaults.map(normalizeItem);
      return saved.slice(0, MAX_ITEMS).map(normalizeItem);
    } catch {
      return defaults.map(normalizeItem);
    }
  }

  function saveWatchlist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function savedApiKey() {
    try {
      return JSON.parse(localStorage.getItem(DATA_SETTINGS_KEY))?.alphaVantageKey || "";
    } catch {
      return "";
    }
  }

  function inferTypeFromSymbol(symbol, name = "") {
    const upperSymbol = String(symbol || "").toUpperCase();
    const lowerName = String(name || "").toLowerCase();
    if (["BTC", "ETH", "SOL", "ADA", "IBIT", "GBTC"].includes(upperSymbol) || lowerName.includes("bitcoin") || lowerName.includes("ethereum")) return "Crypto";
    if (lowerName.includes("bond") || lowerName.includes("treasury") || lowerName.includes("income") || ["BND", "AGG", "TLT", "IEF", "SHY", "LQD", "MUB", "HYG"].includes(upperSymbol)) return "Bond";
    if (lowerName.includes("etf") || lowerName.includes("fund") || lowerName.includes("trust")) return "ETF";
    if (lowerName.includes("gold") || lowerName.includes("silver") || lowerName.includes("oil") || lowerName.includes("commodity")) return "Commodity";
    return "Stock";
  }

  function makePath(points, width, height, padding) {
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

  function renderMiniLine(item) {
    const path = makePath(normalizeSeries(item.series), 140, 32, 4);
    const color = Number(item.change || 0) >= 0 ? "#1f9d63" : "#d94f4f";
    return `<svg class="watch-mini-line" viewBox="0 0 140 32" aria-hidden="true"><path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"></path></svg>`;
  }

  function metrics(item) {
    const series = normalizeSeries(item.series);
    const first = series[0] || 1;
    const last = series.at(-1) || first;
    const high = Math.max(...series);
    return {
      period: ((last / first - 1) * 100) || 0,
      drawdown: ((last / high - 1) * 100) || 0,
    };
  }

  function setStatus(message) {
    const status = $("#watchlistStatus");
    if (status) status.textContent = message;
  }

  function searchContainer() {
    let container = $("#watchSearchResults");
    if (container) return container;
    container = document.createElement("div");
    container.id = "watchSearchResults";
    container.className = "watch-search-results";
    container.setAttribute("role", "listbox");
    container.hidden = true;
    $("#watchTicker")?.closest("label")?.appendChild(container);
    return container;
  }

  function localMatches(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const ranked = searchUniverse
      .map((item) => {
        const ticker = item.ticker.toLowerCase();
        const name = item.name.toLowerCase();
        let score = 0;
        if (ticker === normalized) score += 100;
        if (ticker.startsWith(normalized)) score += 60;
        if (name.startsWith(normalized)) score += 40;
        if (ticker.includes(normalized)) score += 25;
        if (name.includes(normalized)) score += 18;
        return { ...item, score, source: "Local match" };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
    return ranked.slice(0, 8).map(({ score, ...item }) => item);
  }

  async function apiMatches(query) {
    const apiKey = savedApiKey();
    if (!apiKey || query.trim().length < 2) return [];
    const url = new URL(ALPHA_VANTAGE_URL);
    url.searchParams.set("function", "SYMBOL_SEARCH");
    url.searchParams.set("keywords", query.trim());
    url.searchParams.set("apikey", apiKey);

    try {
      const response = await fetch(url);
      const payload = await response.json();
      return (payload.bestMatches || [])
        .slice(0, 6)
        .map((match) => {
          const ticker = String(match["1. symbol"] || "").toUpperCase();
          const name = String(match["2. name"] || ticker);
          return {
            ticker,
            name,
            type: inferTypeFromSymbol(ticker, name),
            source: "Alpha Vantage search",
          };
        })
        .filter((item) => item.ticker);
    } catch {
      return [];
    }
  }

  function mergeMatches(primary, secondary) {
    const seen = new Set();
    return [...primary, ...secondary]
      .filter((item) => {
        const key = item.ticker.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }

  function renderSearchResults(results, query) {
    const container = searchContainer();
    searchResults = results;

    if (!query.trim()) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    if (!results.length) {
      container.hidden = false;
      container.innerHTML = `<div class="watch-search-empty">No matches yet. You can still add ${escapeHTML(query.toUpperCase())} manually.</div>`;
      return;
    }

    container.hidden = false;
    container.innerHTML = results
      .map((item, index) => `
        <button class="watch-search-option ${index === highlightedResult ? "active" : ""}" type="button" data-search-index="${index}" role="option" aria-selected="${index === highlightedResult}">
          <strong>${escapeHTML(item.ticker)}</strong>
          <span>${escapeHTML(item.name)}</span>
          <em>${escapeHTML(item.type)}</em>
        </button>
      `)
      .join("");
  }

  function applySearchResult(item) {
    if (!item) return;
    $("#watchTicker").value = item.ticker;
    $("#watchName").value = item.name;
    $("#watchType").value = item.type;
    searchContainer().hidden = true;
    setStatus(`${item.ticker} selected`);
    $("#addWatchItem").focus();
  }

  async function updateSearchResults() {
    const query = $("#watchTicker")?.value || "";
    const local = localMatches(query);
    highlightedResult = 0;
    renderSearchResults(local, query);
    const remote = await apiMatches(query);
    if ($("#watchTicker")?.value !== query) return;
    highlightedResult = 0;
    renderSearchResults(mergeMatches(local, remote), query);
  }

  function queueSearchResults() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(updateSearchResults, SEARCH_DEBOUNCE_MS);
  }

  function renderPerformance() {
    const item = state.find((asset) => asset.ticker === selectedTicker) || state[0];
    if (!item || !$("#watchPerformanceChart")) return;
    const series = normalizeSeries(item.series);
    const watchMetrics = metrics(item);
    const width = 520;
    const height = 220;
    const padding = 26;
    const path = makePath(series, width, height, padding);
    const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
    const color = Number(item.change || 0) >= 0 ? "#1f9d63" : "#d94f4f";
    const gridlines = [0, 1, 2, 3]
      .map((index) => {
        const y = padding + index * ((height - padding * 2) / 3);
        return `<line class="gridline" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
      })
      .join("");

    $("#watchSelectedType").textContent = item.type;
    $("#watchSelectedTicker").textContent = item.ticker;
    $("#watchSelectedName").textContent = item.name;
    $("#watchSelectedChange").textContent = `${item.change >= 0 ? "+" : ""}${pct(item.change)}`;
    $("#watchSelectedChange").className = trendClass(item.change);
    $("#watchLastPrice").textContent = money(item.price);
    $("#watchPeriodReturn").textContent = `${watchMetrics.period >= 0 ? "+" : ""}${pct(watchMetrics.period)}`;
    $("#watchPeriodReturn").className = trendClass(watchMetrics.period);
    $("#watchDrawdown").textContent = pct(watchMetrics.drawdown);
    $("#watchSource").textContent = item.source;
    $("#watchPerformanceChart").innerHTML = `
      ${gridlines}
      <path d="${areaPath}" fill="${color}18"></path>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"></path>
      <circle cx="${width - padding}" cy="${padding}" r="5" fill="${color}"></circle>
    `;
  }

  function renderWatchlist() {
    if (!$("#watchlistCards")) return;
    if (!state.length) state = defaults.map(normalizeItem);
    if (!state.some((item) => item.ticker === selectedTicker)) selectedTicker = state[0]?.ticker || "";
    $("#watchlistCards").innerHTML = state
      .map((item) => {
        const selected = item.ticker === selectedTicker;
        return `
          <button class="watch-card ${selected ? "active" : ""}" data-watch-ticker="${item.ticker}" type="button" aria-pressed="${selected}">
            <div class="watch-card-top">
              <div>
                <span class="watch-card-type">${item.type}</span>
                <strong>${item.ticker}</strong>
                <small>${escapeHTML(item.name)}</small>
              </div>
              <span class="signal-pill ${trendClass(item.change)}">${item.change >= 0 ? "+" : ""}${pct(item.change)}</span>
            </div>
            ${renderMiniLine(item)}
            <div class="watch-card-bottom">
              <span>${escapeHTML(item.signal)}</span>
              <b>${money(item.price)}</b>
            </div>
            <span class="watch-remove" data-remove-watch="${item.ticker}" role="button" aria-label="Remove ${item.ticker}" title="Remove ${item.ticker}">×</span>
          </button>
        `;
      })
      .join("");

    const isFull = state.length >= MAX_ITEMS;
    $("#addWatchItem").disabled = isFull;
    $("#watchTicker").disabled = isFull;
    $("#watchName").disabled = isFull;
    $("#watchType").disabled = isFull;
    setStatus(`${state.length} watched assets`);
    renderPerformance();
  }

  function addWatchItem() {
    const tickerInput = $("#watchTicker");
    const nameInput = $("#watchName");
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) {
      setStatus("Enter a ticker");
      tickerInput.focus();
      return;
    }
    if (state.length >= MAX_ITEMS) {
      setStatus("Watchlist full");
      return;
    }
    const existing = state.find((item) => item.ticker === ticker);
    if (existing) {
      selectedTicker = existing.ticker;
      renderWatchlist();
      setStatus(`${ticker} already watched`);
      return;
    }

    state.unshift(normalizeItem({
      ticker,
      name: nameInput.value.trim() || `${ticker} watch item`,
      type: $("#watchType").value,
      price: 0,
      change: 0,
      signal: "Refresh for live quote",
      source: "Refresh needed",
      series: [],
    }));
    selectedTicker = ticker;
    saveWatchlist();
    tickerInput.value = "";
    nameInput.value = "";
    searchContainer().hidden = true;
    renderWatchlist();
    setStatus(`${ticker} added`);
  }

  function removeWatchItem(ticker) {
    state = state.filter((item) => item.ticker !== ticker);
    selectedTicker = state[0]?.ticker || "";
    saveWatchlist();
    renderWatchlist();
    setStatus(`${ticker} removed`);
  }

  function bind() {
    $("#addWatchItem")?.addEventListener("click", addWatchItem);
    $("#watchTicker")?.addEventListener("input", queueSearchResults);
    $("#watchTicker")?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && searchResults.length) {
        event.preventDefault();
        highlightedResult = Math.min(searchResults.length - 1, highlightedResult + 1);
        renderSearchResults(searchResults, $("#watchTicker").value);
      }
      if (event.key === "ArrowUp" && searchResults.length) {
        event.preventDefault();
        highlightedResult = Math.max(0, highlightedResult - 1);
        renderSearchResults(searchResults, $("#watchTicker").value);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (!searchContainer().hidden && searchResults[highlightedResult]) applySearchResult(searchResults[highlightedResult]);
        else addWatchItem();
      }
      if (event.key === "Escape") searchContainer().hidden = true;
    });
    $("#watchName")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addWatchItem();
    });
    searchContainer().addEventListener("mousedown", (event) => {
      const option = event.target.closest("[data-search-index]");
      if (!option) return;
      event.preventDefault();
      applySearchResult(searchResults[Number(option.dataset.searchIndex)]);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#watchSearchResults") && event.target !== $("#watchTicker")) searchContainer().hidden = true;
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
    window.__investmentDeskWatchlistFixBound = true;
  }

  function init() {
    if (!$("#watchlistCards")) return;
    if (document.querySelector("#watchlistCards [data-watch-ticker]")) return;
    renderWatchlist();
    bind();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
