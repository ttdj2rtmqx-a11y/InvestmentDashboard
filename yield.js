(function () {
  const PORTFOLIO_STORAGE_KEY = "investmentDeskPortfolioV2";
  const YIELD_SETTINGS_KEY = "investmentDeskYieldSettingsV1";

  const fallbackHoldings = [
    { ticker: "VTI", name: "US Total Market ETF", category: "US equities", value: 96420 },
    { ticker: "AAPL", name: "Apple Inc.", category: "US equities", value: 62840 },
    { ticker: "MSFT", name: "Microsoft Corp.", category: "US equities", value: 58110 },
    { ticker: "NVDA", name: "NVIDIA Corp.", category: "US equities", value: 44900 },
    { ticker: "BND", name: "Total Bond Market ETF", category: "Fixed income", value: 38720 },
    { ticker: "GLD", name: "Gold Trust", category: "Commodities", value: 21440 },
    { ticker: "VNQ", name: "Real Estate ETF", category: "Real estate", value: 18260 },
    { ticker: "HYG", name: "High Yield Bond ETF", category: "Credit", value: 16880 },
    { ticker: "BTC", name: "Bitcoin", category: "Crypto assets", value: 12940 },
    { ticker: "CASH", name: "Cash and T-bills", category: "Cash", value: 31250 },
  ];

  const yieldByTicker = {
    AAPL: 0.5,
    BND: 4.2,
    CASH: 4.8,
    GLD: 0,
    HYG: 6.1,
    MSFT: 0.7,
    NVDA: 0.1,
    VNQ: 3.9,
    VTI: 1.4,
    BTC: 0,
  };

  const yieldByCategory = {
    "US equities": 1.3,
    "International equities": 2.8,
    "Fixed income": 4.3,
    Credit: 6.0,
    Commodities: 0.4,
    "Real estate": 4.0,
    "Crypto assets": 0,
    Alternatives: 3.5,
    Cash: 4.8,
  };

  const categoryColors = {
    "US equities": "#0a84ff",
    "International equities": "#3867d6",
    "Fixed income": "#1f9d63",
    Credit: "#4f6f52",
    Commodities: "#c48a22",
    "Real estate": "#8f5a3c",
    "Crypto assets": "#7c5cff",
    Alternatives: "#546179",
    Cash: "#93a4b5",
  };

  const scenarios = {
    base: { label: "Base case", rateShift: 0, creditShift: 0, equityShift: 0, range: 0.08 },
    falling: { label: "Rates -100 bps", rateShift: -0.65, creditShift: -0.35, equityShift: 0.05, range: 0.09 },
    rising: { label: "Rates +100 bps", rateShift: 0.8, creditShift: 0.45, equityShift: 0.05, range: 0.1 },
    stress: { label: "Credit stress", rateShift: 0.35, creditShift: 1.3, equityShift: -0.1, range: 0.16 },
  };

  let yieldSettings = loadSettings();

  const $ = (selector) => document.querySelector(selector);

  function money(value) {
    return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function pct(value, digits = 1) {
    return `${Number(value || 0).toFixed(digits)}%`;
  }

  function loadSettings() {
    try {
      return { scenario: "base", reinvestmentRate: 50, horizon: 12, ...JSON.parse(localStorage.getItem(YIELD_SETTINGS_KEY)) };
    } catch {
      return { scenario: "base", reinvestmentRate: 50, horizon: 12 };
    }
  }

  function saveSettings() {
    localStorage.setItem(YIELD_SETTINGS_KEY, JSON.stringify(yieldSettings));
  }

  function loadHoldings() {
    try {
      const saved = JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY));
      const holdings = Array.isArray(saved?.holdings) ? saved.holdings : fallbackHoldings;
      return holdings.filter((item) => {
        const ticker = String(item.ticker || "").trim();
        return ticker && item.name !== "Open portfolio slot" && Number(item.value || 0) > 0;
      });
    } catch {
      return fallbackHoldings;
    }
  }

  function baseYieldFor(item) {
    const ticker = String(item.ticker || "").toUpperCase();
    if (yieldByTicker[ticker] !== undefined) return yieldByTicker[ticker];
    return yieldByCategory[item.category] ?? 2.5;
  }

  function scenarioYield(item) {
    const scenario = scenarios[yieldSettings.scenario] || scenarios.base;
    const category = item.category || "";
    let adjustment = scenario.equityShift;
    if (category === "Fixed income" || category === "Cash") adjustment = scenario.rateShift;
    if (category === "Credit") adjustment = scenario.creditShift;
    if (category === "Real estate") adjustment = scenario.rateShift * 0.35;
    if (category === "Crypto assets" || category === "Commodities") adjustment = 0;
    return Math.max(0, baseYieldFor(item) + adjustment);
  }

  function forecastRows() {
    const holdings = loadHoldings();
    const rows = holdings.map((item) => {
      const value = Number(item.value || 0);
      const yieldRate = scenarioYield(item);
      const income = value * (yieldRate / 100);
      return { ...item, value, yieldRate, income };
    });
    const totalValue = rows.reduce((sum, item) => sum + item.value, 0);
    const annualIncome = rows.reduce((sum, item) => sum + item.income, 0);
    const weightedYield = totalValue ? (annualIncome / totalValue) * 100 : 0;
    return { rows, totalValue, annualIncome, weightedYield };
  }

  function buildMonthlyForecast(annualIncome) {
    const horizon = Number(yieldSettings.horizon || 12);
    const reinvestment = Number(yieldSettings.reinvestmentRate || 0) / 100;
    const scenario = scenarios[yieldSettings.scenario] || scenarios.base;
    const monthlyBase = annualIncome / 12;
    return Array.from({ length: horizon }, (_, index) => {
      const compounding = 1 + (reinvestment * 0.018 * index) / 12;
      const seasonal = 1 + Math.sin(index / 2.2) * 0.018;
      const mid = monthlyBase * compounding * seasonal;
      return {
        month: index + 1,
        low: mid * (1 - scenario.range),
        mid,
        high: mid * (1 + scenario.range),
      };
    });
  }

  function makePath(points, key, width, height, padding) {
    const values = points.map((point) => point[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
        const y = height - padding - ((point[key] - min) / range) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function renderChart(monthly) {
    const svg = $("#yieldForecastChart");
    if (!svg) return;
    const width = 720;
    const height = 260;
    const padding = 30;
    const highPath = makePath(monthly, "high", width, height, padding);
    const lowPath = makePath([...monthly].reverse(), "low", width, height, padding);
    const midPath = makePath(monthly, "mid", width, height, padding);
    const gridlines = [0, 1, 2, 3]
      .map((index) => {
        const y = padding + index * ((height - padding * 2) / 3);
        return `<line class="gridline" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
      })
      .join("");

    svg.innerHTML = `
      ${gridlines}
      <path class="yield-forecast-band" d="${highPath} ${lowPath} Z"></path>
      <path class="yield-forecast-line" d="${midPath}"></path>
      <text x="${padding}" y="${height - 8}" fill="#6b7280" font-size="12" font-weight="800">Month 1</text>
      <text x="${width - 108}" y="${height - 8}" fill="#6b7280" font-size="12" font-weight="800">Month ${monthly.length}</text>
    `;
  }

  function renderBars(rows, annualIncome) {
    const categoryMap = rows.reduce((map, item) => {
      const category = item.category || "Alternatives";
      map[category] = (map[category] || 0) + item.income;
      return map;
    }, {});
    const entries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    const topShare = annualIncome ? (entries[0]?.[1] || 0) / annualIncome : 0;
    $("#yieldConcentration").textContent = topShare > 0.55 ? "Concentrated" : topShare > 0.35 ? "Moderate" : "Diversified";
    $("#yieldBars").innerHTML = entries
      .map(([category, income]) => {
        const share = annualIncome ? (income / annualIncome) * 100 : 0;
        return `
          <div class="yield-bar">
            <div>
              <strong>${category}</strong>
              <span>${money(income)} / ${pct(share, 0)}</span>
            </div>
            <div class="yield-track"><i style="width:${Math.max(4, share)}%; background:${categoryColors[category] || "#546179"}"></i></div>
          </div>
        `;
      })
      .join("");
  }

  function renderTable(rows, annualIncome) {
    $("#yieldRows").innerHTML = rows
      .sort((a, b) => b.income - a.income)
      .map((item) => {
        const share = annualIncome ? (item.income / annualIncome) * 100 : 0;
        return `
          <tr>
            <td>
              <div class="asset-cell">
                <span class="ticker">${String(item.ticker || "").slice(0, 2)}</span>
                <div>
                  <strong>${item.ticker || "N/A"}</strong><br />
                  <span>${item.name || "Holding"}</span>
                </div>
              </div>
            </td>
            <td>${item.category || "Other"}</td>
            <td>${money(item.value)}</td>
            <td><strong>${pct(item.yieldRate)}</strong></td>
            <td><strong>${money(item.income)}</strong></td>
            <td>${pct(share)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderYieldForecast() {
    if (!$("#yield-forecast")) return;
    const { rows, totalValue, annualIncome, weightedYield } = forecastRows();
    const monthly = buildMonthlyForecast(annualIncome);
    const horizonIncome = monthly.reduce((sum, item) => sum + item.mid, 0);
    const low = monthly.reduce((sum, item) => sum + item.low, 0);
    const high = monthly.reduce((sum, item) => sum + item.high, 0);
    const scenario = scenarios[yieldSettings.scenario] || scenarios.base;

    $("#portfolioYield").textContent = pct(weightedYield);
    $("#annualIncome").textContent = money(horizonIncome);
    $("#monthlyIncome").textContent = `${money(annualIncome / 12)} monthly run-rate`;
    $("#incomeRange").textContent = `${money(low)} - ${money(high)}`;
    $("#incomeRangeNote").textContent = `${scenario.label} over ${yieldSettings.horizon} months.`;
    $("#yieldScenarioLabel").textContent = scenario.label;
    $("#yieldQuality").textContent = `${rows.length} holdings, ${money(totalValue)} linked to the current portfolio.`;
    $("#yieldStatus").textContent = `${rows.length} holdings analyzed`;
    $("#rateScenario").value = yieldSettings.scenario;
    $("#reinvestmentRate").value = yieldSettings.reinvestmentRate;
    $("#reinvestmentOutput").textContent = pct(yieldSettings.reinvestmentRate, 0);
    $("#incomeHorizon").value = String(yieldSettings.horizon);

    renderChart(monthly);
    renderBars(rows, annualIncome);
    renderTable(rows, annualIncome);
  }

  function bindYieldForecast() {
    $("#rateScenario")?.addEventListener("change", (event) => {
      yieldSettings.scenario = event.target.value;
      saveSettings();
      renderYieldForecast();
    });
    $("#reinvestmentRate")?.addEventListener("input", (event) => {
      yieldSettings.reinvestmentRate = Number(event.target.value);
      saveSettings();
      renderYieldForecast();
    });
    $("#incomeHorizon")?.addEventListener("change", (event) => {
      yieldSettings.horizon = Number(event.target.value);
      saveSettings();
      renderYieldForecast();
    });
    document.addEventListener("change", (event) => {
      if (event.target.closest("#holdingsRows")) window.setTimeout(renderYieldForecast, 50);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("#addHolding") || event.target.closest("#resetPortfolio") || event.target.closest("[data-remove]")) {
        window.setTimeout(renderYieldForecast, 120);
      }
    });
  }

  function initYieldForecast() {
    if (!$("#yield-forecast")) return;
    renderYieldForecast();
    bindYieldForecast();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initYieldForecast);
  else initYieldForecast();
})();
