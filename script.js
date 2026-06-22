const holdings = [
  { ticker: "VTI", name: "US Total Market ETF", value: "$96,420", weight: "22.5%", change: 1.2, bias: "Bullish" },
  { ticker: "AAPL", name: "Apple Inc.", value: "$62,840", weight: "14.7%", change: 0.8, bias: "Bullish" },
  { ticker: "MSFT", name: "Microsoft Corp.", value: "$58,110", weight: "13.5%", change: 1.7, bias: "Bullish" },
  { ticker: "NVDA", name: "NVIDIA Corp.", value: "$44,900", weight: "10.5%", change: -0.6, bias: "Extended" },
  { ticker: "BND", name: "Total Bond Market ETF", value: "$38,720", weight: "9.0%", change: 0.2, bias: "Neutral" },
  { ticker: "GLD", name: "Gold Trust", value: "$21,440", weight: "5.0%", change: 0.9, bias: "Bullish" },
];

const allocation = [
  { label: "US equities", value: 32, color: "#0f8f8c" },
  { label: "International equities", value: 15, color: "#3867d6" },
  { label: "Fixed income", value: 14, color: "#1c9a67" },
  { label: "Credit and preferreds", value: 8, color: "#4f6f52" },
  { label: "Commodities", value: 7, color: "#c88a24" },
  { label: "Real estate", value: 6, color: "#8f5a3c" },
  { label: "Crypto assets", value: 4, color: "#7257c8" },
  { label: "Alternatives", value: 7, color: "#546179" },
  { label: "Cash and T-bills", value: 7, color: "#93a4b5" },
];

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

function trendClass(value) {
  if (typeof value === "number") {
    return value >= 0 ? "positive" : "negative";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("bull") || normalized.includes("positive") || normalized.includes("buy") || normalized.includes("uptrend")) {
    return "positive";
  }
  if (normalized.includes("down") || normalized.includes("negative") || normalized.includes("hedge")) {
    return "negative";
  }
  return "neutral";
}

function currencyTrend(value) {
  const className = trendClass(value);
  const sign = value >= 0 ? "+" : "";
  return `<span class="${className}">${sign}${value.toFixed(1)}%</span>`;
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
  const rows = holdings
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
          <td>${item.value}</td>
          <td>${item.weight}</td>
          <td>${currencyTrend(item.change)}</td>
          <td>${signalPill(item.bias)}</td>
        </tr>
      `
    )
    .join("");

  document.querySelector("#holdingsRows").innerHTML = rows;
}

function renderAllocation() {
  const items = allocation
    .map(
      (item) => `
        <li>
          <span><i style="background:${item.color}"></i> ${item.label}</span>
          <strong>${item.value}%</strong>
        </li>
      `
    )
    .join("");

  const stops = [];
  let cursor = 0;
  allocation.forEach((item) => {
    stops.push(`${item.color} ${cursor}% ${cursor + item.value}%`);
    cursor += item.value;
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

renderHoldings();
renderAllocation();
renderTechnicals();
renderWatchlist();
renderRegimes();
renderChart();
