(() => {
  if (window.__investmentDeskEnhancements) return;
  window.__investmentDeskEnhancements = true;

  const DATA_KEY = "investmentDeskDataSettingsV1";
  const WATCH_KEY = "investmentDeskWatchlistV1";
  const TECH_KEY = "investmentDeskTechnicalsV1";
  const INDEX_KEY = "investmentDeskIndexDeckV1";
  const YAHOO_URL = "https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart";
  const ALPHA_URL = "https://www.alphavantage.co/query";
  const FINNHUB_URL = "https://finnhub.io/api/v1";
  const GECKO_URL = "https://api.coingecko.com/api/v3/simple/price";
  const VISIBLE_COUNT = 5;
  const expanded = new Set();
  const yahooCache = new Map();
  let searchTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const indexes = [
    ["SPY", "S&P 500", "#0a84ff"],
    ["QQQ", "Nasdaq 100", "#7c5cff"],
    ["DIA", "Dow 30", "#1f9d63"],
    ["IWM", "Russell 2000", "#c48a22"],
    ["EFA", "Developed ex-US", "#3867d6"],
  ].map(([symbol, label, color]) => ({ symbol, label, color }));
  const localUniverse = [
    ["SPY", "S&P 500 ETF", "ETF"], ["QQQ", "Invesco Nasdaq 100 ETF", "ETF"], ["DIA", "SPDR Dow Jones Industrial Average ETF", "ETF"],
    ["IWM", "iShares Russell 2000 ETF", "ETF"], ["VTI", "Vanguard Total Stock Market ETF", "ETF"], ["VOO", "Vanguard S&P 500 ETF", "ETF"],
    ["EFA", "iShares MSCI EAFE ETF", "ETF"], ["EEM", "iShares MSCI Emerging Markets ETF", "ETF"], ["VEA", "Vanguard Developed Markets ETF", "ETF"],
    ["VWO", "Vanguard Emerging Markets ETF", "ETF"], ["BND", "Vanguard Total Bond Market ETF", "Bond"], ["AGG", "iShares Core U.S. Aggregate Bond ETF", "Bond"],
    ["TLT", "iShares 20+ Year Treasury Bond ETF", "Bond"], ["IEF", "iShares 7-10 Year Treasury Bond ETF", "Bond"], ["SHY", "iShares 1-3 Year Treasury Bond ETF", "Bond"],
    ["LQD", "iShares Investment Grade Corporate Bond ETF", "Bond"], ["HYG", "iShares iBoxx High Yield Corporate Bond ETF", "Bond"], ["MUB", "iShares National Muni Bond ETF", "Bond"],
    ["GLD", "SPDR Gold Shares", "Commodity"], ["SLV", "iShares Silver Trust", "Commodity"], ["USO", "United States Oil Fund", "Commodity"],
    ["DBC", "Invesco DB Commodity Index Tracking Fund", "Commodity"], ["VNQ", "Vanguard Real Estate ETF", "ETF"], ["XLK", "Technology Select Sector SPDR Fund", "ETF"],
    ["XLF", "Financial Select Sector SPDR Fund", "ETF"], ["XLE", "Energy Select Sector SPDR Fund", "ETF"], ["XLV", "Health Care Select Sector SPDR Fund", "ETF"],
    ["AAPL", "Apple Inc.", "Stock"], ["MSFT", "Microsoft Corp.", "Stock"], ["NVDA", "NVIDIA Corp.", "Stock"], ["AMZN", "Amazon.com Inc.", "Stock"],
    ["GOOGL", "Alphabet Inc. Class A", "Stock"], ["META", "Meta Platforms Inc.", "Stock"], ["TSLA", "Tesla Inc.", "Stock"], ["BRK.B", "Berkshire Hathaway Inc. Class B", "Stock"],
    ["JPM", "JPMorgan Chase & Co.", "Stock"], ["V", "Visa Inc.", "Stock"], ["MA", "Mastercard Inc.", "Stock"], ["UNH", "UnitedHealth Group Inc.", "Stock"],
    ["LLY", "Eli Lilly and Co.", "Stock"], ["AVGO", "Broadcom Inc.", "Stock"], ["COST", "Costco Wholesale Corp.", "Stock"], ["NFLX", "Netflix Inc.", "Stock"],
    ["AMD", "Advanced Micro Devices Inc.", "Stock"], ["ORCL", "Oracle Corp.", "Stock"], ["KO", "Coca-Cola Co.", "Stock"], ["PEP", "PepsiCo Inc.", "Stock"],
    ["WMT", "Walmart Inc.", "Stock"], ["PG", "Procter & Gamble Co.", "Stock"], ["HD", "Home Depot Inc.", "Stock"], ["XOM", "Exxon Mobil Corp.", "Stock"],
    ["CVX", "Chevron Corp.", "Stock"], ["BTC", "Bitcoin", "Crypto"], ["ETH", "Ethereum", "Crypto"], ["SOL", "Solana", "Crypto"],
    ["ADA", "Cardano", "Crypto"], ["IBIT", "iShares Bitcoin Trust ETF", "Crypto"], ["GBTC", "Grayscale Bitcoin Trust ETF", "Crypto"],
  ].map(([ticker, name, type]) => ({ ticker, name, type, source: "Local match" }));

  function readSettings() {
    try { return { provider: "alphaVantage", alphaVantageKey: "", finnhubKey: "", openAiKey: "", ...JSON.parse(localStorage.getItem(DATA_KEY)) }; }
    catch { return { provider: "alphaVantage", alphaVantageKey: "", finnhubKey: "", openAiKey: "" }; }
  }
  function writeSettings(settings) {
    localStorage.setItem(DATA_KEY, JSON.stringify(settings));
    try { if (typeof dataSettings === "object") Object.assign(dataSettings, settings); } catch {}
  }
  function apiKey(settings = readSettings()) {
    if (settings.provider === "yahooDelayed") return "";
    return settings.provider === "finnhub" ? settings.finnhubKey : settings.alphaVantageKey;
  }
  function providerLabel(provider = readSettings().provider) {
    if (provider === "yahooDelayed") return "Yahoo delayed";
    return provider === "finnhub" ? "Finnhub" : "Alpha Vantage";
  }
  function sourceLabel(settings = readSettings()) { return apiKey(settings) ? providerLabel(settings.provider) : "Yahoo delayed"; }
  function statusLabel(settings = readSettings(), suffix = "data") { return apiKey(settings) ? `Live ${sourceLabel(settings)} ${suffix}` : `${sourceLabel(settings)} ${suffix}`; }
  function html(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
  function pct(value, digits = 1) { return `${Number(value || 0).toFixed(digits)}%`; }
  function normalizeSeries(series) {
    const values = (Array.isArray(series) && series.length ? series : [100, 100, 100, 100, 100, 100, 100, 100]).map(Number).filter(Number.isFinite);
    const first = values[0] || 1;
    return values.map((value) => Number(((value / first) * 100).toFixed(2)));
  }
  function makeUrl(base, params) {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }
  function finnhubUrl(path, params, key) { return makeUrl(`${FINNHUB_URL}${path}`, { ...params, token: key }); }
  function yahooSymbol(symbol) {
    const normalized = String(symbol || "").trim().toUpperCase();
    const crypto = { BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD", ADA: "ADA-USD" };
    return crypto[normalized] || normalized.replace(".", "-");
  }
  function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  function pathFor(points, width = 280, height = 94, padding = 10) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points.map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
      const y = height - padding - ((point - min) / range) * (height - padding * 2);
      return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  async function yahooSeries(symbol, retry = true) {
    const cacheKey = yahooSymbol(symbol);
    if (yahooCache.has(cacheKey)) return yahooCache.get(cacheKey);
    const url = new URL(`${YAHOO_URL}/${encodeURIComponent(cacheKey)}`);
    url.searchParams.set("range", "1y");
    url.searchParams.set("interval", "1d");
    const response = await fetch(url);
    const text = await response.text();
    const start = text.indexOf('{"chart"');
    if (start === -1) {
      if (retry) { await wait(350); return yahooSeries(symbol, false); }
      throw new Error(`No delayed chart data returned for ${symbol}.`);
    }
    const payload = JSON.parse(text.slice(start).trim());
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const rows = (quote.close || []).map((close, index) => ({
      date: new Date(Number(timestamps[index] || 0) * 1000).toISOString().slice(0, 10),
      open: Number(quote.open?.[index] ?? close),
      high: Number(quote.high?.[index] ?? close),
      low: Number(quote.low?.[index] ?? close),
      close: Number(close),
      volume: Number(quote.volume?.[index] ?? 0),
    })).filter((row) => Number.isFinite(row.close) && row.close > 0);
    if (!rows.length) {
      if (retry) { await wait(350); return yahooSeries(symbol, false); }
      throw new Error(`No delayed chart data returned for ${symbol}.`);
    }
    yahooCache.set(cacheKey, rows);
    return rows;
  }
  function quoteFromCandles(symbol, candles, source) {
    const latest = candles.at(-1);
    const previous = candles.at(-2) || latest;
    return { symbol: String(symbol || "").toUpperCase(), price: Number(latest.close), change: previous?.close ? ((latest.close / previous.close - 1) * 100) || 0 : 0, source };
  }
  async function providerSeries(symbol, settings = readSettings(), days = 365) {
    const key = apiKey(settings);
    if (!key) return yahooSeries(symbol);
    if (settings.provider === "finnhub") {
      const to = Math.floor(Date.now() / 1000);
      const from = to - days * 86400;
      const payload = await (await fetch(finnhubUrl("/stock/candle", { symbol, resolution: "D", from, to }, key))).json();
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
    const payload = await (await fetch(makeUrl(ALPHA_URL, { function: "TIME_SERIES_DAILY", symbol, outputsize: "compact", apikey: key }))).json();
    if (payload.Note || payload.Information) throw new Error(payload.Note || payload.Information);
    const series = payload["Time Series (Daily)"];
    if (!series) throw new Error(`No daily series returned for ${symbol}.`);
    return Object.entries(series).map(([date, values]) => ({
      date,
      open: Number(values["1. open"]),
      high: Number(values["2. high"]),
      low: Number(values["3. low"]),
      close: Number(values["4. close"]),
      volume: Number(values["5. volume"]),
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
  async function providerMarketData(symbol, settings = readSettings(), days = 365) {
    const candles = await providerSeries(symbol, settings, days);
    return { quote: quoteFromCandles(symbol, candles, sourceLabel(settings)), candles };
  }
  async function providerQuote(symbol, settings = readSettings()) { return (await providerMarketData(symbol, settings, 365)).quote; }
  async function geckoQuote(symbol) {
    const ids = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano" };
    const id = ids[String(symbol || "").toUpperCase()];
    if (!id) throw new Error(`No CoinGecko mapping for ${symbol}.`);
    const payload = await (await fetch(makeUrl(GECKO_URL, { ids: id, vs_currencies: "usd", include_24hr_change: "true" }))).json();
    if (!payload[id]?.usd) throw new Error(`No ${symbol} quote returned.`);
    return { symbol: String(symbol || "").toUpperCase(), price: Number(payload[id].usd), change: Number(payload[id].usd_24h_change || 0), source: "CoinGecko" };
  }
  async function geckoHistory(symbol, days = 365) {
    const ids = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano" };
    const id = ids[String(symbol || "").toUpperCase()];
    if (!id) throw new Error(`No CoinGecko history mapping for ${symbol}.`);
    const url = new URL(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", String(days));
    const payload = await (await fetch(url)).json();
    if (!Array.isArray(payload.prices) || !payload.prices.length) throw new Error(`No ${symbol} history returned.`);
    return payload.prices.map(([, price]) => Number(price)).filter(Number.isFinite);
  }

  function injectStyles() {
    if ($("#enhancementStyles")) return;
    const style = document.createElement("style");
    style.id = "enhancementStyles";
    style.textContent = ".line-item-hidden{display:none!important}.expand-toggle{display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin-top:10px;padding:0 13px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.82);color:var(--teal);font-size:.76rem;font-weight:900;cursor:pointer}.expand-toggle:hover{background:rgba(10,132,255,.08)}.watch-search-results{position:absolute;z-index:30;margin-top:6px;display:grid;gap:4px;width:min(360px,calc(100vw - 44px));padding:6px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.98);box-shadow:var(--shadow)}.watch-search-results[hidden]{display:none}.watch-search-results button{border:0;background:transparent;text-align:left;display:grid;grid-template-columns:64px 1fr;gap:2px 8px;padding:8px;border-radius:8px;cursor:pointer}.watch-search-results button:hover{background:rgba(10,132,255,.08)}.watch-search-results small{grid-column:2;color:var(--muted);font-weight:800}";
    document.head.append(style);
  }
  function ensureProviderControls() {
    const provider = $("#marketDataProvider");
    const keyInput = $("#marketDataKey");
    if (!provider || !keyInput) return;
    if (!provider.querySelector('option[value="yahooDelayed"]')) provider.insertAdjacentHTML("afterbegin", '<option value="yahooDelayed">Yahoo delayed (no key)</option>');
    if (!provider.querySelector('option[value="finnhub"]')) provider.insertAdjacentHTML("beforeend", '<option value="finnhub">Finnhub (free)</option>');
    const settings = readSettings();
    provider.value = settings.provider || "alphaVantage";
    keyInput.value = apiKey(settings);
    keyInput.disabled = settings.provider === "yahooDelayed";
    keyInput.placeholder = settings.provider === "yahooDelayed" ? "No key needed" : settings.provider === "finnhub" ? "Paste Finnhub API key" : "Paste Alpha Vantage key";
  }
  function saveSettings() {
    const settings = readSettings();
    const provider = $("#marketDataProvider")?.value || settings.provider || "alphaVantage";
    const key = $("#marketDataKey")?.value.trim() || "";
    writeSettings({
      ...settings,
      provider,
      alphaVantageKey: provider === "alphaVantage" ? key : settings.alphaVantageKey,
      finnhubKey: provider === "finnhub" ? key : settings.finnhubKey,
      openAiKey: $("#openAiKey")?.value.trim() || settings.openAiKey || "",
    });
    ensureProviderControls();
    setDataStatus();
  }
  function setDataStatus(settings = readSettings(), label = "Provider ready") {
    const hasKey = Boolean(apiKey(settings));
    const status = $("#marketDataStatus");
    if (status) { status.textContent = hasKey ? label : "Yahoo delayed mode"; status.className = "data-badge positive"; }
    if ($("#marketDataSource")) $("#marketDataSource").textContent = hasKey ? `${providerLabel(settings.provider)} key saved` : "Yahoo delayed data ready";
    if ($("#marketDataDetail")) $("#marketDataDetail").textContent = hasKey ? `Market history will refresh from ${providerLabel(settings.provider)}. Crypto still refreshes from CoinGecko.` : "Equities, ETFs, bonds, indexes, watchlist performance, and technicals refresh from Yahoo delayed data. Crypto still refreshes from CoinGecko.";
  }
  function syncProviderGlobals() {
    try { fetchAlphaQuote = (symbol) => providerQuote(symbol); fetchDailySeries = (symbol) => providerSeries(symbol); }
    catch { window.fetchAlphaQuote = (symbol) => providerQuote(symbol); window.fetchDailySeries = (symbol) => providerSeries(symbol); }
  }

  function renderIndexDeck(items, status) {
    if (!Array.isArray(items) || !items.length) return;
    if ($("#indexCards")) $("#indexCards").innerHTML = items.map((item) => {
      const series = normalizeSeries(item.series || []);
      const first = series[0] || 1;
      const last = series.at(-1) || first;
      const prev = series.at(-2) || first;
      const oneDay = ((last / prev - 1) * 100) || 0;
      const period = ((last / first - 1) * 100) || 0;
      const drawdown = ((last / Math.max(...series) - 1) * 100) || 0;
      const svgPath = pathFor(series);
      return `<article class="index-card"><div class="index-card-top"><div><span>${item.symbol}</span><strong>${item.label}</strong></div><b class="${oneDay >= 0 ? "positive" : "negative"}">${oneDay >= 0 ? "+" : ""}${pct(oneDay)}</b></div><svg class="index-sparkline" viewBox="0 0 280 94" role="img" aria-label="${html(item.label)} price chart"><path class="index-fill" d="${svgPath} L 270 84 L 10 84 Z" fill="${item.color}22"></path><path d="${svgPath}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round"></path></svg><div class="index-metrics"><span>Period <strong class="${period >= 0 ? "positive" : "negative"}">${period >= 0 ? "+" : ""}${pct(period)}</strong></span><span>Drawdown <strong>${pct(drawdown)}</strong></span><span>${item.source || status}</span></div></article>`;
    }).join("");
    const positives = items.filter((item) => {
      const series = normalizeSeries(item.series || []);
      return (series.at(-1) || 1) >= (series.at(-2) || 1);
    }).length;
    if ($("#indexRiskTone")) $("#indexRiskTone").textContent = positives >= 4 ? "Risk-on" : positives >= 3 ? "Constructive" : positives >= 2 ? "Mixed" : "Defensive";
    if ($("#indexRiskDetail")) $("#indexRiskDetail").textContent = `${positives} of ${items.length} indexes are positive on the latest session.`;
    if ($("#indexBreadthBars")) $("#indexBreadthBars").innerHTML = items.map((item) => {
      const series = normalizeSeries(item.series || []);
      const oneDay = (((series.at(-1) || 1) / (series.at(-2) || 1) - 1) * 100) || 0;
      return `<div><span>${item.label}</span><i><b style="width:${Math.min(100, Math.max(4, 50 + oneDay * 12))}%; background:${item.color}"></b></i><strong class="${oneDay >= 0 ? "positive" : "negative"}">${oneDay >= 0 ? "+" : ""}${pct(oneDay)}</strong></div>`;
    }).join("");
    if ($("#indexDataStatus")) { $("#indexDataStatus").textContent = status; $("#indexDataStatus").className = "data-badge positive"; }
  }
  async function refreshIndexes(settings = readSettings()) {
    if ($("#indexDataStatus")) { $("#indexDataStatus").textContent = "Refreshing indexes"; $("#indexDataStatus").className = "data-badge neutral"; }
    const updated = [];
    let live = 0;
    for (const item of indexes) {
      try {
        const candles = await providerSeries(item.symbol, settings, 365);
        updated.push({ ...item, series: candles.slice(-60).map((candle) => candle.close), source: sourceLabel(settings) });
        live += 1;
      } catch (error) {
        updated.push({ ...item, series: Array.from({ length: 12 }, () => 100), source: error.message || "Refresh needed" });
      }
    }
    if (live) localStorage.setItem(INDEX_KEY, JSON.stringify({ provider: apiKey(settings) ? settings.provider : "yahooDelayed", updatedAt: new Date().toISOString(), items: updated }));
    renderIndexDeck(updated, live ? statusLabel(settings) : "Delayed data needed");
  }
  function renderCachedIndexes() {
    try {
      const cached = JSON.parse(localStorage.getItem(INDEX_KEY));
      if (!cached?.items?.length) return false;
      const stamp = cached.updatedAt ? new Date(cached.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "recently";
      renderIndexDeck(cached.items, `Cached ${providerLabel(cached.provider || "yahooDelayed")} data from ${stamp}`);
      return true;
    } catch { return false; }
  }

  function applyQuoteToHoldingSafe(holding, quote) {
    try { if (typeof applyQuoteToHolding === "function") { applyQuoteToHolding(holding, quote); return; } } catch {}
    holding.price = quote.price;
    holding.change = quote.change;
    holding.lastPriceSource = quote.source;
    if (holding.ticker !== "CASH") holding.value = Number(holding.quantity || 0) * quote.price;
    holding.bias = quote.change > 1 ? "Bullish" : quote.change < -1 ? "Weak" : "Neutral";
  }
  async function refreshHoldings(results, settings) {
    let list = [];
    try { if (Array.isArray(appState?.holdings)) list = appState.holdings; } catch {}
    for (const holding of list) {
      try {
        if (holding.ticker === "CASH") { holding.price = 1; holding.quantity = Number(holding.value || 0); holding.lastPriceSource = "Cash"; continue; }
        if (!String(holding.ticker || "").trim() || holding.name === "Open portfolio slot") continue;
        const crypto = holding.category === "Crypto assets" && !["IBIT", "GBTC"].includes(holding.ticker);
        const market = crypto ? null : await providerMarketData(holding.ticker, settings, 365);
        const quote = crypto ? await geckoQuote(holding.ticker) : market.quote;
        applyQuoteToHoldingSafe(holding, quote);
        const history = crypto ? await geckoHistory(holding.ticker, 365) : market.candles.map((candle) => candle.close);
        holding.series = normalizeSeries(history.slice(-60));
        results.updated += 1;
      } catch (error) {
        results.failed += 1;
        results.messages.push(`${holding.ticker}: ${error.message}`);
      }
    }
  }
  async function refreshWatchlist(results, settings) {
    let list = [];
    try { list = Array.isArray(watchlistState) ? watchlistState : JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"); }
    catch { list = []; }
    for (const item of list) {
      try {
        if (item.type === "Crypto" && !["IBIT", "GBTC"].includes(item.ticker)) {
          Object.assign(item, await geckoQuote(item.ticker));
          item.series = normalizeSeries(await geckoHistory(item.ticker, 365));
        } else if (["Stock", "ETF", "Bond", "Commodity", "Currency", "Alternative", "Crypto"].includes(item.type)) {
          const market = await providerMarketData(item.ticker, settings, 365);
          Object.assign(item, market.quote);
          item.series = normalizeSeries(market.candles.slice(-60).map((candle) => candle.close));
        } else { results.skipped += 1; continue; }
        results.updated += 1;
      } catch (error) {
        results.failed += 1;
        results.messages.push(`${item.ticker} watchlist: ${error.message}`);
      }
    }
    try { watchlistState = list; localStorage.setItem(WATCH_KEY, JSON.stringify(list)); if (typeof renderWatchlist === "function") renderWatchlist(); }
    catch { localStorage.setItem(WATCH_KEY, JSON.stringify(list)); }
  }
  async function refreshTechnicals(results, settings) {
    let items = [];
    try {
      const saved = JSON.parse(localStorage.getItem(TECH_KEY));
      items = Array.isArray(saved) && saved.length ? saved : Array.isArray(technicals) ? technicals : [];
    } catch { try { items = Array.isArray(technicals) ? technicals : []; } catch { items = []; } }
    for (const item of items) {
      try {
        if (typeof technicalFromSeries === "function") item = Object.assign(item, technicalFromSeries(item, await providerSeries(item.ticker, settings, 365)));
        results.updated += 1;
      } catch (error) {
        results.failed += 1;
        results.messages.push(`${item.ticker} technicals: ${error.message}`);
      }
    }
    try { technicals.splice(0, technicals.length, ...items); } catch { window.technicals = items; }
    if (items.length) localStorage.setItem(TECH_KEY, JSON.stringify(items));
    if ($("#technicalDataStatus")) { $("#technicalDataStatus").textContent = `${items.length} tracked - ${sourceLabel(settings)} ready`; $("#technicalDataStatus").className = "data-badge positive"; }
    try { if (typeof renderTechnicals === "function") renderTechnicals(); } catch {}
  }
  async function refreshAll(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    saveSettings();
    syncProviderGlobals();
    const settings = readSettings();
    const button = $("#refreshMarketData");
    if (button) { button.disabled = true; button.textContent = "Refreshing..."; }
    setDataStatus(settings, "Refreshing live data");
    const results = { updated: 0, failed: 0, skipped: 0, messages: [] };
    try {
      await refreshIndexes(settings);
      await refreshHoldings(results, settings);
      await refreshTechnicals(results, settings);
      await refreshWatchlist(results, settings);
      try { latestDataStamp = new Date(); latestRecommendations = []; saveState(); renderAll(); ensureProviderControls(); } catch {}
      const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if ($("#marketDataStatus")) { $("#marketDataStatus").textContent = results.updated ? "Live data refreshed" : "Live data needed"; $("#marketDataStatus").className = `data-badge ${results.updated ? "positive" : "negative"}`; }
      if ($("#marketDataSource")) $("#marketDataSource").textContent = `${sourceLabel(settings)} refresh complete`;
      if ($("#marketDataDetail")) $("#marketDataDetail").textContent = results.failed || results.skipped ? `${results.updated} live updates at ${stamp}; ${results.failed + results.skipped} items still need review. ${results.messages[0] || ""}` : `${results.updated} instruments updated at ${stamp}.`;
    } finally {
      if (button) { button.disabled = false; button.textContent = "Refresh Live Data"; }
      window.setTimeout(applyExpandableSections, 80);
    }
  }

  function sectionTarget(config) {
    const container = $(config.selector);
    if (!container) return null;
    return { container, items: Array.from(container.querySelectorAll(config.itemSelector)).filter((item) => !item.classList.contains("empty-state")) };
  }
  function applyExpandableSection(config) {
    const target = sectionTarget(config);
    if (!target) return;
    const expandedNow = expanded.has(config.id);
    target.items.forEach((item, index) => item.classList.toggle("line-item-hidden", !expandedNow && index >= VISIBLE_COUNT));
    const anchor = $(config.anchor) || $(config.selector);
    if (!anchor || target.items.length <= VISIBLE_COUNT) { document.querySelector(`[data-expand-target="${config.id}"]`)?.remove(); return; }
    let button = document.querySelector(`[data-expand-target="${config.id}"]`);
    if (!button) { button = document.createElement("button"); button.type = "button"; button.className = "expand-toggle"; button.dataset.expandTarget = config.id; anchor.insertAdjacentElement("afterend", button); }
    button.textContent = expandedNow ? `Show first ${VISIBLE_COUNT}` : `Show all ${target.items.length}`;
    button.setAttribute("aria-expanded", String(expandedNow));
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
  function applyExpandableSections() { expandableConfigs.forEach(applyExpandableSection); }
  function observeExpandableSections() {
    const observer = new MutationObserver(() => window.setTimeout(applyExpandableSections, 0));
    expandableConfigs.forEach((config) => { const container = $(config.selector); if (container) observer.observe(container, { childList: true }); });
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
  function localSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return localUniverse.map((item) => {
      const ticker = item.ticker.toLowerCase();
      const name = item.name.toLowerCase();
      let score = 0;
      if (ticker === q) score += 100;
      if (ticker.startsWith(q)) score += 60;
      if (name.startsWith(q)) score += 40;
      if (ticker.includes(q)) score += 25;
      if (name.includes(q)) score += 18;
      if (item.type.toLowerCase().includes(q)) score += 10;
      return { ...item, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker)).slice(0, 8).map(({ score, ...item }) => item);
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
  function renderSearchResults(results) {
    const box = searchBox();
    if (!box) return;
    if (!results.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = results.map((item) => `<button type="button" data-provider-result="${html(item.ticker)}" data-provider-name="${html(item.name)}" data-provider-type="${html(item.type)}"><strong>${html(item.ticker)}</strong><span>${html(item.name)}</span><small>${html(item.source)}</small></button>`).join("");
  }
  async function providerSearch(query) {
    const settings = readSettings();
    const key = apiKey(settings);
    const local = localSearch(query);
    if (!key || query.trim().length < 2) return local;
    try {
      if (settings.provider === "finnhub") {
        const payload = await (await fetch(finnhubUrl("/search", { q: query.trim(), exchange: "US" }, key))).json();
        const remote = (payload.result || []).slice(0, 8).map((item) => ({ ticker: String(item.symbol || "").toUpperCase(), name: String(item.description || item.displaySymbol || item.symbol || ""), type: inferType(item.symbol, item.description), source: "Finnhub search" })).filter((item) => item.ticker);
        return mergeResults(local, remote);
      }
      const payload = await (await fetch(makeUrl(ALPHA_URL, { function: "SYMBOL_SEARCH", keywords: query.trim(), apikey: key }))).json();
      const remote = (payload.bestMatches || []).slice(0, 8).map((match) => {
        const ticker = String(match["1. symbol"] || "").toUpperCase();
        const name = String(match["2. name"] || ticker);
        return { ticker, name, type: inferType(ticker, name), source: "Alpha Vantage search" };
      }).filter((item) => item.ticker);
      return mergeResults(local, remote);
    } catch { return local; }
  }
  function mergeResults(primary, secondary) {
    const seen = new Set();
    return [...primary, ...secondary].filter((item) => { const key = String(item.ticker || "").toUpperCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; }).slice(0, 10);
  }
  function bindSearch() {
    const input = $("#watchTicker");
    if (!input || input.dataset.providerSearchBound) return;
    input.dataset.providerSearchBound = "true";
    input.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      const query = input.value.trim();
      searchTimer = window.setTimeout(async () => renderSearchResults(await providerSearch(query)), 260);
    });
    document.addEventListener("click", (event) => {
      const result = event.target.closest("[data-provider-result]");
      if (!result) { if (!event.target.closest("#providerSearchResults") && !event.target.closest("#watchTicker")) searchBox().hidden = true; return; }
      event.preventDefault();
      if ($("#watchTicker")) $("#watchTicker").value = result.dataset.providerResult;
      if ($("#watchName")) $("#watchName").value = result.dataset.providerName || "";
      if ($("#watchType")) $("#watchType").value = result.dataset.providerType || "Stock";
      searchBox().hidden = true;
    });
  }

  function bind() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#saveMarketDataKey")) { event.preventDefault(); event.stopImmediatePropagation(); saveSettings(); }
      if (event.target.closest("#refreshMarketData")) refreshAll(event);
    }, true);
    document.addEventListener("change", (event) => {
      if (event.target.closest("#marketDataProvider")) { const settings = readSettings(); settings.provider = event.target.value; writeSettings(settings); ensureProviderControls(); setDataStatus(settings); }
    });
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-expand-target]");
      if (!toggle) return;
      if (expanded.has(toggle.dataset.expandTarget)) expanded.delete(toggle.dataset.expandTarget); else expanded.add(toggle.dataset.expandTarget);
      applyExpandableSections();
    });
  }
  function init() {
    injectStyles();
    ensureProviderControls();
    setDataStatus();
    syncProviderGlobals();
    bind();
    bindSearch();
    observeExpandableSections();
    renderCachedIndexes();
    window.setTimeout(applyExpandableSections, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();