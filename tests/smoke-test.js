const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function testAssetReferences() {
  const html = read("index.html");
  const refs = [...html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)]
    .map((match) => match[1])
    .filter((ref) => !/^(https?:|mailto:|tel:)/.test(ref));
  const missing = refs.filter((ref) => !fs.existsSync(path.join(root, ref)));
  assert(missing.length === 0, `Missing referenced assets: ${missing.join(", ")}`);
}

function testDuplicateIds() {
  const html = read("index.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert(duplicateIds.length === 0, `Duplicate HTML ids: ${duplicateIds.join(", ")}`);
}

function testJavaScriptSyntax() {
  const jsFiles = fs.readdirSync(root).filter((file) => file.endsWith(".js"));
  jsFiles.forEach((file) => {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    assert(result.status === 0, `${file} failed syntax check:\n${result.stderr || result.stdout}`);
  });
}

function testDynamicLoaderGuards() {
  const policy = read("policy.js");
  assert(policy.includes("window.__investmentDeskStatementImport"), "Statement importer loader should check the module guard.");
  assert(policy.includes('script[src*="statement-import.js"]'), "Statement importer loader should not duplicate an existing script tag.");
  assert(policy.includes("window.__investmentDeskKelownaMacro"), "Kelowna macro loader should check the module guard.");
  assert(policy.includes('script[src*="kelowna-macro.js"]'), "Kelowna macro loader should not duplicate an existing script tag.");
}

function testWatchlistSearchFallback() {
  const enhancements = read("enhancements.js");
  assert(enhancements.includes("localSearchUniverse"), "Watchlist search needs a local no-key universe.");
  assert(enhancements.includes("function localSearch(query)"), "Watchlist search needs local matching.");
  assert(enhancements.includes("return local;"), "Provider search should return local matches when no API key is present.");
  assert(enhancements.includes("mergeSearchResults(local, remote)"), "Provider search should merge provider results with local matches.");
}

function testWatchlistBlankFallback() {
  const watchlistFix = read("watchlist-fix.js");
  const openHtml = read("open.html");
  const openMunicipal = read("open-municipal-rates.html");
  assert(watchlistFix.includes("window.__investmentDeskWatchlistFixBound"), "Watchlist fallback should use its own guard.");
  assert(watchlistFix.includes('$("#watchlistCards").children.length'), "Watchlist fallback should only fill a blank monitor.");
  assert(openHtml.includes("watchlist-fix.js?v="), "Hosted launcher should refresh the watchlist fallback asset.");
  assert(openMunicipal.includes("watchlist-fix.js?v="), "Municipal launcher should refresh the watchlist fallback asset.");
}

function testYahooDelayedFallback() {
  const enhancements = read("enhancements.js");
  assert(enhancements.includes("function yahooSymbol(symbol)"), "Yahoo fallback should normalize symbols for delayed chart data.");
  assert(enhancements.includes("const yahooSeriesCache = new Map();"), "Yahoo fallback should cache delayed series to avoid duplicate refresh calls.");
  assert(enhancements.includes("async function fetchYahooReaderQuote(symbol)"), "Yahoo fallback should derive quotes from delayed chart data.");
  assert(enhancements.includes("async function fetchProviderMarketData(symbol"), "Provider refresh should share one delayed history call for quote and chart data.");
  assert(enhancements.includes("if (!apiKey) return fetchYahooReaderQuote(symbol);"), "Quote refresh should fall back to Yahoo delayed data without a provider key.");
  assert(enhancements.includes("if (!apiKey) return fetchYahooReaderDailySeries(symbol);"), "History refresh should fall back to Yahoo delayed data without a provider key.");
  assert(!enhancements.includes("if (!activeApiKey(settings)) return;"), "Technical refresh should not stop when provider keys are missing.");
  assert(enhancements.includes("Yahoo delayed mode"), "The UI should describe no-key refreshes as Yahoo delayed mode.");
}

const tests = [
  testAssetReferences,
  testDuplicateIds,
  testJavaScriptSyntax,
  testDynamicLoaderGuards,
  testWatchlistSearchFallback,
  testWatchlistBlankFallback,
  testYahooDelayedFallback,
];

tests.forEach((test) => test());
console.log(`Smoke tests passed: ${tests.length}`);
