// Convert a simple wildcard pattern to regex (supports "*" only)
function patternToRegex(pattern) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = "^" + esc(pattern).replace(/\\\*/g, ".*") + "$";
  return new RegExp(re);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEntry(entry = {}) {
  const urlPatterns = Array.isArray(entry.urlPatterns)
    ? entry.urlPatterns.map(pattern => pattern.trim()).filter(isNonEmptyString)
    : [];
  const titleMustInclude = Array.isArray(entry.titleMustInclude)
    ? entry.titleMustInclude.map(part => part.trim()).filter(isNonEmptyString)
    : [];
  const titleShouldIncludeAny = Array.isArray(entry.titleShouldIncludeAny)
    ? entry.titleShouldIncludeAny.map(part => part.trim()).filter(isNonEmptyString)
    : [];

  return {
    name: typeof entry.name === "string" ? entry.name : "",
    urlPatterns,
    titleMustInclude,
    titleShouldIncludeAny,
    urlRegexes: urlPatterns.map(patternToRegex),
    titleMustIncludeLc: titleMustInclude.map(part => part.toLowerCase()),
    titleShouldIncludeAnyLc: titleShouldIncludeAny.map(part => part.toLowerCase())
  };
}

function sanitizeRawEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.map(entry => ({
    name: typeof entry?.name === "string" ? entry.name : "",
    urlPatterns: Array.isArray(entry?.urlPatterns)
      ? entry.urlPatterns.map(pattern => pattern.trim()).filter(isNonEmptyString)
      : [],
    titleMustInclude: Array.isArray(entry?.titleMustInclude)
      ? entry.titleMustInclude.map(part => part.trim()).filter(isNonEmptyString)
      : [],
    titleShouldIncludeAny: Array.isArray(entry?.titleShouldIncludeAny)
      ? entry.titleShouldIncludeAny.map(part => part.trim()).filter(isNonEmptyString)
      : []
  }));
}

const RECORDING_WINDOW_MS = 120000;

let staticConfigPromise;
let autoRecordEnabled = false;
let recordingActiveUntil = 0;
let recordedTabIds = new Set();
let recordedEntriesRaw = [];
let normalizedRecordedEntries = [];
let startupEventPending = false;

function loadStaticConfig() {
  if (!staticConfigPromise) {
    staticConfigPromise = fetch(chrome.runtime.getURL("first-run-config.json"))
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load config: ${response.status}`);
        }
        return response.json();
      })
      .then(entries => {
        if (!Array.isArray(entries)) {
          console.warn("First-run configuration is not an array; ignoring");
          return [];
        }
        return entries.map(normalizeEntry);
      })
      .catch(error => {
        console.error("Unable to load first-run configuration", error);
        return [];
      });
  }
  return staticConfigPromise;
}

function setRecordedEntries(rawEntries) {
  recordedEntriesRaw = sanitizeRawEntries(rawEntries);
  normalizedRecordedEntries = recordedEntriesRaw.map(normalizeEntry);
}

function readStorageState() {
  return new Promise(resolve => {
    chrome.storage.local.get(
      { autoRecordEnabled: false, recordedEntries: [] },
      resolve
    );
  });
}

async function initializeState() {
  const state = await readStorageState();
  autoRecordEnabled = Boolean(state.autoRecordEnabled);
  setRecordedEntries(state.recordedEntries);
  if (startupEventPending) {
    startupEventPending = false;
    if (autoRecordEnabled) {
      startRecordingSession();
    }
  }
}

initializeState();

function isRecordingActive() {
  return autoRecordEnabled && Date.now() <= recordingActiveUntil;
}

function startRecordingSession() {
  if (!autoRecordEnabled) {
    return;
  }
  recordingActiveUntil = Date.now() + RECORDING_WINDOW_MS;
  recordedTabIds = new Set();
  console.info("Auto-recording first-run tabs is active", {
    expiresAt: new Date(recordingActiveUntil).toISOString()
  });
}

function stopRecordingSession() {
  recordingActiveUntil = 0;
  recordedTabIds = new Set();
  console.info("Auto-recording first-run tabs stopped");
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(changes, "autoRecordEnabled")) {
    autoRecordEnabled = Boolean(changes.autoRecordEnabled.newValue);
    if (!autoRecordEnabled) {
      stopRecordingSession();
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, "recordedEntries")) {
    setRecordedEntries(changes.recordedEntries.newValue);
  }
});

chrome.runtime.onStartup.addListener(() => {
  if (autoRecordEnabled) {
    startRecordingSession();
  } else {
    startupEventPending = true;
  }
});

async function loadConfig() {
  const staticEntries = await loadStaticConfig();
  return staticEntries.concat(normalizedRecordedEntries);
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
      entry.titleMustIncludeLc.every(part => title.includes(part)) &&
      (entry.titleShouldIncludeAnyLc.length === 0 ||
        entry.titleShouldIncludeAnyLc.some(part => title.includes(part)))
    ) {
      return true;
    }
  }

  return false;
}

async function persistRecordedEntries() {
  return new Promise(resolve => {
    chrome.storage.local.set({ recordedEntries: recordedEntriesRaw }, resolve);
  });
}

function shouldSkipRecording(url) {
  if (!url) {
    return true;
  }
  const normalized = url.toLowerCase();
  if (normalized.startsWith("chrome://")) {
    return true;
  }
  if (normalized === "about:blank") {
    return true;
  }
  return false;
}

async function maybeRecordTab(tab = {}) {
  if (!tab || typeof tab.id !== "number") {
    return;
  }

  if (!isRecordingActive()) {
    return;
  }

  if (recordedTabIds.has(tab.id)) {
    return;
  }

  const url = tab.url || tab.pendingUrl || "";
  if (shouldSkipRecording(url)) {
    return;
  }

  if (await shouldClose(tab)) {
    return;
  }

  recordedTabIds.add(tab.id);

  const alreadyRecorded = recordedEntriesRaw.some(entry =>
    entry.urlPatterns.some(pattern => pattern === url)
  );
  if (alreadyRecorded) {
    return;
  }

  const nameBase = tab.title && tab.title.trim().length > 0 ? tab.title.trim() : url;
  const newEntry = {
    name: `Auto: ${nameBase}`,
    urlPatterns: [url],
    titleMustInclude: [],
    titleShouldIncludeAny: []
  };

  setRecordedEntries(recordedEntriesRaw.concat(newEntry));
  await persistRecordedEntries();
  console.info("Recorded first-run tab", { url, name: newEntry.name });
  evaluateTab(tab.id, tab);
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
  maybeRecordTab(tab).catch(error => {
    console.error("Failed to record tab", error);
  });
  evaluateTab(tab.id, tab);
});

// Close when the URL/title becomes known or the page finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
    maybeRecordTab(tab).catch(error => {
      console.error("Failed to record tab", error);
    });
    evaluateTab(tabId, tab);
  }
});
