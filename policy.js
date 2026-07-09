(function () {
  const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
  const POLICY_TEXT_LIMIT = 18000;
  const STORAGE_KEY = "investmentDeskPolicyScanV1";
  const profileDefaults = {
    conservative: { label: "Conservative income", cashTarget: 12, maxPosition: 10, tradeThreshold: 1 },
    balanced: { label: "Balanced growth", cashTarget: 7, maxPosition: 18, tradeThreshold: 1.5 },
    growth: { label: "Growth", cashTarget: 5, maxPosition: 22, tradeThreshold: 2 },
    aggressive: { label: "Aggressive growth", cashTarget: 3, maxPosition: 28, tradeThreshold: 2.5 },
  };
  let extractedText = "";
  let pendingAdjustments = null;

  const $ = (selector) => document.querySelector(selector);
  const clamp = (value, min, max, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
  };
  const pct = (value, decimals = 1) => `${Number(value).toFixed(decimals)}%`;
  const escapeHTML = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function setPolicyStatus(label, state = "neutral") {
    const badge = $("#policyStatus");
    if (!badge) return;
    badge.textContent = label;
    badge.className = `data-badge ${state}`;
  }

  function normalize(result, source) {
    const profile = profileDefaults[result.riskProfile] ? result.riskProfile : "balanced";
    const defaults = profileDefaults[profile];
    return {
      riskProfile: profile,
      cashTarget: clamp(result.cashTarget, 2, 20, defaults.cashTarget),
      maxPosition: clamp(result.maxPosition, 8, 30, defaults.maxPosition),
      tradeThreshold: clamp(result.tradeThreshold, 0.5, 5, defaults.tradeThreshold),
      rationale: String(result.rationale || "Policy language was mapped to the closest dashboard risk model."),
      constraints: Array.isArray(result.constraints) ? result.constraints.slice(0, 5).map(String) : [],
      confidence: clamp(result.confidence, 0, 1, 0.65),
      source,
    };
  }

  function rulesScan(text) {
    const lowered = text.toLowerCase();
    const contains = (terms) => terms.reduce((score, term) => score + (lowered.includes(term) ? 1 : 0), 0);
    const preservation = contains(["capital preservation", "preserve capital", "liquidity", "low volatility", "investment grade", "drawdown", "income", "principal protection", "no leverage"]);
    const growth = contains(["capital appreciation", "long-term growth", "growth objective", "equity allocation", "higher risk", "opportunistic", "aggressive", "venture"]);
    const restrictions = contains(["maximum position", "concentration", "single issuer", "sector limit", "prohibited", "not permitted", "shall not", "risk limit"]);
    const cryptoRestricted = contains(["no crypto", "cryptocurrency prohibited", "digital assets prohibited", "crypto assets prohibited"]);
    let profile = "balanced";
    if (preservation >= growth + 2) profile = "conservative";
    if (growth >= preservation + 2) profile = "growth";
    if (growth >= preservation + 4 && lowered.includes("aggressive")) profile = "aggressive";
    const defaults = profileDefaults[profile];
    const cashTarget = lowered.includes("cash reserve") || lowered.includes("liquidity") ? Math.max(defaults.cashTarget, 10) : defaults.cashTarget;
    const maxPosition = restrictions >= 2 ? Math.min(defaults.maxPosition, 12) : defaults.maxPosition;
    const tradeThreshold = restrictions >= 2 ? Math.min(defaults.tradeThreshold, 1) : defaults.tradeThreshold;
    const constraints = [];
    if (restrictions) constraints.push("Concentration and mandate restrictions detected.");
    if (cryptoRestricted) constraints.push("Crypto or digital asset restriction detected.");
    if (cashTarget > defaults.cashTarget) constraints.push("Liquidity language increased the cash reserve target.");
    return normalize(
      {
        riskProfile: profile,
        cashTarget,
        maxPosition,
        tradeThreshold,
        rationale: "The uploaded document was scored for preservation, growth, liquidity, and concentration language.",
        constraints,
        confidence: text.length > 1200 ? 0.72 : 0.58,
      },
      "Rules-based scan"
    );
  }

  function responseText(payload) {
    if (payload.output_text) return payload.output_text;
    return (payload.output || [])
      .flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text" && content.text)
      .map((content) => content.text)
      .join("\n");
  }

  async function aiScan(text, apiKey) {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "developer",
            content: "You are an institutional investment policy analyst. Extract only risk and rebalance parameters. Do not provide legal, tax, or investment advice. Return JSON only.",
          },
          {
            role: "user",
            content: `Map this policy into dashboard settings. Use only these riskProfile values: conservative, balanced, growth, aggressive. Keep cashTarget 2-20, maxPosition 8-30, tradeThreshold 0.5-5.\n\nDocument:\n${text.slice(0, POLICY_TEXT_LIMIT)}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "policy_risk_adjustment",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                riskProfile: { type: "string", enum: ["conservative", "balanced", "growth", "aggressive"] },
                cashTarget: { type: "number" },
                maxPosition: { type: "number" },
                tradeThreshold: { type: "number" },
                rationale: { type: "string" },
                constraints: { type: "array", items: { type: "string" } },
                confidence: { type: "number" },
              },
              required: ["riskProfile", "cashTarget", "maxPosition", "tradeThreshold", "rationale", "constraints", "confidence"],
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const output = responseText(await response.json());
    if (!output) throw new Error("AI response did not include policy settings.");
    return normalize(JSON.parse(output), "AI policy scan");
  }

  function renderAnalysis(analysis) {
    pendingAdjustments = analysis;
    $("#policyRiskLabel").textContent = profileDefaults[analysis.riskProfile].label;
    $("#policySummary").textContent = analysis.rationale;
    $("#policyAdjustments").innerHTML = `
      <div><span>Risk profile</span><strong>${profileDefaults[analysis.riskProfile].label}</strong></div>
      <div><span>Cash target</span><strong>${pct(analysis.cashTarget, 0)}</strong></div>
      <div><span>Max position</span><strong>${pct(analysis.maxPosition, 0)}</strong></div>
      <div><span>Trade threshold</span><strong>${pct(analysis.tradeThreshold)}</strong></div>
      <div><span>Confidence</span><strong>${Math.round(analysis.confidence * 100)}%</strong></div>
      <div><span>Source</span><strong>${analysis.source}</strong></div>
      ${analysis.constraints.map((item) => `<p>${escapeHTML(item)}</p>`).join("")}
    `;
  }

  function cleanText(text) {
    return text
      .replace(/\u0000/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read policy document."));
      reader.readAsText(file);
    });
  }

  function readLooseText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(reader.result || []));
        resolve(decoded.replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " "));
      };
      reader.onerror = () => reject(new Error("Could not read policy document."));
      reader.readAsArrayBuffer(file);
    });
  }

  async function extractFileText(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    const textLike = file.type.startsWith("text/") || ["txt", "md", "csv", "json", "html"].includes(extension);
    const cleaned = cleanText(textLike ? await readText(file) : await readLooseText(file));
    if (cleaned.length < 80) throw new Error("Not enough readable text was found. Try a text, markdown, or copied policy excerpt.");
    return cleaned.slice(0, POLICY_TEXT_LIMIT);
  }

  async function onPolicyFile(event) {
    if (event.defaultPrevented) return;
    const file = event.target.files?.[0];
    if (!file) return;
    event.preventDefault();
    $("#policyFileName").textContent = file.name;
    setPolicyStatus("Reading document", "neutral");
    try {
      extractedText = await extractFileText(file);
      setPolicyStatus("Ready to scan", "positive");
      $("#policySummary").textContent = `${file.name} loaded with ${extractedText.length.toLocaleString()} readable characters.`;
    } catch (error) {
      extractedText = "";
      setPolicyStatus("Unreadable file", "negative");
      $("#policySummary").textContent = error.message;
    }
  }

  async function scanPolicy() {
    if (!extractedText) {
      setPolicyStatus("Upload needed", "negative");
      return;
    }
    const button = $("#analyzePolicy");
    const apiKey = $("#openAiKey").value.trim();
    button.disabled = true;
    button.textContent = "Scanning...";
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ openAiKey: apiKey }));
    setPolicyStatus(apiKey ? "AI scanning" : "Rules scanning", "neutral");
    try {
      const analysis = apiKey ? await aiScan(extractedText, apiKey) : rulesScan(extractedText);
      renderAnalysis(analysis);
      setPolicyStatus("Policy analyzed", "positive");
    } catch (error) {
      const fallback = rulesScan(extractedText);
      renderAnalysis({ ...fallback, rationale: `AI scan was unavailable, so a rules-based scan was used. ${fallback.rationale}` });
      setPolicyStatus("Fallback scan", "neutral");
    } finally {
      button.disabled = false;
      button.textContent = "Scan policy";
    }
  }

  function setControlValue(selector, value, eventName) {
    const control = $(selector);
    control.value = String(value);
    control.dispatchEvent(new Event(eventName, { bubbles: true }));
  }

  function applyPolicy() {
    if (!pendingAdjustments) {
      setPolicyStatus("Scan first", "negative");
      return;
    }
    setControlValue("#riskProfile", pendingAdjustments.riskProfile, "change");
    setControlValue("#cashTarget", pendingAdjustments.cashTarget, "input");
    setControlValue("#maxPosition", pendingAdjustments.maxPosition, "input");
    setControlValue("#tradeThreshold", pendingAdjustments.tradeThreshold, "input");
    $("#runRebalance").click();
    setPolicyStatus("Parameters applied", "positive");
    $("#rebalance").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function restoreKey() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.openAiKey) $("#openAiKey").value = saved.openAiKey;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function initPolicyScan() {
    if (!$("#policyFile")) return;
    restoreKey();
    $("#policyFile").addEventListener("change", onPolicyFile);
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event.target.closest("#analyzePolicy")) {
        event.preventDefault();
        scanPolicy();
      }
      if (event.target.closest("#applyPolicy")) {
        event.preventDefault();
        applyPolicy();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPolicyScan);
  } else {
    initPolicyScan();
  }
})();
(function(){function loadStatementImporter(){if(window.__investmentDeskStatementImport||document.querySelector("#statementFile")||document.querySelector('script[data-statement-import],script[src*="statement-import.js"]'))return;var s=document.createElement('script');s.src='statement-import.js?v=statement-import-1';s.dataset.statementImport='true';document.body.appendChild(s)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadStatementImporter);else loadStatementImporter()})();
(function(){function loadKelownaMacro(){if(window.__investmentDeskKelownaMacro||document.querySelector("#kelownaMacroCards")||document.querySelector('script[data-kelowna-macro],script[src*="kelowna-macro.js"]'))return;var s=document.createElement('script');s.src='kelowna-macro.js?v=kelowna-macro-1';s.dataset.kelownaMacro='true';document.body.appendChild(s)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadKelownaMacro);else loadKelownaMacro()})();
