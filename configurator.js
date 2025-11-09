import packagedEntries from "./first-run-config.json" assert { type: "json" };

const entriesListEl = document.getElementById("entries-list");
const jsonPreviewEl = document.getElementById("json-preview");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refresh-btn");
const downloadBtn = document.getElementById("download-btn");
const copyBtn = document.getElementById("copy-btn");
const formEl = document.getElementById("add-form");
const nameInput = document.getElementById("name-input");
const urlPatternsInput = document.getElementById("url-patterns-input");
const titleAllInput = document.getElementById("title-all-input");
const titleAnyInput = document.getElementById("title-any-input");

const CUSTOM_STORAGE_KEY = "customEntries";
const hasChromeStorage =
  typeof chrome !== "undefined" && !!chrome.storage?.local?.get;

let baseEntries = [];
let customEntries = [];

function parseLines(value) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function normalizeEntry(entry) {
  return {
    name: typeof entry?.name === "string" ? entry.name : "",
    urlPatterns: Array.isArray(entry?.urlPatterns) ? entry.urlPatterns : [],
    titleMustInclude: Array.isArray(entry?.titleMustInclude)
      ? entry.titleMustInclude
      : [],
    titleShouldIncludeAny: Array.isArray(entry?.titleShouldIncludeAny)
      ? entry.titleShouldIncludeAny
      : []
  };
}

function getCombinedEntries() {
  return [...baseEntries, ...customEntries];
}

async function loadEntriesFromFile() {
  let success = false;
  try {
    if (!Array.isArray(packagedEntries)) {
      throw new Error("Configuration JSON must be an array");
    }
    baseEntries = packagedEntries.map(normalizeEntry);
    success = true;
  } catch (error) {
    console.error("Unable to load first-run configuration", error);
    showStatus(`Unable to load configuration: ${error.message}`, true);
    baseEntries = [];
  } finally {
    render();
  }
  return success;
}

async function loadCustomEntries() {
  let success = false;
  try {
    const stored = await readStoredCustomEntries();
    customEntries = stored.map(normalizeEntry);
    success = true;
  } catch (error) {
    console.error("Unable to load saved entries", error);
    customEntries = [];
    showStatus(`Unable to load saved entries: ${error.message}`, true);
  } finally {
    render();
  }
  return success;
}

function readStoredCustomEntries() {
  if (hasChromeStorage) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get({ [CUSTOM_STORAGE_KEY]: [] }, result => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        const value = result[CUSTOM_STORAGE_KEY];
        resolve(Array.isArray(value) ? value : []);
      });
    });
  }

  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new Error("Unable to read from localStorage");
  }
}

function writeStoredCustomEntries(value) {
  if (hasChromeStorage) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [CUSTOM_STORAGE_KEY]: value }, () => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    return Promise.reject(new Error("Unable to write to localStorage"));
  }
  return Promise.resolve();
}

function entryCard(entry, options = {}) {
  const { sourceLabel = "" } = options;
  const wrapper = document.createElement("article");
  wrapper.className = "entry-card";

  const header = document.createElement("h3");
  header.textContent = entry.name || "(Unnamed entry)";

  if (sourceLabel) {
    const source = document.createElement("span");
    source.className = "entry-source";
    source.textContent = sourceLabel;
    header.append(source);
  }

  wrapper.append(header);

  const urlList = document.createElement("ul");
  entry.urlPatterns.forEach(pattern => {
    const li = document.createElement("li");
    li.textContent = pattern;
    urlList.append(li);
  });
  wrapper.append(createSubheading("URL patterns"), urlList);

  wrapper.append(
    createSubheading("Title must include"),
    describeList(entry.titleMustInclude, "(none)"),
    createSubheading("Title should include any"),
    describeList(entry.titleShouldIncludeAny, "(none)")
  );

  return wrapper;
}

function createSubheading(text) {
  const heading = document.createElement("h4");
  heading.textContent = text;
  return heading;
}

function describeList(values, emptyText) {
  const list = document.createElement("ul");
  if (!values.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    list.append(item);
    return list;
  }
  values.forEach(value => {
    const li = document.createElement("li");
    li.textContent = value;
    list.append(li);
  });
  return list;
}

function render() {
  const combined = getCombinedEntries();
  entriesListEl.innerHTML = "";
  if (!combined.length) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "No entries loaded yet.";
    entriesListEl.append(emptyState);
  } else {
    baseEntries.forEach(entry => entriesListEl.append(entryCard(entry)));
    if (customEntries.length) {
      customEntries.forEach(entry =>
        entriesListEl.append(entryCard(entry, { sourceLabel: "Saved locally" }))
      );
    }
  }
  jsonPreviewEl.textContent = JSON.stringify(combined, null, 2);
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

formEl.addEventListener("submit", async event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const urlPatterns = parseLines(urlPatternsInput.value);
  const titleMustInclude = parseLines(titleAllInput.value);
  const titleShouldIncludeAny = parseLines(titleAnyInput.value);

  if (!name || !urlPatterns.length) {
    showStatus("Name and at least one URL pattern are required.", true);
    return;
  }

  const newEntry = normalizeEntry({
    name,
    urlPatterns,
    titleMustInclude,
    titleShouldIncludeAny
  });

  customEntries.push(newEntry);
  render();
  try {
    await writeStoredCustomEntries(customEntries);
    showStatus(`Saved new entry “${name}”.`);
    formEl.reset();
    nameInput.focus();
  } catch (error) {
    console.error("Unable to persist entry", error);
    customEntries.pop();
    render();
    showStatus("Unable to save entry. Check storage permissions.", true);
    return;
  }
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  const ok = await loadEntriesFromFile();
  if (ok) {
    showStatus("Reloaded configuration from file.");
  }
  refreshBtn.disabled = false;
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(getCombinedEntries(), null, 2));
    showStatus("Copied JSON to clipboard.");
  } catch (error) {
    console.error("Failed to copy JSON", error);
    showStatus("Copy failed. Select and copy the JSON manually.", true);
  }
});

downloadBtn.addEventListener("click", () => {
  try {
    const blob = new Blob([JSON.stringify(getCombinedEntries(), null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "first-run-config.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showStatus("Downloaded updated configuration.");
  } catch (error) {
    console.error("Failed to download JSON", error);
    showStatus("Download failed. Try copying the JSON instead.", true);
  }
});

async function initConfigurator() {
  await Promise.all([loadEntriesFromFile(), loadCustomEntries()]);
}

initConfigurator();
