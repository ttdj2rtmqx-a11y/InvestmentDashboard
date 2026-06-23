const STORAGE_KEY = "investmentDeskPortfolioV2";

const defaultHoldings = [
  { ticker: "VTI", name: "US Total Market ETF", category: "US equities", value: 96420, change: 1.2, bias: "Bullish", risk: 58, target: 24 },
  { ticker: "AAPL", name: "Apple Inc.", category: "US equities", value: 62840, change: 0.8, bias: "Bullish", risk: 74, target: 10 },
  { ticker: "MSFT", name: "Microsoft Corp.", category: "US equities", value: 58110, change: 1.7, bias: "Bullish", risk: 70, target: 10 },
  { ticker: "NVDA", name: "NVIDIA Corp.", category: "US equities", value: 44900, change: -0.6, bias: "Extended", risk: 88, target: 7 },
  { ticker: "BND", name: "Total Bond Market ETF", category: "Fixed income", value: 38720, change: 0.2, bias: "Neutral", risk: 22, target: 14 },
  { ticker: "GLD", name: "Gold Trust", category: "Commodities", value: 21440, change: 0.9, bias: "Bullish", risk: 45, target: 6 },
  { ticker: "VNQ", name: "Real Estate ETF", category: "Real estate", value: 18260, change: 0.4, bias: "Recovery", risk: 61, target: 5 },
  { ticker: "HYG", name: "High Yield Bond ETF", category: "Credit", value: 16880, change: 0.3, bias: "Carry", risk: 48, target: 7 },
  { ticker: "BTC", name: "Bitcoin", category: "Crypto assets", value: 12940, change: 2.1, bias: "Risk cap", risk: 96, target: 3 },
  { ticker: "CASH", name: "Cash and T-bills", category: "Cash", value: 31250, change: 0, bias: "Reserve", risk: 3, target: 7 },
];

const riskProfiles = {
  conservative: {
    label: "Conservative income",
    summary: "Prioritizes liquidity, income, and lower drawdown risk.",
    categoryTargets: {
      "US equities": 24,
      "International equities": 10,
      "Fixed income": 30,
      Credit: 12,
      Commodities: 5,
      "Real estate": 5,
      "Crypto assets": 1,
      Alternatives: 3,
      Cash: 10,
    },
  },
  balanced: {
    label: "Balanced growth",
    summary: "Blends equity growth, income carry, real assets, and cash flexibility.",
    categoryTargets: {
      "US equities": 36,
      "International equities": 14,
      "Fixed income": 18,
      Credit: 8,
      Commodities: 6,
      "Real estate": 5,
      "Crypto assets": 3,
      Alternatives: 3,
      Cash: 7,
    },
  },
  growth: {
    label: "Growth",
    summary: "Tilts toward equities while preserving diversifiers and liquidity.",
    categoryTargets: {
      "US equities": 48,
      "International equities": 16,
      "Fixed income": 10,
      Credit: 5,
      Commodities: 5,
      "Real estate": 5,
      "Crypto assets": 4,
      Alternatives: 2,
      Cash: 5,
    },
  },
  aggressive: {
    label: "Aggressive growth",
    summary: "Maximizes growth exposure with higher volatility and concentration limits.",
    categoryTargets: {
      "US equities": 55,
      "International equities": 18,
      "Fixed income": 6,
      Credit: 3,
      Commodities: 4,
      "Real estate": 4,
      "Crypto assets": 6,
      Alternatives: 1,
      Cash: 3,
    },
  },
};

const categoryColors = {
  "US equities": "#0f8f8c",
  "International equities": "#3867d6",
  "Fixed income": "#1c9a67",
  Credit: "#4f6f52",
  Commodities: "#c88a24",
  "Real estate": "#8f5a3c",
  "Crypto assets": "#7257c8",
  Alternatives: "#546179",
  Cash: "#93a4b5",
};

const technicals = [
  { ticker: "SPY", name: "S&P 500 ETF", category: "US large cap", trend: "Uptrend", rsi: 61, macd: "Bull cross", dma: "+7.8%", atr: "0.9%", signal: "Buy dips" },
  { ticker: "QQQ", name: "Nasdaq 100 ETF", category: "Growth equity", trend: "Uptrend", rsi: 66, macd: "Positive", dma: "+11.2%", atr: "1.2%", signal: "Momentum" },
  { ticker: "IWM", name: "Russell 2000 ETF", category: "Small cap", trend: "Base breakout", rsi: 57, macd: "Improving", dma: "+2.1%", atr: "1.5%", signal: "Watch add" },
  { ticker: "EFA", name: "Developed ex-US ETF", category: "International equity", trend: "Sideways", rsi: 52, macd: "Neutral", dma: "+1.4%", atr: "0.8%", signal: "Neutral" },
  { ticker: "EEM", name: "Emerging Markets ETF", category: "Emerging equity", trend: "Early uptrend", rsi: 55, macd: "Bull cross", dma: "+3.6%", atr: "1.1%", signal: "Accumulating" },
  { ticker: "TLT", name: "20+ Year Treasury ETF", category: "Rates duration", trend: "Downtrend", rsi: 43, macd: "Negative", dma: "-4.8%", atr: "1.4%", signal: "Hedge only" },
  { ticker: "HYG", name: "High Yield Bond ETF", category: "Credit", trend: "Uptrend", rsi: 59, macd: "Positive", dma: "+3.1%", atr: "0.5%", signal: "Carry" },
  { ticker: "GLD", name: "Gold Trust", category: "Precious metals", trend: "Uptrend", rsi: 64, macd: "Positive", dma: "+8.6%", atr: "1.0%", signal: "Trend hold" },
  { ticker: "USO", name: "Oil Fund", category: "Energy commodity", trend: "Volatile range", rsi: 48, macd: "Flat", dma: "-0.9%", atr: "2.4%", signal: "Tactical" },
  { ticker: "VNQ", name: "Real Estate ETF", category: "REITs", trend: "Recovery", rsi: 54, macd: "Improving", dma: "+1.9%", atr: "1.2%", signal: "Income watch" },
  { ticker: "BTC", name: "Bitcoin", category: "Crypto", trend: "Uptrend", rsi: 69, macd: "Positive", dma: "+18.4%", atr: "3.8%", signal: "Risk cap" },
  { ticker: "UUP", name: "US Dollar ETF", category: "Currency", trend: "Uptrend", rsi: 58, macd: "Positive", dma: "+2.7%", atr: "0.4%", signal: "Macro watch" },
];

const watchlist = [
  { ticker: "SCHD", name: "Dividend quality", signal: "Pullback toward 50 DMA", score: 72 },
  { ticker: "GOOGL", name: "Megacap growth", signal: "MACD improving", score: 78 },
  { ticker: "XLE", name: "Energy sector", signal: "Range breakout pending", score: 61 },
  { ticker: "LQD", name: "Investment grade credit", signal: "Spread carry stable", score: 58 },
  { ticker: "DBC", name: "Broad commodities", signal: "Inflation hedge bid", score: 64 },
];

const regimes = [
  { label: "Trend following", state: "Constructive", detail: "Major equity indices remain above rising 50-day averages." },
  { label: "Mean reversion", state: "Selective", detail: "Small caps and REITs offer better reset profiles than mega-cap growth." },
  { label: "Income carry", state: "Attractive", detail: "Credit trend is firm while default stress remains contained." },
  { label: "Macro hedge", state: "Needed", detail: "Dollar and duration volatility argue for gold, cash, and position limits." },
];

const portfolio = [100, 103, 101, 108, 112, 116, 114, 121, 126, 124, 131, 137];
const benchmark = [100, 101, 100, 104, 107, 109, 108, 112, 116, 115, 119, 123];

let appState = loadState();
let latestRecommendations = [];

function loadState() {
  const fallback = {
    holdings: structuredClone(defaultHoldings),
    riskProfile: "balanced",
    cashTarget: 7,
    maxPosition: 18,
    tradeThreshold: 1.5,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.holdings)) return fallback;
    return { ...fallback, ...saved };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function money(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function totalPortfolioValue() {
  return appState.holdings.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function categoryTotals() {
  const total = totalPortfolioValue();
  return appState.holdings.reduce((map, item) => {
    const key = item.category || "Alternatives";
    if (!map[key]) map[key] = { value: 0, weight: 0 };
    map[key].value += Number(item.value || 0);
    map[key].weight = total ? (map[key].value / total) * 100 : 0;
    return map;
  }, {});
}

function currentWeight(item) {
  const total = totalPortfolioValue();
  return total ? (Number(item.value || 0) / total) * 100 : 0;
}

function trendClass(value) {
  if (typeof value === "number") return value >= 0 ? "positive" : "negative";
  const normalized = String(value).toLowerCase();
  if (normalized.includes("bull") || normalized.includes("positive") || normalized.includes("buy") || normalized.includes("uptrend") || normalized.includes("carry")) return "positive";
  if (normalized.includes("down") || normalized.includes("negative") || normalized.includes("hedge") || normalized.includes("trim")) return "negative";
  return "neutral";
}

function currencyTrend(value) {
  const className = trendClass(value);
  const sign = value >= 0 ? "+" : "";
  return `<span class="${className}">${sign}${Number(value).toFixed(1)}%</span>`;
}

function signalPill(label) {
  return `<span class="signal-pill ${trendClass(label)}">${label}</span>`;
}

function rsiPill(rsi) {
  let state = "Neutral";
  if (rsi >= 70) state = "Overbought";
  if (rsi <= 35) state = "Oversold";
  if (rsi > 55 && rsi < 70) state = "Bullish";
  return `<span class="rsi"><strong>${rsi}</strong><small>${state}</small></span>`;
}

function renderHoldings() {
  const rows = appState.holdings
    .map(
      (item, index) => `
        <tr>
          <td>
            <div class="asset-cell editable-asset">
              <span class="ticker">${item.ticker.slice(0, 2)}</span>
              <div>
                <input class="inline-input ticker-input" data-field="ticker" data-index="${index}" value="${item.ticker}" aria-label="Ticker" />
                <input class="inline-input name-input" data-field="name" data-index="${index}" value="${item.name}" aria-label="Asset name" />
              </div>
            </div>
          </td>
          <td>
            <select class="table-select" data-field="category" data-index="${index}" aria-label="Category">
              ${Object.keys(categoryColors)
                .map((category) => `<option value="${category}" ${category === item.category ? "selected" : ""}>${category}</option>`)
                .join("")}
            </select>
          </td>
          <td><input class="number-input" data-field="value" data-index="${index}" type="number" min="0" step="100" value="${Math.round(item.value)}" aria-label="Market value" /></td>
          <td><strong>${pct(currentWeight(item))}</strong></td>
          <td><input class="number-input compact-input" data-field="target" data-index="${index}" type="number" min="0" max="100" step="0.5" value="${item.target}" aria-label="Target weight" /></td>
          <td><input class="number-input compact-input" data-field="risk" data-index="${index}" type="number" min="0" max="100" step="1" value="${item.risk}" aria-label="Risk score" /></td>
          <td>${signalPill(item.bias)}</td>
          <td><button class="icon-button table-action" data-remove="${index}" aria-label="Remove ${item.ticker}" title="Remove holding">×</button></td>
        </tr>
      `
    )
    .join("");

  document.querySelector("#holdingsRows").innerHTML = rows;
}

function renderAllocation() {
  const totals = categoryTotals();
  const profile = riskProfiles[appState.riskProfile];
  const categories = Object.keys(profile.categoryTargets);
  const items = categories
    .map((category) => {
      const actual = totals[category]?.weight || 0;
      const target = profile.categoryTargets[category];
      return `
        <li>
          <span><i style="background:${categoryColors[category]}"></i> ${category}</span>
          <strong>${pct(actual)} / ${pct(target, 0)}</strong>
        </li>
      `;
    })
    .join("");

  let cursor = 0;
  const stops = categories.map((category) => {
    const value = totals[category]?.weight || 0;
    const stop = `${categoryColors[category]} ${cursor}% ${Math.min(100, cursor + value)}%`;
    cursor += value;
    return stop;
  });

  document.querySelector(".donut").style.background = `conic-gradient(${stops.join(", ")})`;
  document.querySelector("#allocationLegend").innerHTML = items;
}

function renderTechnicals() {
  const rows = technicals
    .map(
      (item) => `
        <tr>
          <td>
            <div class="asset-cell">
              <span class="ticker">${item.ticker.slice(0, 2)}</span>
              <div>
                <strong>${item.ticker}</strong><br />
                <span>${item.name}</span>
              </div>
            </div>
          </td>
          <td>${item.category}</td>
          <td>${signalPill(item.trend)}</td>
          <td>${rsiPill(item.rsi)}</td>
          <td>${signalPill(item.macd)}</td>
          <td class="${trendClass(item.dma)}">${item.dma}</td>
          <td>${item.atr}</td>
          <td>${signalPill(item.signal)}</td>
        </tr>
      `
    )
    .join("");

  document.querySelector("#technicalRows").innerHTML = rows;
}

function renderWatchlist() {
  const cards = watchlist
    .map(
      (item) => `
        <div class="watch-card">
          <div>
            <strong>${item.ticker}</strong>
            <small>${item.name}</small>
          </div>
          <div class="signal-score" aria-label="Signal score ${item.score}">
            <span>${item.signal}</span>
            <meter min="0" max="100" value="${item.score}"></meter>
          </div>
        </div>
      `
    )
    .join("");

  document.querySelector("#watchlistCards").innerHTML = cards;
}

function renderRegimes() {
  const cards = regimes
    .map(
      (item) => `
        <div class="regime-card">
          <span>${item.label}</span>
          <strong>${item.state}</strong>
          <small>${item.detail}</small>
        </div>
      `
    )
    .join("");

  document.querySelector("#regimeGrid").innerHTML = cards;
}

function rebalanceModel() {
  const total = totalPortfolioValue();
  const thresholdValue = total * (Number(appState.tradeThreshold) / 100);
  const maxPositionValue = total * (Number(appState.maxPosition) / 100);
  const cashTargetValue = total * (Number(appState.cashTarget) / 100);
  const holdings = appState.holdings;
  const recommendations = [];

  holdings.forEach((item) => {
    const targetValue = total * (Number(item.target || 0) / 100);
    let delta = targetValue - Number(item.value || 0);

    if (item.ticker !== "CASH" && Number(item.value || 0) > maxPositionValue) {
      delta = Math.min(delta, maxPositionValue - Number(item.value || 0));
    }

    if (item.ticker === "CASH") {
      delta = cashTargetValue - Number(item.value || 0);
    }

    if (Math.abs(delta) >= thresholdValue) {
      recommendations.push({
        action: delta > 0 ? "Buy" : "Sell",
        ticker: item.ticker,
        name: item.name,
        amount: Math.abs(delta),
        reason: tradeReason(item, delta),
      });
    }
  });

  const netBuys = recommendations.reduce((sum, trade) => sum + (trade.action === "Buy" ? trade.amount : -trade.amount), 0);
  return { recommendations, projectedCash: Math.max(0, cashTargetValue - netBuys), thresholdValue };
}

function tradeReason(item, delta) {
  const weight = currentWeight(item);
  if (item.ticker === "CASH") return delta > 0 ? "Raise reserve to match cash target." : "Deploy excess cash into target allocation.";
  if (weight > appState.maxPosition) return "Trim concentration above max position limit.";
  if (delta > 0 && trendClass(item.bias) === "positive") return "Below target and technical bias is constructive.";
  if (delta > 0) return "Below target allocation for selected risk profile.";
  if (item.risk > 80) return "Reduce high-volatility exposure toward target.";
  return "Above target allocation after risk-profile update.";
}

function renderRecommendations(runModel = false) {
  if (runModel) {
    latestRecommendations = rebalanceModel().recommendations;
    document.querySelector("#rebalanceStatus").textContent = "Model updated";
  }

  const trades = latestRecommendations;
  const rows = trades.length
    ? trades
        .map(
          (trade) => `
            <tr>
              <td>${signalPill(trade.action)}</td>
              <td><strong>${trade.ticker}</strong><br /><span>${trade.name}</span></td>
              <td>${money(trade.amount)}</td>
              <td>${trade.reason}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="4" class="empty-state">Run Rebalance to generate trade recommendations.</td></tr>`;

  const projectedCash = runModel ? rebalanceModel().projectedCash : appState.holdings.find((item) => item.ticker === "CASH")?.value || 0;

  document.querySelector("#tradeRows").innerHTML = rows;
  document.querySelector("#tradeCount").textContent = trades.length;
  document.querySelector("#tradeSummary").textContent = trades.length ? `${trades.filter((trade) => trade.action === "Buy").length} buys and ${trades.filter((trade) => trade.action === "Sell").length} sells suggested.` : "Run the model to calculate recommendations.";
  document.querySelector("#recommendationCount").textContent = `${trades.length} actions`;
  document.querySelector("#projectedCash").textContent = money(projectedCash);
}

function renderTargetBars() {
  const totals = categoryTotals();
  const targets = riskProfiles[appState.riskProfile].categoryTargets;
  const bars = Object.keys(targets)
    .map((category) => {
      const actual = totals[category]?.weight || 0;
      const target = targets[category];
      const drift = actual - target;
      return `
        <div class="target-bar">
          <div>
            <strong>${category}</strong>
            <span>${pct(actual)} current · ${pct(target, 0)} target · ${drift >= 0 ? "+" : ""}${pct(drift)}</span>
          </div>
          <div class="bar-track">
            <i style="width:${Math.min(100, actual)}%; background:${categoryColors[category]}"></i>
            <b style="left:${Math.min(100, target)}%"></b>
          </div>
        </div>
      `;
    })
    .join("");

  const avgDrift = Object.keys(targets).reduce((sum, category) => sum + Math.abs((totals[category]?.weight || 0) - targets[category]), 0) / Object.keys(targets).length;
  document.querySelector("#targetBars").innerHTML = bars;
  document.querySelector("#allocationHealth").textContent = avgDrift < 2 ? "Close to model" : avgDrift < 5 ? "Moderate drift" : "Rebalance due";
}

function updateRiskMeters() {
  const total = totalPortfolioValue();
  const weightedRisk = total ? appState.holdings.reduce((sum, item) => sum + (Number(item.value || 0) / total) * Number(item.risk || 0), 0) : 0;
  const weights = appState.holdings.map(currentWeight);
  const maxWeight = Math.max(...weights, 0);
  const cashWeight = currentWeight(appState.holdings.find((item) => item.ticker === "CASH") || { value: 0 });
  const cryptoWeight = appState.holdings.filter((item) => item.category === "Crypto assets").reduce((sum, item) => sum + currentWeight(item), 0);
  const commodityWeight = appState.holdings.filter((item) => item.category === "Commodities").reduce((sum, item) => sum + currentWeight(item), 0);

  const concentration = Math.min(100, maxWeight * 3.2);
  const liquidity = Math.max(10, Math.min(100, 70 + cashWeight * 2 - cryptoWeight * 1.5));
  const macro = Math.min(100, weightedRisk * 0.55 + commodityWeight * 2.5 + cryptoWeight * 2);

  document.querySelector("#riskScore").textContent = Math.round(weightedRisk);
  document.querySelector("#riskSummary").textContent = riskProfiles[appState.riskProfile].summary;
  updateMeter("volatility", weightedRisk);
  updateMeter("concentration", concentration);
  updateMeter("liquidity", liquidity, true);
  updateMeter("macro", macro);
}

function updateMeter(name, value, inverse = false) {
  const meter = document.querySelector(`#${name}Meter`);
  const label = document.querySelector(`#${name}Label`);
  meter.value = Math.round(value);
  const score = inverse ? 100 - value : value;
  label.textContent = score < 35 ? "Strong" : score < 65 ? "Moderate" : score < 82 ? "Elevated" : "High";
}

function renderSummary() {
  const total = totalPortfolioValue();
  const cashHolding = appState.holdings.find((item) => item.ticker === "CASH");
  const cashValue = cashHolding?.value || 0;
  const cashPct = total ? (cashValue / total) * 100 : 0;
  const maxDrift = Math.max(...appState.holdings.map((item) => Math.abs(currentWeight(item) - Number(item.target || 0))), 0);
  const signalBreadth = Math.round((appState.holdings.filter((item) => trendClass(item.bias) === "positive").length / appState.holdings.length) * 100);

  document.querySelector("#totalValue").textContent = money(total);
  document.querySelector("#cashReserve").textContent = money(cashValue);
  document.querySelector("#cashWeight").textContent = `${pct(cashPct)} dry powder`;
  document.querySelector("#portfolioDrift").textContent = `${pct(maxDrift)} max position drift`;
  document.querySelector("#signalBreadth").textContent = `${signalBreadth}%`;
}

function makePath(points, width, height, padding) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  return points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / (points.length - 1);
      const y = height - padding - ((point - min) / (max - min)) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function renderChart() {
  const svg = document.querySelector("#lineChart");
  const width = 720;
  const height = 300;
  const padding = 36;
  const portfolioPath = makePath(portfolio, width, height, padding);
  const benchmarkPath = makePath(benchmark, width, height, padding);
  const areaPath = `${portfolioPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  const gridlines = [0, 1, 2, 3]
    .map((index) => {
      const y = padding + index * ((height - padding * 2) / 3);
      return `<line class="gridline" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
    })
    .join("");

  svg.innerHTML = `
    ${gridlines}
    <path class="area-fill" d="${areaPath}" />
    <path class="line-benchmark" d="${benchmarkPath}" />
    <path class="line-portfolio" d="${portfolioPath}" />
    <circle cx="${width - padding}" cy="54" r="6" fill="#0f8f8c" />
    <text x="${width - padding - 110}" y="58" fill="#17202a" font-size="14" font-weight="800">Portfolio</text>
    <circle cx="${width - padding}" cy="82" r="6" fill="#c88a24" />
    <text x="${width - padding - 110}" y="86" fill="#17202a" font-size="14" font-weight="800">Benchmark</text>
  `;
}

function syncControls() {
  document.querySelector("#riskProfile").value = appState.riskProfile;
  document.querySelector("#cashTarget").value = appState.cashTarget;
  document.querySelector("#maxPosition").value = appState.maxPosition;
  document.querySelector("#tradeThreshold").value = appState.tradeThreshold;
  document.querySelector("#cashTargetOutput").textContent = pct(Number(appState.cashTarget), 0);
  document.querySelector("#maxPositionOutput").textContent = pct(Number(appState.maxPosition), 0);
  document.querySelector("#tradeThresholdOutput").textContent = pct(Number(appState.tradeThreshold));
}

function renderAll(options = {}) {
  syncControls();
  renderHoldings();
  renderAllocation();
  renderTargetBars();
  renderSummary();
  updateRiskMeters();
  renderRecommendations(options.runModel);
}

function updateHolding(index, field, rawValue) {
  const item = appState.holdings[index];
  if (!item) return;
  if (["value", "target", "risk"].includes(field)) {
    item[field] = Number(rawValue || 0);
  } else {
    item[field] = rawValue;
  }
  if (field === "ticker") item.ticker = rawValue.toUpperCase();
  latestRecommendations = [];
  saveState();
  renderAll();
}

function addHolding() {
  appState.holdings.push({
    ticker: "NEW",
    name: "New position",
    category: "US equities",
    value: 10000,
    change: 0,
    bias: "Neutral",
    risk: 55,
    target: 2,
  });
  latestRecommendations = [];
  saveState();
  renderAll();
}

function removeHolding(index) {
  appState.holdings.splice(index, 1);
  saveState();
  latestRecommendations = [];
  renderAll();
}

function applyProfileTargets(profileName) {
  const targets = riskProfiles[profileName].categoryTargets;
  const categoryGroups = appState.holdings.reduce((map, item) => {
    if (!map[item.category]) map[item.category] = [];
    map[item.category].push(item);
    return map;
  }, {});

  Object.entries(categoryGroups).forEach(([category, items]) => {
    const categoryTarget = targets[category] || 0;
    const totalCurrent = items.reduce((sum, item) => sum + currentWeight(item), 0) || items.length;
    items.forEach((item) => {
      const currentShare = totalCurrent ? currentWeight(item) / totalCurrent : 1 / items.length;
      item.target = Number((categoryTarget * currentShare).toFixed(1));
    });
  });
}

function bindEvents() {
  document.querySelector("#holdingsRows").addEventListener("change", (event) => {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    if (field) updateHolding(index, field, event.target.value);
  });

  document.querySelector("#holdingsRows").addEventListener("click", (event) => {
    const removeIndex = event.target.dataset.remove;
    if (removeIndex !== undefined) removeHolding(Number(removeIndex));
  });

  document.querySelector("#addHolding").addEventListener("click", addHolding);

  document.querySelector("#riskProfile").addEventListener("change", (event) => {
    appState.riskProfile = event.target.value;
    applyProfileTargets(appState.riskProfile);
    latestRecommendations = [];
    saveState();
    renderAll();
  });

  ["cashTarget", "maxPosition", "tradeThreshold"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      appState[id] = Number(event.target.value);
      latestRecommendations = [];
      saveState();
      renderAll();
    });
  });

  document.querySelector("#runRebalance").addEventListener("click", () => renderAll({ runModel: true }));
  document.querySelector("#runRebalanceTop").addEventListener("click", () => {
    document.querySelector("#rebalance").scrollIntoView({ behavior: "smooth", block: "start" });
    renderAll({ runModel: true });
  });

  document.querySelector("#resetPortfolio").addEventListener("click", () => {
    appState = {
      holdings: structuredClone(defaultHoldings),
      riskProfile: "balanced",
      cashTarget: 7,
      maxPosition: 18,
      tradeThreshold: 1.5,
    };
    latestRecommendations = [];
    saveState();
    renderAll();
  });
}

renderTechnicals();
renderWatchlist();
renderRegimes();
renderChart();
bindEvents();
renderAll();
