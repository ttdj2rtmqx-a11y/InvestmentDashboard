(function () {
  if (window.__investmentDeskMunicipalRates) return;
  window.__investmentDeskMunicipalRates = true;

  const MFA_PAGE = "https://mfa.bc.ca/";
  const MFA_READER = "https://r.jina.ai/http://mfa.bc.ca/";
  const BOC_RATES_URL = "https://www.bankofcanada.ca/valet/observations/V39079,AVG.INTWO,TB.CDN.90D.MID,BD.CDN.2YR.DQ.YLD,BD.CDN.5YR.DQ.YLD,BD.CDN.10YR.DQ.YLD,V80691311/json?recent=1";
  const BOC_VALET_URL = "https://www.bankofcanada.ca/valet/";
  const $ = (selector) => document.querySelector(selector);

  const fallbackMfaRates = [
    { label: "MFA long-term borrowing", value: "3.99%", detail: "10-year loan rate", source: "MFA BC public homepage", url: MFA_PAGE },
    { label: "MFA short-term financing", value: "2.89%", detail: "Daily floating rate posted June 26, 2026", source: "MFA BC public homepage", url: MFA_PAGE },
    { label: "MFA equipment financing", value: "2.88%", detail: "Monthly fixed equipment rate", source: "MFA BC public homepage", url: MFA_PAGE },
  ];

  const bocSeries = [
    { id: "V39079", label: "BoC overnight target", fallback: "2.25%", detail: "Policy target rate", url: "https://www.bankofcanada.ca/2026/06/fad-press-release-2026-06-10/" },
    { id: "AVG.INTWO", label: "CORRA", fallback: "2.31%", detail: "Canadian overnight repo rate average", url: BOC_VALET_URL },
    { id: "TB.CDN.90D.MID", label: "3-month T-bill", fallback: "2.26%", detail: "Government of Canada treasury bill yield", url: BOC_VALET_URL },
    { id: "BD.CDN.2YR.DQ.YLD", label: "Canada 2-year", fallback: "2.75%", detail: "Benchmark Government of Canada yield", url: BOC_VALET_URL },
    { id: "BD.CDN.5YR.DQ.YLD", label: "Canada 5-year", fallback: "3.02%", detail: "Benchmark Government of Canada yield", url: BOC_VALET_URL },
    { id: "BD.CDN.10YR.DQ.YLD", label: "Canada 10-year", fallback: "3.39%", detail: "Benchmark Government of Canada yield", url: BOC_VALET_URL },
    { id: "V80691311", label: "Prime rate", fallback: "4.45%", detail: "Canadian financial institution prime rate", url: BOC_VALET_URL },
  ];

  const forecastItems = [
    {
      label: "Policy base case",
      value: "Hold at 2.25%",
      detail: "Bank of Canada held the policy rate on June 10, 2026 and emphasized two-sided risks from weak growth and energy-driven inflation.",
      url: "https://www.bankofcanada.ca/2026/06/fad-press-release-2026-06-10/",
      source: "Bank of Canada",
    },
    {
      label: "Economist survey",
      value: "Mostly on hold",
      detail: "A June economist survey expected no change, with most forecasters seeing no hike until 2027 or later.",
      url: "https://www.wsj.com/pro/central-banking/bank-of-canada-to-leave-policy-rate-unchanged-amid-recession-talk-wsj-survey-says-dbb08344",
      source: "WSJ survey",
    },
    {
      label: "Market participants",
      value: "First hike: Mar 2027",
      detail: "Market participants in a Bank of Canada survey expected the first rate increase around March 2027.",
      url: "https://www.wsj.com/economy/central-banking/market-participants-eye-march-2027-for-next-bank-of-canada-rate-increase-ad3a559d",
      source: "WSJ / BoC survey",
    },
    {
      label: "Risk scenario",
      value: "Energy could force hikes",
      detail: "The June opening statement noted policy could tighten if energy costs broaden into inflation expectations.",
      url: "https://www.bankofcanada.ca/2026/06/opening-statement-2026-06-10/",
      source: "Bank of Canada",
    },
  ];

  function injectStyles() {
    if ($("#municipalRatesStyles")) return;
    const style = document.createElement("style");
    style.id = "municipalRatesStyles";
    style.textContent = `
      .municipal-rates-panel { display: grid; gap: 14px; }
      .municipal-rates-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .public-rates-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .rate-card, .forecast-card {
        min-width: 0;
        display: grid;
        gap: 8px;
        padding: 13px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.68);
      }
      .rate-card span, .forecast-card span {
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 900;
        text-transform: uppercase;
      }
      .rate-card strong, .forecast-card strong { font-size: 1.35rem; line-height: 1.1; overflow-wrap: anywhere; }
      .rate-card small, .forecast-card small { color: var(--muted); font-weight: 720; line-height: 1.42; }
      .rate-card a, .forecast-card a { color: var(--teal); font-weight: 850; text-decoration: none; }
      .forecast-card { align-content: space-between; }
      .forecast-card strong { font-size: 1.05rem; }
      .municipal-rate-note { color: var(--muted); font-size: 0.8rem; font-weight: 750; }
      @media (max-width: 1080px) {
        .municipal-rates-grid, .public-rates-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 680px) {
        .municipal-rates-grid, .public-rates-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.append(style);
  }

  function ensureSection() {
    if (!$("#municipal-rates")) {
      const dataPanel = $("#data");
      const section = document.createElement("article");
      section.className = "panel wide-panel municipal-rates-panel";
      section.id = "municipal-rates";
      section.innerHTML = `
        <div class="panel-header">
          <div>
            <p class="eyebrow">Municipal finance</p>
            <h2>MFA borrowing and Canada rate outlook</h2>
          </div>
          <div class="panel-actions">
            <span class="data-badge" id="municipalRatesStatus">Public data</span>
            <button class="text-button" id="refreshMunicipalRates">Refresh</button>
          </div>
        </div>
        <div>
          <h3>Municipal Finance Authority borrowing</h3>
          <div class="municipal-rates-grid" id="mfaRateCards"></div>
        </div>
        <div>
          <h3>Public Canadian reference rates</h3>
          <div class="public-rates-grid" id="publicRateCards"></div>
        </div>
        <div>
          <h3>Canada interest rate forecast links</h3>
          <div class="municipal-rates-grid" id="rateForecastCards"></div>
        </div>
        <small class="municipal-rate-note" id="municipalRatesNote">MFA rates are read from the public MFA BC homepage when available. Bank of Canada rates use the public Valet API.</small>
      `;
      if (dataPanel) dataPanel.insertAdjacentElement("afterend", section);
      else document.querySelector(".dashboard-grid")?.prepend(section);
    }
    if (!document.querySelector('a[href="#municipal-rates"]')) {
      const dataLink = document.querySelector('.nav-list a[href="#data"]');
      dataLink?.insertAdjacentHTML("afterend", '<a href="#municipal-rates">Muni Rates</a>');
    }
  }

  function card(item) {
    return `
      <article class="rate-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.detail || "")}</small>
        <a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(item.source || "Source")}</a>
      </article>
    `;
  }

  function forecastCard(item) {
    return `
      <article class="forecast-card">
        <div>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </div>
        <a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(item.source)}</a>
      </article>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function renderMfaRates(rates = fallbackMfaRates) {
    if ($("#mfaRateCards")) $("#mfaRateCards").innerHTML = rates.map(card).join("");
  }

  function renderPublicRates(rates) {
    if ($("#publicRateCards")) $("#publicRateCards").innerHTML = rates.map(card).join("");
  }

  function renderForecasts() {
    if ($("#rateForecastCards")) $("#rateForecastCards").innerHTML = forecastItems.map(forecastCard).join("");
  }

  async function fetchMfaRates() {
    const response = await fetch(MFA_READER);
    const text = await response.text();
    const longTerm = text.match(/10\s*year\s*loan\s*rate\s*([0-9.]+)%/i)?.[1];
    const shortTerm = text.match(/([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+rate\s+([0-9.]+)%/i);
    const equipment = text.match(/Monthly\s+rate\s*([0-9.]+)%/i)?.[1];
    return [
      { ...fallbackMfaRates[0], value: longTerm ? `${longTerm}%` : fallbackMfaRates[0].value },
      {
        ...fallbackMfaRates[1],
        value: shortTerm?.[2] ? `${shortTerm[2]}%` : fallbackMfaRates[1].value,
        detail: shortTerm?.[1] ? `Daily floating rate posted ${shortTerm[1]}` : fallbackMfaRates[1].detail,
      },
      { ...fallbackMfaRates[2], value: equipment ? `${equipment}%` : fallbackMfaRates[2].value },
    ];
  }

  async function fetchPublicRates() {
    const response = await fetch(BOC_RATES_URL);
    const payload = await response.json();
    const latestBySeries = {};
    (payload.observations || []).forEach((observation) => {
      bocSeries.forEach((series) => {
        const value = observation[series.id]?.v;
        if (value) latestBySeries[series.id] = { value, date: observation.d };
      });
    });
    return bocSeries.map((series) => {
      const latest = latestBySeries[series.id];
      return {
        label: series.label,
        value: latest ? `${Number(latest.value).toFixed(series.id === "AVG.INTWO" ? 2 : 2)}%` : series.fallback,
        detail: latest ? `${series.detail}; latest ${latest.date}` : series.detail,
        source: "Bank of Canada",
        url: series.url,
      };
    });
  }

  function setStatus(label, tone = "neutral") {
    const status = $("#municipalRatesStatus");
    if (!status) return;
    status.textContent = label;
    status.className = `data-badge ${tone}`;
  }

  async function refreshRates() {
    setStatus("Refreshing", "neutral");
    const button = $("#refreshMunicipalRates");
    if (button) button.disabled = true;
    try {
      const [mfaRates, publicRates] = await Promise.all([
        fetchMfaRates().catch(() => fallbackMfaRates),
        fetchPublicRates().catch(() => bocSeries.map((series) => ({
          label: series.label,
          value: series.fallback,
          detail: series.detail,
          source: "Bank of Canada",
          url: series.url,
        }))),
      ]);
      renderMfaRates(mfaRates);
      renderPublicRates(publicRates);
      renderForecasts();
      const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setStatus(`Updated ${stamp}`, "positive");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function init() {
    injectStyles();
    ensureSection();
    renderMfaRates();
    renderPublicRates(bocSeries.map((series) => ({
      label: series.label,
      value: series.fallback,
      detail: series.detail,
      source: "Bank of Canada",
      url: series.url,
    })));
    renderForecasts();
    $("#refreshMunicipalRates")?.addEventListener("click", refreshRates);
    refreshRates();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
