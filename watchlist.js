(function () {
  const WATCHLIST_STORAGE_KEY = "investmentDeskWatchlistV1";
  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
  const COINGECKO_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
  const MAX_WATCHLIST_ITEMS = 30;

  const defaultWatchlist = [
    { ticker: "SPY", name: "S&P 500 ETF", type: "ETF", price: 548.21, change: 0.8, signal: "Large-cap trend", source: "Sample", series: [100, 101.1, 100.6, 102.4, 103.1, 102.8, 104.2, 105.7, 106.8, 106.4, 108.2, 109.1] },
    { ticker: "AAPL", name: "Apple Inc.", type: "Stock", price: 228.51, change: 0.8, signal: "Quality momentum", source: "Sample", series: [100, 99.4, 100.8, 102.6, 101.9, 103.7, 105.2, 106.1, 105.5, 107.6, 109.2, 110.8] },
    { ticker: "BND", name: "Total Bond Market ETF", type: "Bond", price: 73.06, change: 0.2, signal: "Duration stabilizer", source: "Sample", series: [100, 99.8, 100.1, 100.4, 100.2, 100.7, 101.0, 100.8, 101.2, 101.5, 101.4, 101.8] },
    { ticker: "BTC", name: "Bitcoin", type: "Crypto", price: 64010, change: 2.1, signal: "High beta risk", source: "Sample", series: [100, 103.4, 101.2, 106.8, 110.1, 108.2, 113.6, 118.9, 116.4, 121.7, 126.3, 124.8] },
    { ticker: "GLD", name: "Gold Trust", type: "Commodity", price: 261.46, change: 0.9, signal: "Macro hedge", source: "Sample", series: [100, 100.6, 101.8, 101.2, 103.4, 104.6, 103.9, 105.2, 106.7, 108.3, 107.8, 109.5] },
    { ticker: "UUP", name: "US Dollar ETF", type: "Currency", price: 28.34, change: -0.1, signal: "Dollar watch", source: "Sample", series: [100, 100.4, 100.1, 100.8, 101.1, 100.9, 101.5, 101.2, 101.8, 101.6, 101.3, 101.0] },
  ];

  let watchlistState = loadWatchlist();
  let selectedTicker = watchlistState[0]?.ticker || "";

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

  function priceMoney(value) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }

  function trendClass(value) {
    return Number(value || 0) >= 0 ? "positive" : "negative";
  }

  function normalizeSeries(series) {
    const values = Array.isArray(series) && series.length ? series.map(Number).filter(Number.isFinite) : [100, 101, 100.5, 102, 103, 102.5, 104, 105, 104.6, 106, 107, 106.7];
    const first = values[0] || 1;
    return values.map((value) => Number(((value / first) * 100).toFixed(2)));
  }

  function normalizeWatchItem(item, index = 0) {
    const fallback = defaultWatchlist.find((asset) => asset.ticker === item?.ticker) || defaultWatchlist[index % defaultWatchlist.length] || {};
    const ticker = String(item?.ticker || fallback.ticker || "").trim().toUpperCase();
    return {
      ticker,
      name: String(item?.name || fallback.name || `${ticker || "New"} watch item`),
      type: String(item?.type || fallback.type || "Stock"),
      price: Number(item?.price ?? fallback.price ?? 0),
      change: Number(item?.change ?? fallback.change ?? 0),
      signal: String(item?.signal || fallback.signal || "Manual watch"),
      source: String(item?.source || fallback.source || "Manual"),
      series: normalizeSeries(item?.series || fallback.series),
    };
  }

  function loadWatchlist() {
    try {
      const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY));
      if (!Array.isArray(saved) || !saved.length) return defaultWatchlist.map(normalizeWatchItem);
      return saved.slice(0, MAX_WATCHLIST_ITEMS).map(normalizeWatchItem).filter((item) => item.ticker);
    } catch {
      return defaultWatchlist.map(normalizeWatchItem);
    }
  }

  function saveWatchlist() {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistState));
  }

  function setStatus(message) {
    const status = $("#watchlistStatus");
    if (status) status.textContent = message;
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

  function watchMetrics(item) {
    const series = normalizeSeries(item.series);
    const first = series[0] || 1;
    const last = series.at(-1) || first;
    const high = Math.max(...series);
    return {
      period: ((last / first - 1) * 100) || 0,
      drawdown: ((last / high - 1) * 100) || 0,
    };
  }

  function renderMiniLine(item) {
    const path = makePath(normalizeSeries(item.series), 140, 32, 4);
    const color = Number(item.change || 0) >= 0 ? "#1f9d63" : "#d94f4f";
    return `<svg class="watch-mini-line" viewBox="0 0 140 32" aria-hidden="true"><path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"></path></svg>`;
  }

  function renderWatchlist(message) {
    if (!$("#watchlistCards")) return;
    if (!watchlistState.length) {
      watchlistState = defaultWatchlist.map(normalizeWatchItem);
      selectedTicker = watchlistState[0].ticker;
      saveWatchlist();
    }
    if (!watchlistState.some((item) => item.ticker === selectedTicker)) selectedTicker = watchlistState[0]?.ticker || "";

    $("#watchlistCards").innerHTML = watchlistState
      .map((item) => {
        const selected = item.ticker === selectedTicker;
        return `
          <button class="watch-card ${selected ? "active" : ""}" data-watch-ticker="${item.ticker}" type="button" aria-pressed="${selected}">
            <div class="watch-card-top">
              <div>
                <span class="watch-card-type">${escapeHTML(item.type)}</span>
                <strong>${escapeHTML(item.ticker)}</strong>
                <small>${escapeHTML(item.name)}</small>
              </div>
              <span class="signal-pill ${trendClass(item.change)}">${item.change >= 0 ? "+" : ""}${pct(item.change)}</span>
            </div>
            ${renderMiniLine(item)}
            <div class="watch-card-bottom">
              <span>${escapeHTML(item.signal)}</span>
              <b>${priceMoney(item.price)}</b>
            </div>
            <span class="watch-remove" data-remove-watch="${item.ticker}" role="button" aria-label="Remove ${item.ticker}" title="Remove ${item.ticker}">×</span>
          </button>
        `;
      })
      .join("");

    const isFull = watchlistState.length >= MAX_WATCHLIST_ITEMS;
    $("#addWatchItem").disabled = isFull;
    $("#watchTicker").disabled = isFull;
    $("#watchName").disabled = isFull;
    $("#watchType").disabled = isFull;
    setStatus(message || `${watchlistState.length} watched assets`);
    renderWatchPerformance();
  }

  function renderWatchPerformance() {
    const item = watchlistState.find((asset) => asset.ticker === selectedTicker) || watchlistState[0];
    if (!item || !$("#watchPerformanceChart")) return;
    const series = normalizeSeries(item.series);
    const metrics = watchMetrics(item);
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
    $("#watchLastPrice").textContent = priceMoney(item.price);
    $("#watchPeriodReturn").textContent = `${metrics.period >= 0 ? "+" : ""}${pct(metrics.period)}`;
    $("#watchPeriodReturn").className = trendClass(metrics.period);
    $("#watchDrawdown").textContent = pct(metrics.drawdown);
    $("#watchSource").textContent = item.source;
    $("#watchPerformanceChart").innerHTML = `
      ${gridlines}
      <path d="${areaPath}" fill="${color}18"></path>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"></path>
      <circle cx="${width - padding}" cy="${padding}" r="5" fill="${color}"></circle>
    `;
  }

  function createWatchItem() {
    const tickerInput = $("#watchTicker");
    const nameInput = $("#watchName");
    const typeInput = $("#watchType");
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) {
      setStatus("Enter a ticker");
      tickerInput.focus();
      return;
    }
    if (watchlistState.length >= MAX_WATCHLIST_ITEMS) {
      setStatus("Watchlist full");
      return;
    }
    const existing = watchlistState.find((item) => item.ticker === ticker);
    if (existing) {
      selectedTicker = existing.ticker;
      renderWatchlist(`${ticker} already watched`);
      return;
    }

    const seed = ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const series = Array.from({ length: 12 }, (_, index) => 100 + Math.sin((index + seed) / 2) * 2.6 + index * ((seed % 7) - 2) * 0.18);
    const item = normalizeWatchItem({
      ticker,
      name: nameInput.value.trim() || `${ticker} watch item`,
      type: typeInput.value,
      price: 100 + (seed % 180),
      change: ((seed % 60) - 24) / 10,
      signal: "Manual watch",
      source: "Manual",
      series,
    });
    watchlistState.unshift(item);
    selectedTicker = item.ticker;
    saveWatchlist();
    tickerInput.value = "";
    nameInput.value = "";
    renderWatchlist(`${ticker} added`);
  }

  function removeWatchItem(ticker) {
    watchlistState = watchlistState.filter((item) => item.ticker !== ticker);
    if (!watchlistState.length) watchlistState = defaultWatchlist.map(normalizeWatchItem);
    selectedTicker = watchlistState[0].ticker;
    saveWatchlist();
    renderWatchlist(`${ticker} removed`);
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

  async function fetchAlphaQuote(symbol, apiKey) {
    const response = await fetch(alphaUrl({ function: "GLOBAL_QUOTE", symbol, apikey: apiKey }));
    const payload = await response.json();
    const quote = payload["Global Quote"];
    if (!quote || !quote["05. price"]) throw new Error(`No quote returned for ${symbol}.`);
    return {
      price: Number(quote["05. price"]),
      change: Number(String(quote["10. change percent"] || "0").replace("%", "")),
      source: "Alpha Vantage",
    };
  }

  async function fetchDailySeries(symbol, apiKey) {
    const response = await fetch(alphaUrl({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact", apikey: apiKey }));
    const payload = await response.json();
    const series = payload["Time Series (Daily)"];
    if (!series) throw new Error(`No daily series returned for ${symbol}.`);
    return Object.entries(series)
      .map(([date, values]) => ({ date, close: Number(values["4. close"]) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async function fetchBitcoin() {
    const url = new URL(COINGECKO_PRICE_URL);
    url.searchParams.set("ids", "bitcoin");
    url.searchParams.set("vs_currencies", "usd");
    url.searchParams.set("include_24hr_change", "true");
    const response = await fetch(url);
    const payload = await response.json();
    if (!payload.bitcoin?.usd) throw new Error("No Bitcoin quote returned.");
    return {
      price: Number(payload.bitcoin.usd),
      change: Number(payload.bitcoin.usd_24h_change || 0),
      source: "CoinGecko",
    };
  }

  async function refreshWatchlistData() {
    const apiKey = savedApiKey();
    for (const item of watchlistState) {
      try {
        if (item.ticker === "BTC") {
          Object.assign(item, await fetchBitcoin());
        } else if (apiKey && ["Stock", "ETF", "Bond", "Commodity", "Currency"].includes(item.type)) {
          Object.assign(item, await fetchAlphaQuote(item.ticker, apiKey));
          const closes = (await fetchDailySeries(item.ticker, apiKey)).slice(-60).map((candle) => candle.close);
          item.series = normalizeSeries(closes);
        }
      } catch {
        item.source = item.source || "Sample fallback";
      }
    }
    saveWatchlist();
    renderWatchlist("Watchlist refreshed");
  }

  function injectWatchlistFixStyles() {
    if (document.querySelector("#watchlistFixStyles")) return;
    const style = document.createElement("style");
    style.id = "watchlistFixStyles";
    style.textContent = `
      .watch-card { position: relative; }
      .watch-remove {
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        position: absolute;
        top: 8px;
        right: 8px;
        border: 1px solid transparent;
        border-radius: 999px;
        color: var(--muted);
        font-size: 1.1rem;
        font-weight: 800;
        line-height: 1;
        opacity: 0;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease, opacity 160ms ease;
      }
      .watch-card:hover .watch-remove,
      .watch-card.active .watch-remove,
      .watch-remove:focus-visible { opacity: 1; }
      .watch-remove:hover { border-color: rgba(217, 79, 79, 0.2); background: #f8ecec; color: var(--red); }
    `;
    document.head.appendChild(style);
  }

  function bindWatchlist() {
    $("#addWatchItem")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      createWatchItem();
    }, true);
    $("#watchTicker")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        createWatchItem();
      }
    });
    $("#watchName")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        createWatchItem();
      }
    });
    $("#watchlistCards")?.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-watch]");
      if (removeButton) {
        event.preventDefault();
        event.stopPropagation();
        removeWatchItem(removeButton.dataset.removeWatch);
        return;
      }
      const card = event.target.closest("[data-watch-ticker]");
      if (!card) return;
      selectedTicker = card.dataset.watchTicker;
      renderWatchlist();
    });
    $("#refreshMarketData")?.addEventListener("click", () => {
      window.setTimeout(refreshWatchlistData, 800);
    });
  }

  function initWatchlist() {
    if (!$("#watchlistCards")) return;
    window.investmentDeskWatchlistFixVersion = "watchlist-fix-2026-06-23";
    injectWatchlistFixStyles();
    renderWatchlist();
    bindWatchlist();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initWatchlist);
  else initWatchlist();
})();
