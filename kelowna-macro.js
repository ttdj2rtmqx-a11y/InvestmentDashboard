(function () {
  if (window.__investmentDeskKelownaMacro) return;
  window.__investmentDeskKelownaMacro = true;

  const STATCAN_WDS_URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods";
  const CACHE_KEY = "investmentDeskKelownaMacroV1";

  const SERIES = [
    {
      key: "unemployment",
      label: "Unemployment rate",
      vectorId: 1643280566,
      latestN: 18,
      cadence: "Monthly",
      source: "StatCan 14-10-0459-01",
      unit: "rate",
      lowerIsBetter: true,
      chart: true,
      color: "#d94f4f",
    },
    {
      key: "employmentRate",
      label: "Employment rate",
      vectorId: 1643280582,
      latestN: 18,
      cadence: "Monthly",
      source: "StatCan 14-10-0459-01",
      unit: "rate",
      chart: true,
      color: "#1f9d63",
    },
    {
      key: "participationRate",
      label: "Participation rate",
      vectorId: 1643280574,
      latestN: 18,
      cadence: "Monthly",
      source: "StatCan 14-10-0459-01",
      unit: "rate",
      chart: true,
      color: "#0a84ff",
    },
    {
      key: "employment",
      label: "Employment",
      vectorId: 1643280550,
      latestN: 18,
      cadence: "Monthly",
      source: "StatCan 14-10-0459-01",
      unit: "thousandPeople",
    },
    {
      key: "labourForce",
      label: "Labour force",
      vectorId: 1643280542,
      latestN: 18,
      cadence: "Monthly",
      source: "StatCan 14-10-0459-01",
      unit: "thousandPeople",
    },
    {
      key: "workingAgePopulation",
      label: "15+ population",
      vectorId: 1643280534,
      latestN: 18,
      cadence: "Monthly",
      source: "StatCan 14-10-0459-01",
      unit: "thousandPeople",
    },
    {
      key: "cmaPopulation",
      label: "CMA population",
      vectorId: 1589915637,
      latestN: 6,
      cadence: "Annual",
      source: "StatCan 17-10-0148-01",
      unit: "people",
    },
    {
      key: "housingStarts",
      label: "Housing starts",
      vectorId: 42135837,
      latestN: 18,
      cadence: "Monthly",
      source: "CMHC via StatCan 34-10-0154-01",
      unit: "units",
    },
    {
      key: "housingSaar",
      label: "Starts SAAR",
      vectorId: 73880798,
      latestN: 18,
      cadence: "Monthly",
      source: "CMHC via StatCan 34-10-0156-01",
      unit: "saarUnits",
      multiplier: 1000,
    },
    {
      key: "vacancyRate",
      label: "Apartment vacancy",
      vectorId: 42135251,
      latestN: 8,
      cadence: "Annual",
      source: "CMHC via StatCan 34-10-0127-01",
      unit: "rate",
    },
  ];

  const $ = (selector) => document.querySelector(selector);

  const state = {
    series: {},
    loadedAt: null,
    cached: false,
  };

  function html(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatPeriod(dateText, cadence) {
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(dateText || "Latest");
    if (cadence === "Annual") return String(date.getUTCFullYear());
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }

  function normalizePoints(definition, points) {
    return (points || [])
      .map((point) => {
        const rawValue = toNumber(point.value);
        if (rawValue === null) return null;
        const refPer = point.refPerRaw || point.refPer;
        return {
          date: refPer,
          period: formatPeriod(refPer, definition.cadence),
          value: rawValue * (definition.multiplier || 1),
          releaseTime: point.releaseTime || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(`${a.date}T00:00:00`) - new Date(`${b.date}T00:00:00`));
  }

  function latest(key) {
    const points = state.series[key] || [];
    return points[points.length - 1] || null;
  }

  function previous(key) {
    const points = state.series[key] || [];
    return points[points.length - 2] || null;
  }

  function formatValue(definition, value) {
    if (!Number.isFinite(value)) return "--";
    if (definition.unit === "rate") return `${value.toFixed(1)}%`;
    if (definition.unit === "thousandPeople") return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
    if (definition.unit === "people") return Math.round(value).toLocaleString("en-US");
    if (definition.unit === "saarUnits") return `${Math.round(value).toLocaleString("en-US")} SAAR`;
    return Math.round(value).toLocaleString("en-US");
  }

  function formatDelta(definition, delta) {
    if (!Number.isFinite(delta)) return "Awaiting trend";
    const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
    const absolute = Math.abs(delta);
    if (definition.unit === "rate") return `${sign}${absolute.toFixed(1)} pp`;
    if (definition.unit === "thousandPeople") return `${sign}${absolute.toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
    return `${sign}${Math.round(absolute).toLocaleString("en-US")}`;
  }

  function trendClass(definition, delta) {
    if (!Number.isFinite(delta) || delta === 0) return "neutral";
    const improving = definition.lowerIsBetter ? delta < 0 : delta > 0;
    return improving ? "positive" : "negative";
  }

  function setStatus(label, tone = "neutral") {
    const badge = $("#kelownaMacroStatus");
    if (!badge) return;
    badge.textContent = label;
    badge.className = `data-badge ${tone}`;
  }

  function ensureStyles() {
    if ($("#kelownaMacroDynamicStyles")) return;
    const style = document.createElement("style");
    style.id = "kelownaMacroDynamicStyles";
    style.textContent = `
      .kelowna-panel{display:grid;gap:14px}
      .kelowna-macro-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .kelowna-macro-grid.collapsed .kelowna-card:nth-child(n+6){display:none}
      .kelowna-card{min-width:0;min-height:130px;padding:13px;display:grid;align-content:space-between;gap:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.64)}
      .kelowna-card span,.kelowna-insight-card span,.kelowna-chart-card span{color:var(--muted);font-size:.75rem;font-weight:800;text-transform:uppercase}
      .kelowna-card strong{overflow-wrap:anywhere;font-size:1.35rem;line-height:1.1}
      .kelowna-card small,.kelowna-insight-card small{color:var(--muted);line-height:1.42}
      .kelowna-card-trend{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.82rem;font-weight:800}
      .kelowna-expand{justify-self:start}
      .kelowna-macro-detail{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr);gap:12px}
      .kelowna-chart-card,.kelowna-insight-card{min-width:0;padding:14px;display:grid;gap:12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.58)}
      #kelownaMacroChart{width:100%;min-height:210px}
      .kelowna-line{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
      .kelowna-gridline{stroke:rgba(17,24,39,.08);stroke-width:1}
      .kelowna-chart-label{fill:var(--muted);font-size:12px;font-weight:800}
      .kelowna-insight-card>div:first-child{display:grid;gap:6px}
      #kelownaMacroDrivers{margin:0;padding-left:18px;display:grid;gap:8px;color:var(--ink);font-size:.88rem;line-height:1.45}
      #kelownaMacroSources a{color:var(--teal);font-weight:800;text-decoration:none}
      @media(max-width:1080px){.kelowna-macro-detail{grid-template-columns:1fr}.kelowna-macro-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:720px){.kelowna-macro-grid{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function ensurePanel() {
    if ($("#kelowna-macro")) return true;
    const dataPanel = $("#data");
    if (!dataPanel?.parentElement) return false;
    if (!document.querySelector('a[href="#kelowna-macro"]')) {
      const dataLink = document.querySelector('a[href="#data"]');
      dataLink?.insertAdjacentHTML("afterend", '<a href="#kelowna-macro">Kelowna</a>');
    }
    dataPanel.insertAdjacentHTML("afterend", `
      <article class="panel wide-panel kelowna-panel" id="kelowna-macro">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Kelowna macro</p>
            <h2>Local economic dashboard</h2>
          </div>
          <div class="panel-actions">
            <span class="data-badge" id="kelownaMacroStatus">Loading public data</span>
            <button class="text-button" id="refreshKelownaMacro">Refresh</button>
          </div>
        </div>
        <div class="kelowna-macro-grid collapsed" id="kelownaMacroCards"></div>
        <button class="text-button kelowna-expand" id="toggleKelownaMetrics">Show all metrics</button>
        <div class="kelowna-macro-detail">
          <section class="kelowna-chart-card" aria-label="Kelowna labour market trend">
            <div class="subheader">
              <h3>Labour market trend</h3>
              <span id="kelownaMacroDate">Awaiting source</span>
            </div>
            <svg id="kelownaMacroChart" viewBox="0 0 720 240" role="img" aria-label="Kelowna labour market chart"></svg>
          </section>
          <section class="kelowna-insight-card" aria-label="Kelowna macro interpretation">
            <div>
              <span>Macro read</span>
              <strong id="kelownaMacroLens">Loading</strong>
              <small id="kelownaMacroSummary">Connecting to open public data sources.</small>
            </div>
            <ul id="kelownaMacroDrivers"></ul>
            <small id="kelownaMacroSources">Statistics Canada Web Data Service</small>
          </section>
        </div>
      </article>
    `);
    return true;
  }

  function renderPlaceholders() {
    const cards = $("#kelownaMacroCards");
    if (!cards) return;
    cards.innerHTML = SERIES.map((definition) => `
      <div class="kelowna-card">
        <span>${html(definition.label)}</span>
        <strong>--</strong>
        <div class="kelowna-card-trend neutral">
          <b>Connecting</b>
          <small>${html(definition.cadence)}</small>
        </div>
        <small>${html(definition.source)}</small>
      </div>
    `).join("");
  }

  function renderCards() {
    const cards = $("#kelownaMacroCards");
    if (!cards) return;
    cards.innerHTML = SERIES.map((definition) => {
      const current = latest(definition.key);
      const prior = previous(definition.key);
      const delta = current && prior ? current.value - prior.value : NaN;
      const tone = trendClass(definition, delta);
      return `
        <div class="kelowna-card">
          <span>${html(definition.label)}</span>
          <strong>${current ? html(formatValue(definition, current.value)) : "--"}</strong>
          <div class="kelowna-card-trend ${tone}">
            <b>${html(formatDelta(definition, delta))}</b>
            <small>${html(current?.period || definition.cadence)}</small>
          </div>
          <small>${html(definition.source)}</small>
        </div>
      `;
    }).join("");
  }

  function yScale(value, min, max, top, bottom) {
    if (max === min) return (top + bottom) / 2;
    return bottom - ((value - min) / (max - min)) * (bottom - top);
  }

  function pathFor(points, min, max, width, height, pad) {
    if (!points.length) return "";
    const step = points.length > 1 ? (width - pad.left - pad.right) / (points.length - 1) : 0;
    return points.map((point, index) => {
      const x = pad.left + step * index;
      const y = yScale(point.value, min, max, pad.top, height - pad.bottom);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function renderChart() {
    const svg = $("#kelownaMacroChart");
    if (!svg) return;
    const chartDefs = SERIES.filter((definition) => definition.chart);
    const chartSeries = chartDefs
      .map((definition) => ({ definition, points: (state.series[definition.key] || []).slice(-18) }))
      .filter((item) => item.points.length > 1);

    if (!chartSeries.length) {
      svg.innerHTML = '<text x="28" y="120" fill="#6b7280" font-size="14" font-weight="800">Waiting for public data source.</text>';
      return;
    }

    const width = 720;
    const height = 240;
    const pad = { top: 26, right: 24, bottom: 42, left: 48 };
    const values = chartSeries.flatMap((item) => item.points.map((point) => point.value));
    const min = Math.floor(Math.min(...values) - 1);
    const max = Math.ceil(Math.max(...values) + 1);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const y = pad.top + (height - pad.top - pad.bottom) * ratio;
      const value = max - (max - min) * ratio;
      return `<line class="kelowna-gridline" x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}"></line><text class="kelowna-chart-label" x="8" y="${(y + 4).toFixed(1)}">${value.toFixed(0)}%</text>`;
    }).join("");

    const lines = chartSeries.map(({ definition, points }) => (
      `<path class="kelowna-line" d="${pathFor(points, min, max, width, height, pad)}" stroke="${definition.color}"></path>`
    )).join("");

    const basePoints = chartSeries[0].points;
    const first = basePoints[0]?.period || "";
    const last = basePoints[basePoints.length - 1]?.period || "";
    const legend = chartSeries.map(({ definition }, index) => {
      const x = pad.left + index * 168;
      const y = height - 14;
      return `<circle cx="${x}" cy="${y - 4}" r="5" fill="${definition.color}"></circle><text class="kelowna-chart-label" x="${x + 12}" y="${y}">${html(definition.label)}</text>`;
    }).join("");

    svg.innerHTML = `${grid}${lines}<text class="kelowna-chart-label" x="${pad.left}" y="${height - 34}">${html(first)}</text><text class="kelowna-chart-label" x="${width - 90}" y="${height - 34}">${html(last)}</text>${legend}`;
  }

  function renderSources() {
    const target = $("#kelownaMacroSources");
    if (!target) return;
    target.innerHTML = `
      Sources:
      <a href="https://www.statcan.gc.ca/en/developers/wds" target="_blank" rel="noreferrer">StatCan WDS</a>,
      <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410045901" target="_blank" rel="noreferrer">labour force</a>,
      <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710014801" target="_blank" rel="noreferrer">population</a>,
      <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410015401" target="_blank" rel="noreferrer">housing starts</a>,
      <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410012701" target="_blank" rel="noreferrer">vacancy</a>
    `;
  }

  function macroScore() {
    const unemployment = latest("unemployment");
    const unemploymentPrior = previous("unemployment");
    const employment = latest("employment");
    const employmentPrior = previous("employment");
    const vacancy = latest("vacancyRate");
    const starts = latest("housingStarts");
    const startsPrior = previous("housingStarts");

    let score = 48;
    if (unemployment) score += (unemployment.value - 5.5) * 5.5;
    if (unemployment && unemploymentPrior) score += (unemployment.value - unemploymentPrior.value) * 8;
    if (employment && employmentPrior) score += employment.value < employmentPrior.value ? 6 : -3;
    if (starts && startsPrior) score += starts.value < startsPrior.value ? 3 : -2;
    if (vacancy) score += vacancy.value > 5 ? -4 : vacancy.value < 2 ? 5 : 0;
    return Math.round(clamp(score, 0, 100));
  }

  function renderInsight() {
    const lens = $("#kelownaMacroLens");
    const summary = $("#kelownaMacroSummary");
    const drivers = $("#kelownaMacroDrivers");
    const date = $("#kelownaMacroDate");
    const unemployment = latest("unemployment");
    const employment = latest("employment");
    const participation = latest("participationRate");
    const starts = latest("housingStarts");
    const vacancy = latest("vacancyRate");
    const score = macroScore();
    const tone = score >= 70 ? "Macro pressure elevated" : score >= 56 ? "Macro risk watch" : "Local backdrop stable";

    if (!unemployment) {
      if (lens) lens.textContent = "Awaiting source";
      if (date) date.textContent = "Awaiting source";
      if (summary) summary.textContent = "Public macro data has not loaded yet.";
      if (drivers) {
        drivers.innerHTML = [
          "Unemployment rate is waiting for StatCan.",
          "Employment is waiting for StatCan.",
          "Housing starts are waiting for CMHC via StatCan.",
          "Apartment vacancy is waiting for CMHC via StatCan.",
        ].map((item) => `<li>${html(item)}</li>`).join("");
      }
      return;
    }

    if (lens) lens.textContent = tone;
    if (date) date.textContent = unemployment ? `Latest labour data: ${unemployment.period}` : "Awaiting source";
    if (summary) {
      summary.textContent = `Kelowna CMA unemployment is ${formatValue(SERIES[0], unemployment.value)} with employment at ${formatValue(SERIES[3], employment?.value || 0)}. Data is public and delayed to the official release cycle.`;
    }

    if (drivers) {
      const unemploymentDelta = unemployment && previous("unemployment") ? unemployment.value - previous("unemployment").value : NaN;
      const employmentDelta = employment && previous("employment") ? employment.value - previous("employment").value : NaN;
      const participationDelta = participation && previous("participationRate") ? participation.value - previous("participationRate").value : NaN;
      const startsDelta = starts && previous("housingStarts") ? starts.value - previous("housingStarts").value : NaN;
      const items = [
        unemployment ? `Unemployment moved ${formatDelta(SERIES[0], unemploymentDelta)} to ${formatValue(SERIES[0], unemployment.value)}.` : "Unemployment rate is waiting for StatCan.",
        employment ? `Employment changed ${formatDelta(SERIES[3], employmentDelta)} to ${formatValue(SERIES[3], employment.value)} people.` : "Employment is waiting for StatCan.",
        participation ? `Participation is ${formatValue(SERIES[2], participation.value)}, ${formatDelta(SERIES[2], participationDelta)} from the prior period.` : "Participation rate is waiting for StatCan.",
        starts ? `Housing starts were ${formatValue(SERIES[7], starts.value)}, ${formatDelta(SERIES[7], startsDelta)} from the prior month.` : "Housing starts are waiting for CMHC via StatCan.",
        vacancy ? `Apartment vacancy is ${formatValue(SERIES[9], vacancy.value)} on the latest annual CMHC survey.` : "Apartment vacancy is waiting for CMHC via StatCan.",
      ];
      drivers.innerHTML = items.map((item) => `<li>${html(item)}</li>`).join("");
    }

    const meter = $("#macroMeter");
    const label = $("#macroLabel");
    if (meter) meter.value = score;
    if (label) label.textContent = score >= 70 ? "Elevated" : score >= 56 ? "Watch" : "Stable";
  }

  function renderAllMacro() {
    renderCards();
    renderChart();
    renderInsight();
    renderSources();
  }

  function cachePayload(rawRows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rawRows }));
    } catch {
      // Local storage can be unavailable in private browser modes.
    }
  }

  function loadCache() {
    try {
      const payload = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (!payload?.rawRows) return false;
      applyRows(payload.rawRows);
      state.loadedAt = payload.savedAt || Date.now();
      state.cached = true;
      return true;
    } catch {
      return false;
    }
  }

  function applyRows(rows) {
    const byVector = new Map((rows || []).map((row) => [Number(row?.object?.vectorId), row?.object?.vectorDataPoint || []]));
    SERIES.forEach((definition) => {
      state.series[definition.key] = normalizePoints(definition, byVector.get(definition.vectorId) || []);
    });
  }

  async function fetchMacroData() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch(STATCAN_WDS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SERIES.map((definition) => ({ vectorId: definition.vectorId, latestN: definition.latestN }))),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`StatCan returned ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("StatCan response was not a data array.");
      applyRows(rows);
      state.loadedAt = Date.now();
      state.cached = false;
      cachePayload(rows);
      return rows;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function refreshMacroData() {
    const button = $("#refreshKelownaMacro");
    if (button) button.disabled = true;
    setStatus("Refreshing public data", "neutral");
    try {
      await fetchMacroData();
      renderAllMacro();
      setStatus("Public data live", "positive");
    } catch (error) {
      const hasCache = loadCache();
      if (hasCache) {
        renderAllMacro();
        setStatus("Cached public data", "neutral");
      } else {
        renderPlaceholders();
        renderChart();
        renderInsight();
        renderSources();
        setStatus("Source unavailable", "negative");
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function setupExpand() {
    const grid = $("#kelownaMacroCards");
    const button = $("#toggleKelownaMetrics");
    if (!grid || !button) return;
    button.addEventListener("click", () => {
      const collapsed = grid.classList.toggle("collapsed");
      button.textContent = collapsed ? "Show all metrics" : "Show fewer metrics";
    });
  }

  function init() {
    ensureStyles();
    if (!ensurePanel()) return;
    renderPlaceholders();
    renderSources();
    setupExpand();
    $("#refreshKelownaMacro")?.addEventListener("click", refreshMacroData);
    if (loadCache()) {
      renderAllMacro();
      setStatus("Cached public data", "neutral");
    }
    refreshMacroData();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();