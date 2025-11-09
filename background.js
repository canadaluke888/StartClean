// Convert a simple wildcard pattern to regex (supports "*" only)
function patternToRegex(pattern) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = "^" + esc(pattern).replace(/\\\*/g, ".*") + "$";
  return new RegExp(re);
}

function normalizeRulesets(rawEntries = []) {
  if (!Array.isArray(rawEntries)) {
    console.warn("First-run configuration is not an array; ignoring");
    return [];
  }
  return rawEntries.map(entry => ({
    name: entry?.name || "",
    urlRegexes: Array.isArray(entry?.urlPatterns)
      ? entry.urlPatterns.map(patternToRegex)
      : [],
    titleMustInclude: Array.isArray(entry?.titleMustInclude)
      ? entry.titleMustInclude.map(s => String(s).toLowerCase())
      : [],
    titleShouldIncludeAny: Array.isArray(entry?.titleShouldIncludeAny)
      ? entry.titleShouldIncludeAny.map(s => String(s).toLowerCase())
      : []
  }));
}

let bundledEntriesPromise;

async function loadBundledEntries() {
  if (!bundledEntriesPromise) {
    bundledEntriesPromise = fetch(chrome.runtime.getURL("first-run-config.json"))
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load first-run configuration (${response.status})`);
        }
        return response.json();
      })
      .then(normalizeRulesets)
      .catch(error => {
        console.error("Unable to read bundled first-run settings", error);
        return [];
      });
  }
  return bundledEntriesPromise;
}

async function loadConfig() {
  return loadBundledEntries();
}

async function shouldClose(tab = {}) {
  const url = tab.url || "";
  const title = (tab.title || "").toLowerCase();
  const entries = await loadConfig();

  for (const entry of entries) {
    if (url && entry.urlRegexes.some(rx => rx.test(url))) {
      return true;
    }

    if (
      title &&
      entry.titleMustInclude.every(part => title.includes(part)) &&
      (entry.titleShouldIncludeAny.length === 0 ||
        entry.titleShouldIncludeAny.some(part => title.includes(part)))
    ) {
      return true;
    }
  }

  return false;
}

function evaluateTab(tabId, tab) {
  if (!tabId && tab && typeof tab.id === "number") {
    tabId = tab.id;
  }

  if (!tabId) return;

  shouldClose(tab)
    .then(result => {
      if (result) {
        chrome.tabs.remove(tabId);
      }
    })
    .catch(error => {
      console.error("Error while evaluating tab", error);
    });
}

// Close immediately if created with URL already set
chrome.tabs.onCreated.addListener(tab => {
  evaluateTab(tab.id, tab);
});

// Close when the URL/title becomes known or the page finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
    evaluateTab(tabId, tab);
  }
});
