(function () {
  if (window.__investmentDeskUiPolish) return;
  window.__investmentDeskUiPolish = true;

  const VISIBLE_ITEMS = 5;
  const expanded = new Set();

  function applyPublicRateCollapse() {
    const container = document.querySelector("#publicRateCards");
    if (!container) return;

    const fullExpansionButton = document.querySelector('[data-expand-target="publicRates"]');
    const polishButton = document.querySelector('[data-polish-expand-target="publicRates"]');
    if (fullExpansionButton) {
      polishButton?.remove();
      return;
    }

    const cards = Array.from(container.querySelectorAll(".rate-card"));
    if (cards.length <= VISIBLE_ITEMS) {
      polishButton?.remove();
      cards.forEach((card) => card.classList.remove("line-item-hidden"));
      return;
    }

    const isExpanded = expanded.has("publicRates");
    cards.forEach((card, index) => {
      card.classList.toggle("line-item-hidden", !isExpanded && index >= VISIBLE_ITEMS);
    });

    const button = polishButton || document.createElement("button");
    button.type = "button";
    button.className = `expand-toggle${isExpanded ? " is-expanded" : ""}`;
    button.dataset.polishExpandTarget = "publicRates";
    button.setAttribute("aria-controls", "publicRateCards");
    button.setAttribute("aria-expanded", String(isExpanded));
    button.textContent = isExpanded ? `Show fewer (${VISIBLE_ITEMS} shown)` : `Show ${cards.length - VISIBLE_ITEMS} more (${cards.length} total)`;
    if (!polishButton) container.insertAdjacentElement("afterend", button);
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-polish-expand-target]");
      if (!toggle) return;
      const id = toggle.dataset.polishExpandTarget;
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      applyPublicRateCollapse();
    });

    const observer = new MutationObserver(() => window.setTimeout(applyPublicRateCollapse, 0));
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(applyPublicRateCollapse, 150);
    window.setTimeout(applyPublicRateCollapse, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
