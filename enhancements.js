(function () {
  if (window.__investmentDeskEnhancements) return;
  window.__investmentDeskEnhancements = true;

  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const WATCHLIST_STORAGE_KEY = "investmentDeskWatchlistV1";
  const TECHNICAL_STORAGE_KEY = "investmentDeskTechnicalsV1";
  const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
  const FINNHUB_URL = "https://finnhub.io/api/v1";
  const COINGECKO_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
  const VISIBLE_LINE_ITEMS = 5;
  const expandedSections = new Set();
  const indexModels = [
    { symbol: "SPY", label: "S&P 500", color: "#0a84ff" },
    { symbol: "QQQ", label: "Nasdaq 100", color: "#7c5cff" },
    { symbol: "DIA", label: "Dow 30", color: "#1f9d63" },
    { symbol: "IWM", label: "Russell 2000", color: "#c48a22" },
    { symbol: "EFA", label: "Developed ex-US", color: "#3867d6" },
  ];

  const $ = (selector) => document.querySelector(selector);
  let searchTimer = null;

  function readSettings() {
    try {
      return { provider: "alphaVantage", alphaVantageKey: "", finnhubKey: "", openAiKey: "", ...JSON.parse(localStorage.getItem(DATA_SETTINGS_KEY)) };
    } catch {
      return { provider: "alphaVantage", alphaVantageKey: "", finnhubKey: "", openAiKey: "" };
    }
  }

  function writeSettings(settings) {
    localStorage.setItem(DATA_SETTINGS_KEY, JSON.stringify(settings));
    if (typeof dataSettings === "object") Object.assign(dataSettings, settings);
  }

  function providerLabel(provider = readSettings().provider) {
    return provider === "finnhub" ? "Finnhub" : "Alpha Vantage";
  }

  function activeApiKey(settings = readSettings()) {
    return settings.provider === "finnhub" ? settings.finnhubKey : settings.alphaVantageKey;
  }

  function normalizeSeries(series) {
    const values = Array.isArray(series) && series.length ? series.map(Number).filter(Number.isFinite) : [100, 100, 100, 100, 100, 100, 100, 100];
    const first = values[0] || 1;
    return values.map((value) => Number(((value / first) * 100).toFixed(2)));
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }

  function pct(value, digits = 1) {
    return `${Number(value || 0).toFixed(digits)}%`;
  }

  function html(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function alphaUrl(params) {
    const url = new URL(ALPHA_VANTAGE_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }

  function finnhubUrl(path, params, apiKey) {
    const url = new URL(`${FINNHUB_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("token", apiKey);
    return url;
  }

  async function fetchProviderQuote(symbol, settings = readSettings()) {
    const apiKey = activeApiKey(settings);
    if (!apiKey) throw new Error(`Add a ${providerLabel(settings.provider)} key.`);
    if (settings.provider === "finnhub") {
      const response = await fetch(finnhubUrl("/quote", { symbol }, apiKey));
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error);
      if (!payload.c) throw new Error(`No quote returned for ${symbol}.`);
      return {
        symbol,
        price: Number(payload.c),
        change: Number(payload.dp || 0),
        source: "Finnhub",
      };
    }
    const response = await fetch(alphaUrl({ function: "GLOBAL_QUOTE", symbol, apikey: apiKey }));
    const payload = await response.json();
    if (payload.Note || payload.Information) throw new Error(payload.Note || payload.Information);
    const quote = payload["Global Quote"];
    if (!quote || !quote["05. price"]) throw new Error(`No quote returned for ${symbol}.`);
    return {
      symbol,
      price: Number(quote["05. price"]),
      change: Number(String(quote["10. change percent"] || "0").replace("%", "")),
      source: "Alpha Vantage",
    };
  }

  async function fetchProviderDailySeries(symbol, settings = readSettings(), days = 365) {
    const apiKey = activeApiKey(settings);
    if (!apiKey) throw new Error(`Add a ${providerLabel(settings.provider)} key.`);
    if (settings.provider === "finnhub") {
      const to = Math.floor(Date.now() / 1000);
      const from = to - days * 24 * 60 * 60;
      const response = await fetch(finnhubUrl("/stock/candle", { symbol, resolution: "D", from, to }, apiKey));
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error);
      if (payload.s !== "ok" || !Array.isArray(payload.c) || !payload.c.length) throw new Error(`No daily series returned for ${symbol}.`);
      return payload.c.map((close, index) => ({
        date: new Date(Number(payload.t[index] || 0) * 1000).toISOString().slice(0, 10),
        open: Number(payload.o?.[index] ?? close),
        high: Number(payload.h?.[index] ?? close),
        low: Number(payload.l?.[index] ?? close),
        close: Number(close),
        volume: Number(payload.v?.[index] ?? 0),
      }));
    }
    const response = await fetch(alphaUrl({ function: "TIME_SERIES_DAILY", symbol, outputsize: "compact", apikey: apiKey }));
    const payload = await response.json();
    if (payload.Note || payload.Information) throw new Error(payload.Note || payload.Information);
    const series = payload["Time Series (Daily)"];
    if (!series) throw new Error(`No daily series returned for ${symbol}.`);
    return Object.entries(series)
      .map(([date, values]) => ({
        date,
        open: Number(values["1. open"]),
        high: Number(values["2. high"]),
        low: Number(values["3. low"]),
        close: Number(values["4. close"]),
        volume: Number(values["5. volume"]),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async function fetchCoinGeckoCrypto(symbol) {
    const ids = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano" };
    const id = ids[String(symbol || "").toUpperCase()];
    if (!id) throw new Error(`No CoinGecko mapping for ${symbol}.`);
    const url = new URL(COINGECKO_PRICE_URL);
    url.searchParams.set("ids", id);
    url.searchParams.set("vs_currencies", "usd");
    url.searchParams.set("include_24hr_change", "true");
    const response = await fetch(url);
    const payload = await response.json();
    if (!payload[id]?.usd) throw new Error(`No ${symbol} quote returned.`);
    return {
      symbol: String(symbol || "").toUpperCase(),
      price: Number(payload[id].usd),
      change: Number(payload[id].usd_24h_change || 0),
      source: "CoinGecko",
    };
  }

  async function fetchCoinGeckoHistory(symbol, days = 365) {
    const ids = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano" };
    const id = ids[String(symbol || "").toUpperCase()];
    if (!id) throw new Error(`No CoinGecko history mapping for ${symbol}.`);
    const url = new URL(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", String(days));
    const response = await fetch(url);
    const payload = await response.json();
    if (!Array.isArray(payload.prices) || !payload.prices.length) throw new Error(`No ${symbol} history returned.`);
    return payload.prices.map(([, price]) => Number(price)).filter(Number.isFinite);
  }

  function injectStyles() {
    if ($("#enhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "enhancementStyles";
    style.textContent = `
      .line-item-hidden { display: none !important; }
      .expand-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        margin-top: 10px;
        padding: 0 13px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.82);
        color: var(--teal);
        font-size: 0.76rem;
        font-weight: 900;
        cursor: pointer;
      }
      .expand-toggle:hover { background: rgba(10, 132, 255, 0.08); }
      .expand-toggle[hidden] { display: none; }
    `;
    document.head.append(style);
  }

  function ensureFinnhubControls() {
    const provider = $("#marketDataProvider");
    const keyInput = $("#marketDataKey");
    if (!provider || !keyInput) return;
    if (!provider.querySelector('option[value="finnhub"]')) {
      provider.insertAdjacentHTML("beforeend", '<option value="finnhub">Finnhub (free)</option>');
    }
    const settings = readSettings();
    provider.value = settings.provider || "alphaVantage";
    keyInput.value = activeApiKey(settings);
    keyInput.placeholder = settings.provider === "finnhub" ? "Paste Finnhub API key" : "Paste Alpha Vantage key";
    const detail = $("#marketDataDetail");
    if (detail && !detail.dataset.providerEnhanced) {
      detail.textContent = "Crypto prices refresh from CoinGecko. Equities, ETFs, funds, indexes, and technical history use the selected provider.";
      detail.dataset.providerEnhanced = "true";
    }
  }

  function saveProviderSettings() {
    const settings = readSettings();
    const provider = $("#marketDataProvider")?.value || settings.provider || "alphaVantage";
    const key = $("#marketDataKey")?.value.trim() || "";
    const next = {
      ...settings,
      provider,
      alphaVantageKey: provider === "alphaVantage" ? key : settings.alphaVantageKey,
      finnhubKey: provider === "finnhub" ? key : settings.finnhubKey,
      openAiKey: $("#openAiKey")?.value.trim() || settings.openAiKey || "",
    };
    writeSettings(next);
    ensureFinnhubControls();
    setDataStatus(next);
  }

  function setDataStatus(settings = readSettings(), label = "API key saved") {
    const hasKey = Boolean(activeApiKey(settings));
    const provider = providerLabel(settings.provider);
    const status = $("#marketDataStatus");
    if (status) {
      status.textContent = hasKey ? label : "Crypto-only live mode";
      status.className = `data-badge ${hasKey ? "positive" : "neutral"}`;
    }
    const source = $("#marketDataSource");
    const detail = $("#marketDataDetail");
    if (source) source.textContent = hasKey ? `${provider} key saved` : "Crypto-only live mode";
    if (detail) detail.textContent = hasKey ? `Equities, ETFs, funds, indexes, and technical history will refresh from ${provider}. Crypto still refreshes from CoinGecko.` : `Add an Alpha Vantage or Finnhub key to refresh equities, ETFs, funds, indexes, and technicals. Crypto still refreshes from CoinGecko.`;
  }

  function syncGlobalProviderFunctions() {
    try {
      fetchAlphaQuote = (symbol) => fetchProviderQuote(symbol);
      fetchDailySeries = (symbol) => fetchProviderDailySeries(symbol);
    } catch {
      window.fetchAlphaQuote = (symbol) => fetchProviderQuote(symbol);
      window.fetchDailySeries = (symbol) => fetchProviderDailySeries(symbol);
    }
  }

  function patchSyncControls() {
    try {
      if (window.__investmentDeskSyncControlsEnhanced || typeof syncControls !== "function") return;
      const originalSyncControls = syncControls;
      syncControls = function (...args) {
        const result = originalSyncControls.apply(this, args);
        ensureFinnhubControls();
        return result;
      };
      window.__investmentDeskSyncControlsEnhanced = true;
    } catch {
      // The enhancement still works when the base dashboard does not expose syncControls.
    }
  }

  function updateTechnicalProviderStatus() {
    const badge = $("#technicalDataStatus");
    if (!badge) return;
    const settings = readSettings();
    const count = (() => {
      try {
        return Array.isArray(technicals) ? technicals.length : 0;
      } catch {
        return 0;
      }
    })();
    const hasKey = Boolean(activeApiKey(settings));
    badge.textContent = hasKey ? `${count} tracked - ${providerLabel(settings.provider)} ready` : `${count} tracked - key needed`;
    badge.className = `data-badge ${hasKey ? "positive" : "neutral"}`;
  }

  function patchTechnicalStatus() {
    try {
      if (window.__investmentDeskTechnicalStatusEnhanced || typeof renderTechnicals !== "function") return;
      const originalRenderTechnicals = renderTechnicals;
      renderTechnicals = function (...args) {
        const result = originalRenderTechnicals.apply(this, args);
        updateTechnicalProviderStatus();
        return result;
      };
      window.__investmentDeskTechnicalStatusEnhanced = true;
    } catch {
      // Non-critical display patch.
    }
  }

  function applyQuoteToHoldingSafe(holding, quote) {
    if (typeof applyQuoteToHolding === "function") {
      applyQuoteToHolding(holding, quote);
      return;
    }
    holding.price = quote.price;
    holding.change = quote.change;
    holding.lastPriceSource = quote.source;
    if (holding.ticker !== "CASH") holding.value = Number(holding.quantity || 0) * quote.price;
    holding.bias = quote.change > 1 ? "Bullish" : quote.change < -1 ? "Weak" : "Neutral";
  }

  async function refreshWatchlistProviderData(results, settings) {
    const list = Array.isArray(watchlistState) ? watchlistState : JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || "[]");
    for (const item of list) {
      try {
        if (item.type === "Crypto" && !["IBIT", "GBTC"].includes(item.ticker)) {
          Object.assign(item, await fetchCoinGeckoCrypto(item.ticker));
          item.series = normalizeSeries(await fetchCoinGeckoHistory(item.ticker, 365));
        } else if (activeApiKey(settings) && ["Stock", "ETF", "Bond", "Commodity", "Currency", "Alternative"].includes(item.type)) {
          Object.assign(item, await fetchProviderQuote(item.ticker, settings));
          const candles = await fetchProviderDailySeries(item.ticker, settings, 365);
          item.series = normalizeSeries(candles.slice(-60).map((candle) => candle.close));
        } else {
          results.skipped += 1;
          continue;
        }
        results.updated += 1;
      } catch (error) {
        results.failed += 1;
        results.messages.push(`${item.ticker} watchlist: ${error.message}`);
      }
    }
    try {
      watchlistState = list;
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
      renderWatchlist();
    } catch {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
    }
  }

  async function refreshTechnicalsProviderData(results, settings) {
    const items = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(TECHNICAL_STORAGE_KEY));
        if (Array.isArray(saved) && saved.length) return saved;
      } catch {
        // Use the in-memory technical list when local storage is empty.
      }
      return Array.isArray(technicals) ? technicals : [];
    })();
    if (!activeApiKey(settings)) return;
    const updated = [];
    for (const item of items) {
      try {
        updated.push(technicalFromSeries(item, await fetchProviderDailySeries(item.ticker, settings, 365)));
        results.updated += 1;
      } catch (error) {
        updated.push(item);
        results.failed += 1;
        results.messages.push(`${item.ticker} technicals: ${error.message}`);
      }
    }
    if (updated.length) {
      try {
        technicals.splice(0, technicals.length, ...updated);
      } catch {
        window.technicals = updated;
      }
      localStorage.setItem(TECHNICAL_STORAGE_KEY, JSON.stringify(updated));
      $("#technicalDataStatus").textContent = `Live ${providerLabel(settings.provider)} mix`;
      if (typeof renderTechnicals === "function") renderTechnicals();
    }
  }

  function renderIndexDeck(items, statusLabel) {
    const cards = items
      .map((item) => {
        const series = normalizeSeries(item.series || []);
        const first = series[0] || 1;
        const last = series.at(-1) || first;
        const prev = series.at(-2) || first;
        const oneDay = ((last / prev - 1) * 100) || 0;
        const period = ((last / first - 1) * 100) || 0;
        const high = Math.max(...series);
        const drawdown = ((last / high - 1) * 100) || 0;
        const path = makePath(series, 280, 94, 10);
        return `
          <article class="index-card">
            <div class="index-card-top">
              <div><span>${item.symbol}</span><strong>${item.label}</strong></div>
              <b class="${oneDay >= 0 ? "positive" : "negative"}">${oneDay >= 0 ? "+" : ""}${pct(oneDay)}</b>
            </div>
            <svg class="index-sparkline" viewBox="0 0 280 94" role="img" aria-label="${item.label} price chart">
              <path class="index-fill" d="${path} L 270 84 L 10 84 Z" fill="${item.color}22"></path>
              <path d="${path}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round"></path>
            </svg>
            <div class="index-metrics">
              <span>Period <strong class="${period >= 0 ? "positive" : "negative"}">${period >= 0 ? "+" : ""}${pct(period)}</strong></span>
              <span>Drawdown <strong>${pct(drawdown)}</strong></span>
              <span>${item.source || statusLabel}</span>
            </div>
          </article>
        `;
      })
      .join("");
    if ($("#indexCards")) $("#indexCards").innerHTML = cards;
    const positives = items.filter((item) => {
      const series = normalizeSeries(item.series || []);
      const last = series.at(-1) || 1;
      const prev = series.at(-2) || 1;
      return last >= prev;
    }).length;
    if ($("#indexRiskTone")) $("#indexRiskTone").textContent = positives >= 4 ? "Risk-on" : positives >= 3 ? "Constructive" : positives >= 2 ? "Mixed" : "Defensive";
    if ($("#indexRiskDetail")) $("#indexRiskDetail").textContent = `${positives} of ${items.length} indexes are positive on the latest session.`;
    if ($("#indexBreadthBars")) {
      $("#indexBreadthBars").innerHTML = items
        .map((item) => {
          const series = normalizeSeries(item.series || []);
          const last = series.at(-1) || 1;
          const prev = series.at(-2) || 1;
          const oneDay = ((last / prev - 1) * 100) || 0;
          return `<div><span>${item.label}</span><i><b style="width:${Math.min(100, Math.max(4, 50 + oneDay * 12))}%; background:${item.color}"></b></i><strong class="${oneDay >= 0 ? "positive" : "negative"}">${oneDay >= 0 ? "+" : ""}${pct(oneDay)}</strong></div>`;
        })
        .join("");
    }
    const badge = $("#indexDataStatus");
    if (badge) {
      badge.textContent = statusLabel;
      badge.className = "data-badge positive";
    }
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

  async function refreshIndexesProviderData(settings) {
    if (!activeApiKey(settings)) return;
    const updated = [];
    for (const item of indexModels) {
      try {
        const candles = await fetchProviderDailySeries(item.symbol, settings, 365);
        updated.push({ ...item, series: candles.slice(-60).map((candle) => candle.close), source: providerLabel(settings.provider) });
      } catch {
        updated.push({ ...item, series: Array.from({ length: 12 }, () => 100), source: "Refresh needed" });
      }
    }
    renderIndexDeck(updated, `Live ${providerLabel(settings.provider)} data`);
  }

  async function refreshProviderData(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    saveProviderSettings();
    syncGlobalProviderFunctions();
    const settings = readSettings();
    const refreshButton = $("#refreshMarketData");
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "Refreshing...";
    }
    setDataStatus(settings, "Refreshing live data");
    const results = { updated: 0, failed: 0, skipped: 0, messages: [] };
    try {
      if (Array.isArray(appState?.holdings)) {
        for (const holding of appState.holdings) {
          try {
            if (holding.ticker === "CASH") {
              holding.price = 1;
              holding.quantity = Number(holding.value || 0);
              holding.lastPriceSource = "Cash";
              continue;
            }
            if (!String(holding.ticker || "").trim() || holding.name === "Open portfolio slot") continue;
            const geckoCrypto = holding.category === "Crypto assets" && !["IBIT", "GBTC"].includes(holding.ticker);
            const quote = geckoCrypto ? await fetchCoinGeckoCrypto(holding.ticker) : await fetchProviderQuote(holding.ticker, settings);
            applyQuoteToHoldingSafe(holding, quote);
            const history = geckoCrypto ? await fetchCoinGeckoHistory(holding.ticker, 365) : (await fetchProviderDailySeries(holding.ticker, settings, 365)).map((candle) => candle.close);
            holding.series = normalizeSeries(history.slice(-60));
            results.updated += 1;
          } catch (error) {
            results.failed += 1;
            results.messages.push(`${holding.ticker}: ${error.message}`);
          }
        }
      }
      await refreshTechnicalsProviderData(results, settings);
      await refreshWatchlistProviderData(results, settings);
      await refreshIndexesProviderData(settings);
      try {
        latestDataStamp = new Date();
        latestRecommendations = [];
        saveState();
        renderAll();
        ensureFinnhubControls();
      } catch {
        // Some standalone render patches may not expose all globals.
      }
      const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const detail = results.failed || results.skipped ? `${results.updated} live updates at ${stamp}; ${results.failed + results.skipped} items still need review. ${results.messages[0] || ""}` : `${results.updated} instruments updated at ${stamp}.`;
      const status = $("#marketDataStatus");
      if (status) {
        status.textContent = results.updated ? "Live data refreshed" : "Live data needed";
        status.className = `data-badge ${results.updated ? "positive" : "negative"}`;
      }
      if ($("#marketDataSource")) $("#marketDataSource").textContent = `${providerLabel(settings.provider)} refresh complete`;
      if ($("#marketDataDetail")) $("#marketDataDetail").textContent = detail;
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh Live Data";
      }
      window.setTimeout(applyExpandableSections, 80);
    }
  }

  function sectionTarget(config) {
    const container = $(config.selector);
    if (!container) return null;
    const items = Array.from(container.querySelectorAll(config.itemSelector)).filter((item) => !item.classList.contains("empty-state"));
    return { container, items };
  }

  function ensureToggle(config, count) {
    const anchor = $(config.anchor) || $(config.selector);
    if (!anchor || count <= VISIBLE_LINE_ITEMS) {
      $(`[data-expand-target="${config.id}"]`)?.remove();
      return null;
    }
    let button = $(`[data-expand-target="${config.id}"]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "expand-toggle";
      button.dataset.expandTarget = config.id;
      anchor.insertAdjacentElement("afterend", button);
    }
    const expanded = expandedSections.has(config.id);
    button.textContent = expanded ? `Show first ${VISIBLE_LINE_ITEMS}` : `Show all ${count}`;
    button.setAttribute("aria-expanded", String(expanded));
    return button;
  }

  function applyExpandableSection(config) {
    const target = sectionTarget(config);
    if (!target) return;
    const expanded = expandedSections.has(config.id);
    target.items.forEach((item, index) => {
      item.classList.toggle("line-item-hidden", !expanded && index >= VISIBLE_LINE_ITEMS);
    });
    ensureToggle(config, target.items.length);
  }

  const expandableConfigs = [
    { id: "portfolio", selector: "#holdingsRows", itemSelector: "tr", anchor: "#holdings .table-wrap" },
    { id: "technicals", selector: "#technicalRows", itemSelector: "tr", anchor: "#technicals .table-wrap" },
    { id: "recommendations", selector: "#tradeRows", itemSelector: "tr", anchor: "#rebalance .trade-table" },
    { id: "yieldRows", selector: "#yieldRows", itemSelector: "tr", anchor: "#yield-forecast .table-wrap.compact" },
    { id: "allocation", selector: "#allocationLegend", itemSelector: "li", anchor: "#allocationLegend" },
    { id: "targets", selector: "#targetBars", itemSelector: ".target-bar", anchor: "#targetBars" },
    { id: "yieldBars", selector: "#yieldBars", itemSelector: ".yield-bar", anchor: "#yieldBars" },
    { id: "watchlist", selector: "#watchlistCards", itemSelector: ".watch-card", anchor: "#watchlistCards" },
  ];

  function applyExpandableSections() {
    expandableConfigs.forEach(applyExpandableSection);
  }

  function observeExpandableSections() {
    const observer = new MutationObserver(() => window.setTimeout(applyExpandableSections, 0));
    expandableConfigs.forEach((config) => {
      const container = $(config.selector);
      if (container) observer.observe(container, { childList: true });
    });
  }

  function inferType(symbol, name = "") {
    const ticker = String(symbol || "").toUpperCase();
    const lower = String(name || "").toLowerCase();
    if (["BTC", "ETH", "SOL", "ADA", "IBIT", "GBTC"].includes(ticker) || lower.includes("bitcoin") || lower.includes("ethereum")) return "Crypto";
    if (lower.includes("bond") || lower.includes("treasury") || lower.includes("income") || ["BND", "AGG", "TLT", "IEF", "SHY", "LQD", "MUB", "HYG"].includes(ticker)) return "Bond";
    if (lower.includes("gold") || lower.includes("silver") || lower.includes("oil") || lower.includes("commodity")) return "Commodity";
    if (lower.includes("etf") || lower.includes("fund") || lower.includes("trust")) return "ETF";
    return "Stock";
  }

  function searchBox() {
    let box = $("#providerSearchResults");
    if (box) return box;
    box = document.createElement("div");
    box.id = "providerSearchResults";
    box.className = "watch-search-results";
    box.hidden = true;
    $("#watchTicker")?.closest("label")?.appendChild(box);
    return box;
  }

  async function providerSearch(query) {
    const settings = readSettings();
    const apiKey = activeApiKey(settings);
    if (!apiKey || query.trim().length < 2) return [];
    if (settings.provider === "finnhub") {
      const response = await fetch(finnhubUrl("/search", { q: query.trim(), exchange: "US" }, apiKey));
      const payload = await response.json();
      return (payload.result || [])
        .slice(0, 8)
        .map((item) => ({
          ticker: String(item.symbol || "").toUpperCase(),
          name: String(item.description || item.displaySymbol || item.symbol || ""),
          type: inferType(item.symbol, item.description),
          source: "Finnhub search",
        }))
        .filter((item) => item.ticker);
    }
    const url = alphaUrl({ function: "SYMBOL_SEARCH", keywords: query.trim(), apikey: apiKey });
    const response = await fetch(url);
    const payload = await response.json();
    return (payload.bestMatches || [])
      .slice(0, 8)
      .map((match) => {
        const ticker = String(match["1. symbol"] || "").toUpperCase();
        const name = String(match["2. name"] || ticker);
        return { ticker, name, type: inferType(ticker, name), source: "Alpha Vantage search" };
      })
      .filter((item) => item.ticker);
  }

  function renderSearchResults(results) {
    const box = searchBox();
    if (!box) return;
    if (!results.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = results
      .map(
        (item) => `
          <button type="button" data-provider-result="${html(item.ticker)}" data-provider-name="${html(item.name)}" data-provider-type="${html(item.type)}">
            <strong>${html(item.ticker)}</strong>
            <span>${html(item.name)}</span>
            <small>${html(item.source)}</small>
          </button>
        `
      )
      .join("");
  }

  function bindProviderSearch() {
    const input = $("#watchTicker");
    if (!input || input.dataset.providerSearchBound) return;
    input.dataset.providerSearchBound = "true";
    input.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      const query = input.value.trim();
      searchTimer = window.setTimeout(async () => {
        try {
          renderSearchResults(await providerSearch(query));
        } catch {
          renderSearchResults([]);
        }
      }, 260);
    });
    document.addEventListener("click", (event) => {
      const result = event.target.closest("[data-provider-result]");
      if (!result) {
        if (!event.target.closest("#providerSearchResults") && !event.target.closest("#watchTicker")) searchBox().hidden = true;
        return;
      }
      event.preventDefault();
      if ($("#watchTicker")) $("#watchTicker").value = result.dataset.providerResult;
      if ($("#watchName")) $("#watchName").value = result.dataset.providerName || "";
      if ($("#watchType")) $("#watchType").value = result.dataset.providerType || "Stock";
      searchBox().hidden = true;
    });
  }

  function bindEnhancements() {
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest("#saveMarketDataKey")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          saveProviderSettings();
        }
        if (event.target.closest("#refreshMarketData")) refreshProviderData(event);
      },
      true
    );
    document.addEventListener("change", (event) => {
      if (event.target.closest("#marketDataProvider")) {
        const settings = readSettings();
        settings.provider = event.target.value;
        writeSettings(settings);
        ensureFinnhubControls();
      }
    });
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-expand-target]");
      if (!toggle) return;
      const id = toggle.dataset.expandTarget;
      if (expandedSections.has(id)) expandedSections.delete(id);
      else expandedSections.add(id);
      applyExpandableSections();
    });
  }

  function init() {
    injectStyles();
    ensureFinnhubControls();
    syncGlobalProviderFunctions();
    patchSyncControls();
    patchTechnicalStatus();
    bindEnhancements();
    bindProviderSearch();
    observeExpandableSections();
    updateTechnicalProviderStatus();
    window.setTimeout(applyExpandableSections, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();