(function () {
  if (window.__investmentDeskDocumentIntelligence) return;
  window.__investmentDeskDocumentIntelligence = true;

  const STORAGE_KEY = "investmentDeskDocumentUploadsV1";
  const MAX_TEXT_PREVIEW = 18000;
  const $ = (selector) => document.querySelector(selector);

  const state = loadState();

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        documents: Array.isArray(saved?.documents) ? saved.documents.slice(0, 12) : [],
        appliedPolicy: saved?.appliedPolicy || null,
        appliedStatement: saved?.appliedStatement || null,
      };
    } catch {
      return { documents: [], appliedPolicy: null, appliedStatement: null };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The UI still works if storage is unavailable.
    }
  }

  function injectStyles() {
    if ($("#documentIntelligenceStyles")) return;
    const style = document.createElement("style");
    style.id = "documentIntelligenceStyles";
    style.textContent = `
      .document-upload-confirmation,
      .uploaded-document-list,
      .document-intel-panel,
      .document-model-evidence {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.72);
      }
      .document-upload-confirmation {
        padding: 10px 12px;
        color: var(--muted);
        font-size: 0.84rem;
        font-weight: 780;
      }
      .document-upload-confirmation.positive {
        color: var(--positive);
        background: rgba(31, 157, 99, 0.08);
        border-color: rgba(31, 157, 99, 0.22);
      }
      .uploaded-document-list {
        display: grid;
        gap: 8px;
        padding: 10px;
      }
      .uploaded-document-list:empty { display: none; }
      .uploaded-document-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 9px 10px;
        border-radius: 8px;
        background: rgba(17, 24, 39, 0.045);
      }
      .uploaded-document-item strong {
        overflow: hidden;
        color: var(--ink);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .uploaded-document-item small,
      .document-intel-panel small,
      .document-impact-card small {
        color: var(--muted);
        font-weight: 700;
        line-height: 1.45;
      }
      .document-intel-panel {
        display: grid;
        gap: 6px;
        padding: 12px;
      }
      .document-intel-panel span,
      .document-impact-card span {
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 850;
        text-transform: uppercase;
      }
      .document-intel-panel strong {
        color: var(--ink);
      }
      .statement-import .document-upload-confirmation,
      .statement-import .uploaded-document-list,
      .statement-import .document-intel-panel {
        grid-column: 1 / -1;
      }
      .document-model-evidence {
        display: grid;
        gap: 12px;
        margin-top: 14px;
        padding: 14px;
      }
      .document-impact-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .document-impact-card {
        min-height: 96px;
        display: grid;
        gap: 8px;
        align-content: start;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.68);
      }
      .document-impact-card strong {
        color: var(--ink);
        font-size: 0.98rem;
      }
      @media (max-width: 980px) {
        .document-impact-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.append(style);
  }

  function ensureElement(parent, selector, html, position = "beforeend") {
    if (!parent || $(selector)) return;
    parent.insertAdjacentHTML(position, html);
  }

  function ensurePolicyUi() {
    const uploader = $(".policy-uploader");
    const summary = $(".policy-summary");
    ensureElement(uploader, "#policyUploadConfirmation", '<div class="document-upload-confirmation" id="policyUploadConfirmation">Awaiting policy upload</div>');
    ensureElement(uploader, "#policyDocumentList", '<div class="uploaded-document-list" id="policyDocumentList" aria-label="Uploaded policy documents"></div>');
    ensureElement(summary, "#policyScannerNarrative", '<div class="document-intel-panel" id="policyScannerNarrative"><span>Document scanner</span><strong>Ready to recognize policy constraints</strong><small>Scanned policy data will identify risk profile, cash reserve, concentration limits, trade thresholds, and mandate restrictions.</small></div>');
    ensureElement(summary, "#policyModelImpact", '<div class="document-intel-panel" id="policyModelImpact"><span>Model impact</span><strong>No policy data applied yet</strong><small>Once applied, policy settings update the optimization model risk profile, target cash, maximum position size, and rebalance threshold.</small></div>');
  }

  function ensureStatementUi() {
    const panel = $(".statement-import");
    const preview = $("#statementPreview");
    ensureElement(panel, "#statementUploadConfirmation", '<div class="document-upload-confirmation" id="statementUploadConfirmation">Awaiting statement upload</div>', preview ? "beforeend" : "beforeend");
    ensureElement(panel, "#statementDocumentList", '<div class="uploaded-document-list" id="statementDocumentList" aria-label="Uploaded investment statements"></div>');
    ensureElement(panel, "#statementScannerNarrative", '<div class="document-intel-panel" id="statementScannerNarrative"><span>AI statement scanner</span><strong>Ready to recognize holdings</strong><small>The scanner looks for tickers, names, categories, quantities, prices, and market values before populating the portfolio.</small></div>');
    ensureElement(panel, "#statementModelImpact", '<div class="document-intel-panel" id="statementModelImpact"><span>Model impact</span><strong>No statement data applied yet</strong><small>Imported holdings will replace editable positions, set category targets from the current risk profile, and rerun trade recommendations.</small></div>');
    if (preview && $("#statementModelImpact") && preview.previousElementSibling !== $("#statementModelImpact")) {
      panel.appendChild(preview);
    }
  }

  function ensureRebalanceUi() {
    const rebalance = $("#rebalance");
    if (!rebalance || $("#optimizationDocumentEvidence")) return;
    const anchor = rebalance.querySelector(".recommendation-grid");
    const html = `
      <section class="document-model-evidence" id="optimizationDocumentEvidence" aria-label="Optimization model document inputs">
        <div class="subheader">
          <h3>Document inputs used by model</h3>
          <span id="documentEvidenceStatus">No documents applied</span>
        </div>
        <div class="document-impact-grid" id="optimizationDataUsed"></div>
      </section>
    `;
    if (anchor) anchor.insertAdjacentHTML("beforebegin", html);
    else rebalance.insertAdjacentHTML("beforeend", html);
  }

  function formatSize(bytes) {
    if (!Number.isFinite(Number(bytes))) return "unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function readLooseText(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(reader.result || []));
          resolve(decoded.replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " "));
        } catch {
          resolve("");
        }
      };
      reader.onerror = () => resolve("");
      reader.readAsArrayBuffer(file);
    });
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\u0000/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function scannerMode() {
    return $("#openAiKey")?.value.trim() ? "AI scanner" : "Rules scanner";
  }

  function latestDocument(kind) {
    return state.documents.find((doc) => doc.kind === kind) || null;
  }

  function upsertDocument(kind, file, readableCharacters = 0) {
    const document = {
      id: `${kind}-${Date.now()}`,
      kind,
      name: file.name,
      size: file.size,
      type: file.type || file.name.split(".").pop().toUpperCase(),
      readableCharacters,
      uploadedAt: new Date().toISOString(),
      scanStatus: "Uploaded",
      scanner: scannerMode(),
      applied: false,
    };
    state.documents = [document, ...state.documents.filter((doc) => !(doc.kind === kind && doc.name === file.name))].slice(0, 12);
    saveState();
    return document;
  }

  function renderDocumentList(kind) {
    const container = kind === "policy" ? $("#policyDocumentList") : $("#statementDocumentList");
    if (!container) return;
    const documents = state.documents.filter((doc) => doc.kind === kind).slice(0, 5);
    container.innerHTML = documents
      .map((doc) => {
        const uploaded = new Date(doc.uploadedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        return `
          <div class="uploaded-document-item">
            <div>
              <strong>${escapeHTML(doc.name)}</strong>
              <small>${escapeHTML(doc.scanStatus)} · ${escapeHTML(doc.scanner)} · ${formatSize(doc.size)} · ${uploaded}</small>
            </div>
            <small>${doc.readableCharacters ? `${doc.readableCharacters.toLocaleString()} chars` : "pending"}</small>
          </div>
        `;
      })
      .join("");
  }

  function setConfirmation(kind, message, tone = "positive") {
    const target = kind === "policy" ? $("#policyUploadConfirmation") : $("#statementUploadConfirmation");
    if (!target) return;
    target.textContent = message;
    target.className = `document-upload-confirmation ${tone}`;
  }

  function resetPolicyPanels() {
    const scanner = $("#policyScannerNarrative");
    const impact = $("#policyModelImpact");
    if (scanner) {
      scanner.innerHTML = `
        <span>Document scanner</span>
        <strong>Ready to recognize policy constraints</strong>
        <small>Scanned policy data will identify risk profile, cash reserve, concentration limits, trade thresholds, and mandate restrictions.</small>
      `;
    }
    if (impact) {
      impact.innerHTML = `
        <span>Model impact</span>
        <strong>No policy data applied yet</strong>
        <small>Once applied, policy settings update the optimization model's risk profile, target cash, maximum position size, and rebalance threshold.</small>
      `;
    }
  }

  function resetStatementPanels() {
    const scanner = $("#statementScannerNarrative");
    const impact = $("#statementModelImpact");
    if (scanner) {
      scanner.innerHTML = `
        <span>AI statement scanner</span>
        <strong>Ready to recognize holdings</strong>
        <small>The scanner looks for tickers, names, categories, quantities, prices, and market values before populating the portfolio.</small>
      `;
    }
    if (impact) {
      impact.innerHTML = `
        <span>Model impact</span>
        <strong>No statement data applied yet</strong>
        <small>Imported holdings will replace editable positions, set category targets from the current risk profile, and rerun trade recommendations.</small>
      `;
    }
  }

  async function handleUpload(kind, file) {
    setConfirmation(kind, `Upload confirmed: ${file.name}`, "positive");
    const text = cleanText(await readLooseText(file)).slice(0, MAX_TEXT_PREVIEW);
    if (kind === "policy") {
      state.appliedPolicy = null;
      resetPolicyPanels();
    }
    if (kind === "statement") {
      state.appliedStatement = null;
      resetStatementPanels();
    }
    const doc = upsertDocument(kind, file, text.length);
    doc.scanStatus = text.length ? "Ready to scan" : "Uploaded, text extraction limited";
    saveState();
    renderDocumentList(kind);
    renderModelEvidence();
  }

  function updateLatestDocument(kind, changes) {
    const doc = latestDocument(kind);
    if (!doc) return;
    Object.assign(doc, changes);
    saveState();
    renderDocumentList(kind);
  }

  function policyValuesFromDom() {
    const cards = Array.from(document.querySelectorAll("#policyAdjustments > div"));
    const values = cards.reduce((map, card) => {
      const label = card.querySelector("span")?.textContent.trim().toLowerCase() || "";
      const value = card.querySelector("strong")?.textContent.trim() || "";
      if (label) map[label] = value;
      return map;
    }, {});
    return {
      riskProfile: values["risk profile"] || $("#riskProfile option:checked")?.textContent || "Current profile",
      cashTarget: values["cash target"] || $("#cashTargetOutput")?.textContent || "",
      maxPosition: values["max position"] || $("#maxPositionOutput")?.textContent || "",
      tradeThreshold: values["trade threshold"] || $("#tradeThresholdOutput")?.textContent || "",
      confidence: values.confidence || "",
      source: values.source || scannerMode(),
      summary: $("#policySummary")?.textContent.trim() || "",
      constraints: Array.from(document.querySelectorAll("#policyAdjustments p")).map((item) => item.textContent.trim()).filter(Boolean),
    };
  }

  function renderPolicyScanner() {
    const panel = $("#policyScannerNarrative");
    if (!panel) return;
    const values = policyValuesFromDom();
    const hasScan = document.querySelectorAll("#policyAdjustments > div").length > 0 && values.summary;
    if (!hasScan) return;
    updateLatestDocument("policy", { scanStatus: "Scanned", scanner: values.source });
    panel.innerHTML = `
      <span>Document scanner</span>
      <strong>${escapeHTML(values.source)} recognized ${escapeHTML(values.riskProfile)}</strong>
      <small>${escapeHTML(values.summary)} ${values.constraints.length ? `Constraints detected: ${escapeHTML(values.constraints.join(" "))}` : "No explicit constraint list was detected."}</small>
    `;
  }

  function renderPolicyImpact(applied = false) {
    const panel = $("#policyModelImpact");
    if (!panel) return;
    const values = policyValuesFromDom();
    const hasScan = document.querySelectorAll("#policyAdjustments > div").length > 0;
    if (!applied && !hasScan && !state.appliedPolicy) {
      panel.innerHTML = `
        <span>Model impact</span>
        <strong>No policy data applied yet</strong>
        <small>Once applied, policy settings update the optimization model's risk profile, target cash, maximum position size, and rebalance threshold.</small>
      `;
      renderModelEvidence();
      return;
    }
    const status = applied || state.appliedPolicy ? "Policy parameters applied" : "Policy parameters ready";
    if (applied) {
      state.appliedPolicy = { ...values, appliedAt: new Date().toISOString() };
      updateLatestDocument("policy", { applied: true, scanStatus: "Applied to model" });
    }
    panel.innerHTML = `
      <span>Model impact</span>
      <strong>${escapeHTML(status)}</strong>
      <small>Risk profile ${escapeHTML(values.riskProfile)} sets category targets. Cash target ${escapeHTML(values.cashTarget || "current")} changes reserve trades. Max position ${escapeHTML(values.maxPosition || "current")} limits concentration trims. Trade threshold ${escapeHTML(values.tradeThreshold || "current")} controls when recommendations appear.</small>
    `;
    saveState();
    renderModelEvidence();
  }

  function statementRowsFromDom() {
    return Array.from(document.querySelectorAll("#statementPreview .statement-preview-row")).map((row) => {
      const cells = Array.from(row.children).map((cell) => cell.textContent.trim());
      return {
        ticker: cells[0] || "",
        name: cells[1] || "",
        category: cells[2] || "",
        quantity: cells[3] || "",
        valueText: cells[4] || "",
        value: Number((cells[4] || "").replace(/[$,]/g, "")) || 0,
      };
    });
  }

  function renderStatementScanner() {
    const panel = $("#statementScannerNarrative");
    if (!panel) return;
    const rows = statementRowsFromDom();
    const summary = $("#statementSummary")?.textContent.trim() || "";
    if (!rows.length && !/found|scan/i.test(summary)) return;
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))];
    updateLatestDocument("statement", { scanStatus: rows.length ? "Scanned" : "Scan reviewed", scanner: summary.includes("AI") ? "AI scanner" : scannerMode() });
    panel.innerHTML = `
      <span>AI statement scanner</span>
      <strong>${rows.length ? `${rows.length} holding${rows.length === 1 ? "" : "s"} recognized` : "Scan completed"}</strong>
      <small>${rows.length ? `Recognized ${rows.slice(0, 4).map((row) => row.ticker).join(", ")}${rows.length > 4 ? " and more" : ""}. ${categories.length ? `Categories: ${escapeHTML(categories.join(", "))}.` : ""} Preview value: ${total ? total.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "not available"}.` : escapeHTML(summary)}</small>
    `;
  }

  function renderStatementImpact(applied = false) {
    const panel = $("#statementModelImpact");
    if (!panel) return;
    const rows = statementRowsFromDom();
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const isApplied = applied || Boolean(state.appliedStatement);
    if (applied) {
      state.appliedStatement = {
        holdings: rows.length,
        previewValue: total,
        appliedAt: new Date().toISOString(),
      };
      updateLatestDocument("statement", { applied: true, scanStatus: "Applied to model" });
    }
    panel.innerHTML = `
      <span>Model impact</span>
      <strong>${isApplied ? "Statement holdings applied" : rows.length ? "Statement holdings ready" : "No statement data applied yet"}</strong>
      <small>${rows.length ? `${rows.length} recognized holding${rows.length === 1 ? "" : "s"} ${isApplied ? "now drive" : "can drive"} portfolio value, category weights, target drift, risk score, and recommended buy/sell trades. Preview value: ${total ? total.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "not available"}.` : "Imported holdings will replace editable positions, set category targets from the current risk profile, and rerun trade recommendations."}</small>
    `;
    saveState();
    renderModelEvidence();
  }

  function currentControlText(id) {
    const output = $(`#${id}Output`)?.textContent.trim();
    const input = $(`#${id}`)?.value;
    return output || input || "";
  }

  function renderModelEvidence() {
    const grid = $("#optimizationDataUsed");
    if (!grid) return;
    const activePolicy = state.appliedPolicy || policyValuesFromDom();
    const statement = state.appliedStatement;
    const uploadedCount = state.documents.length;
    const tradeCount = $("#tradeCount")?.textContent.trim() || "0";
    const riskLabel = $("#riskProfile option:checked")?.textContent || activePolicy.riskProfile || "Current profile";
    const evidenceStatus = $("#documentEvidenceStatus");
    if (evidenceStatus) evidenceStatus.textContent = uploadedCount ? `${uploadedCount} uploaded document${uploadedCount === 1 ? "" : "s"} tracked` : "No documents applied";
    grid.innerHTML = `
      <div class="document-impact-card">
        <span>Uploaded evidence</span>
        <strong>${uploadedCount || "No"} document${uploadedCount === 1 ? "" : "s"}</strong>
        <small>${state.documents.slice(0, 3).map((doc) => doc.name).join(", ") || "Upload policy documents or statements to create an audit trail."}</small>
      </div>
      <div class="document-impact-card">
        <span>Policy data used</span>
        <strong>${escapeHTML(riskLabel)}</strong>
        <small>Cash target ${escapeHTML(activePolicy.cashTarget || currentControlText("cashTarget"))}; max position ${escapeHTML(activePolicy.maxPosition || currentControlText("maxPosition"))}; trade threshold ${escapeHTML(activePolicy.tradeThreshold || currentControlText("tradeThreshold"))}.</small>
      </div>
      <div class="document-impact-card">
        <span>Statement data used</span>
        <strong>${statement?.holdings || statementRowsFromDom().length || 0} recognized holding${(statement?.holdings || statementRowsFromDom().length) === 1 ? "" : "s"}</strong>
        <small>Holdings affect portfolio value, category weights, risk score, target drift, and rebalance trades.</small>
      </div>
      <div class="document-impact-card">
        <span>Optimization effect</span>
        <strong>${escapeHTML(tradeCount)} recommendation${tradeCount === "1" ? "" : "s"}</strong>
        <small>The model compares imported/current holdings with policy-adjusted targets and only recommends trades above the active threshold.</small>
      </div>
    `;
  }

  function bindEvents() {
    document.addEventListener("change", (event) => {
      if (event.target.matches("#policyFile") && event.target.files?.[0]) handleUpload("policy", event.target.files[0]);
      if (event.target.matches("#statementFile") && event.target.files?.[0]) handleUpload("statement", event.target.files[0]);
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("#analyzePolicy")) {
        window.setTimeout(renderPolicyScanner, 900);
        window.setTimeout(() => renderPolicyImpact(false), 1200);
        window.setTimeout(renderModelEvidence, 1600);
      }
      if (event.target.closest("#applyPolicy")) {
        window.setTimeout(() => renderPolicyImpact(true), 700);
      }
      if (event.target.closest("#scanStatement")) {
        window.setTimeout(renderStatementScanner, 900);
        window.setTimeout(() => renderStatementImpact(false), 1200);
        window.setTimeout(renderModelEvidence, 1600);
      }
      if (event.target.closest("#applyStatementHoldings")) {
        window.setTimeout(() => renderStatementImpact(true), 800);
      }
      if (event.target.closest("#runRebalance") || event.target.closest("#runRebalanceTop")) {
        window.setTimeout(renderModelEvidence, 500);
      }
    });

    let refreshScheduled = false;
    const scheduleRefresh = () => {
      if (refreshScheduled) return;
      refreshScheduled = true;
      window.requestAnimationFrame(() => {
        refreshScheduled = false;
        renderPolicyScanner();
        renderPolicyImpact(false);
        renderStatementScanner();
        renderStatementImpact(false);
        renderModelEvidence();
      });
    };
    const observer = new MutationObserver(scheduleRefresh);
    ["#policyAdjustments", "#policySummary", "#statementPreview", "#statementSummary", "#tradeRows", "#rebalanceStatus"].forEach((selector) => {
      const target = $(selector);
      if (target) observer.observe(target, { childList: true, subtree: true, characterData: true });
    });
  }

  function init() {
    injectStyles();
    ensurePolicyUi();
    ensureStatementUi();
    ensureRebalanceUi();
    renderDocumentList("policy");
    renderDocumentList("statement");
    renderPolicyScanner();
    renderStatementScanner();
    renderPolicyImpact(false);
    renderStatementImpact(false);
    renderModelEvidence();
    bindEvents();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
