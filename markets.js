(function () {
  const DATA_SETTINGS_KEY = "investmentDeskDataSettingsV1";
  const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
  const indexModels = [
    { symbol: "SPY", label: "S&P 500", color: "#0a84ff", series: [100, 101.2, 100.4, 102.6, 104.1, 103.7, 105.2, 107.1, 108.4, 107.8, 110.2, 111.6] },
    { symbol: "QQQ", label: "Nasdaq 100", color: "#7c5cff", series: [100, 102.6, 101.7, 105.4, 107.9, 109.2, 108.6, 112.8, 115.4, 114.6, 118.9, 121.2] },
    { symbol: "DIA", label: "Dow 30", color: "#1f9d63", series: [100, 100.6, 100.1, 101.3, 102.2, 102.8, 103.4, 104.2, 105.5, 105.1, 106.7, 107.4] },
    { symbol: "IWM", label: "Russell 2000", color: "#c48a22", series: [100, 99.2, 98.5, 100.7, 101.5, 99.9, 102.1, 103.8, 102.7, 104.6, 106.3, 105.8] },
    { symbol: "EFA", label: "Developed ex-US", color: "#3867d6", series: [100, 100.3, 99.7, 101.1, 102.4, 101.8, 103.2, 104.1, 105.2, 104.7, 106.1, 107.0] },
  ];
  let indexState = indexModels.map((item) => ({ ...item, source: "Sample" }));

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
    const riskTone = averagePeriod > 8 && positive >= 4 ? "Risk-on" : averagePeriod > 2 && positive >= 3 ? "Constructive" : positive >= 3 ? "Mixed" : "Defensive";
    $("#indexRiskTone").textContent = riskTone;
    $("#indexRiskDetail").textContent = `${positive} of ${metrics.length} indexes are positive on the latest session.`;
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
      setIndexStatus("Sample index data", "neutral");
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
        updated.push({ ...item, source: "Sample fallback" });
      }
    }
    indexState = updated;
    renderIndexCards();
    setIndexStatus(updated.some((item) => item.source === "Alpha Vantage") ? "Live index data" : "Sample fallback", updated.some((item) => item.source === "Alpha Vantage") ? "positive" : "negative");
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
