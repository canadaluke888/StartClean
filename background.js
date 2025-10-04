// Known Chrome Web Store ID for Adblock Plus:
const ABP_ID = "cfhdojbkjhnklbpkdaibdccddilifddb";

// Update / first-run pages ABP tends to open.
// Add more patterns here if you see new URLs appear.
const BLOCK_PATTERNS = [
  `chrome-extension://${ABP_ID}/firstRun.html`,
  `chrome-extension://${ABP_ID}/legacy_firstRun.html`,
  "https://adblockplus.org/redirect*",
  "https://adblockplus.org/*update*",
  "https://adblockplus.org/*changelog*"
];

// Convert a simple wildcard pattern to regex (supports "*" only)
function patternToRegex(pattern) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = "^" + esc(pattern).replace(/\\\*/g, ".*") + "$";
  return new RegExp(re);
}

const BLOCK_REGEXES = BLOCK_PATTERNS.map(patternToRegex);

function shouldClose(url = "", title = "") {
  if (!url) return false;
  // Fast path: match any of our URL regexes
  if (BLOCK_REGEXES.some(rx => rx.test(url))) return true;

  // Optional title-based safety net (in case URL changes)
  const t = title.toLowerCase();
  if (t.includes("adblock plus") && (t.includes("updated") || t.includes("what's new") || t.includes("first run"))) {
    return true;
  }
  return false;
}

// Close immediately if created with URL already set
chrome.tabs.onCreated.addListener(tab => {
  if (shouldClose(tab.url, tab.title)) {
    chrome.tabs.remove(tab.id);
  }
});

// Close when the URL/title becomes known or the page finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If URL or title changed, re-check
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
    if (shouldClose(tab.url, tab.title)) {
      chrome.tabs.remove(tabId);
    }
  }
});
