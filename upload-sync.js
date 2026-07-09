(function () {
  if (window.__investmentDeskUploadSync) return;
  window.__investmentDeskUploadSync = true;

  const $ = (selector) => document.querySelector(selector);

  function readDashboardSnapshot() {
    try {
      const holdings = Array.isArray(appState?.holdings) ? appState.holdings : [];
      const totalValue = holdings.reduce((sum, item) => sum + Number(item.value || 0), 0);
      const weight = (item) => (totalValue ? (Number(item.value || 0) / totalValue) * 100 : 0);
      return {
        settings: {
          riskProfile: appState?.riskProfile || "balanced",
          cashTarget: Number(appState?.cashTarget || 0),
          maxPosition: Number(appState?.maxPosition || 0),
          tradeThreshold: Number(appState?.tradeThreshold || 0),
        },
        holdings: holdings.map((item) => ({ ...item, weight: weight(item) })),
        activeHoldings: holdings.filter((item) => !(typeof isOpenSlot === "function" && isOpenSlot(item))).map((item) => ({ ...item, weight: weight(item) })),
        recommendations: Array.isArray(latestRecommendations) ? latestRecommendations.map((item) => ({ ...item })) : [],
        totalValue,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { settings: {}, holdings: [], activeHoldings: [], recommendations: [], totalValue: 0, updatedAt: new Date().toISOString() };
    }
  }

  function refreshDependentSections() {
    const holdingsRows = $("#holdingsRows");
    if (holdingsRows) holdingsRows.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function broadcast(reason, detail = {}) {
    window.dispatchEvent(
      new CustomEvent("investment-dashboard:update", {
        detail: {
          reason,
          ...detail,
          dashboard: readDashboardSnapshot(),
        },
      })
    );
    window.setTimeout(refreshDependentSections, 0);
  }

  function clearPendingPolicy(fileName) {
    try {
      if (typeof policyState === "object" && policyState) policyState.pendingAdjustments = null;
    } catch {
      // Older standalone pages still update through the visible controls.
    }
    const riskLabel = $("#policyRiskLabel");
    const adjustments = $("#policyAdjustments");
    if (riskLabel) riskLabel.textContent = "New document ready";
    if (adjustments) adjustments.innerHTML = "";
    broadcast("policy-uploaded", { policy: { fileName } });
  }

  function wrapRenderAll() {
    try {
      if (typeof notifyDashboardUpdate === "function") return;
      if (typeof renderAll !== "function" || renderAll.__uploadSyncWrapped) return;
      const originalRenderAll = renderAll;
      renderAll = function (...args) {
        const result = originalRenderAll.apply(this, args);
        const options = args[0] || {};
        broadcast(options.runModel ? "model-run" : "dashboard-rendered", { runModel: Boolean(options.runModel) });
        return result;
      };
      renderAll.__uploadSyncWrapped = true;
    } catch {
      // The static dashboard can still run without the wrapper.
    }
  }

  function wrapPolicyApply() {
    try {
      if (typeof notifyDashboardUpdate === "function") return;
      if (typeof applyPolicyAdjustments !== "function" || applyPolicyAdjustments.__uploadSyncWrapped) return;
      const originalApplyPolicyAdjustments = applyPolicyAdjustments;
      applyPolicyAdjustments = function (...args) {
        const result = originalApplyPolicyAdjustments.apply(this, args);
        window.dispatchEvent(new CustomEvent("investment-dashboard:policy-applied", { detail: { dashboard: readDashboardSnapshot() } }));
        broadcast("policy-applied");
        return result;
      };
      applyPolicyAdjustments.__uploadSyncWrapped = true;
    } catch {
      // Click fallback below still keeps the hosted page synchronized.
    }
  }

  function bindFallbackEvents() {
    document.addEventListener("change", (event) => {
      if (event.target.matches("#policyFile") && event.target.files?.[0]) {
        clearPendingPolicy(event.target.files[0].name);
      }
      if (event.target.matches("#statementFile") && event.target.files?.[0]) {
        broadcast("statement-uploaded", { statement: { fileName: event.target.files[0].name } });
      }
    });

    document.addEventListener("click", (event) => {
      const delayed = (reason, eventName) => {
        window.setTimeout(() => {
          if (eventName) window.dispatchEvent(new CustomEvent(eventName, { detail: { dashboard: readDashboardSnapshot() } }));
          broadcast(reason);
        }, 900);
      };
      if (event.target.closest("#analyzePolicy")) delayed("policy-scanned", "investment-dashboard:policy-scanned");
      if (event.target.closest("#applyPolicy")) delayed("policy-applied", "investment-dashboard:policy-applied");
      if (event.target.closest("#scanStatement")) delayed("statement-scanned", "investment-dashboard:statement-scanned");
      if (event.target.closest("#applyStatementHoldings")) delayed("statement-applied", "investment-dashboard:statement-applied");
      if (event.target.closest("#runRebalance") || event.target.closest("#runRebalanceTop")) delayed("model-run");
    });
  }

  function init() {
    document.documentElement.dataset.uploadSync = "ready";
    wrapRenderAll();
    wrapPolicyApply();
    bindFallbackEvents();
    window.setTimeout(() => broadcast("upload-sync-ready"), 0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
