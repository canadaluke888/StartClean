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

let entries = [];

function parseLines(value) {
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

async function loadEntriesFromFile() {
  try {
    const response = await fetch("first-run-config.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Configuration JSON must be an array");
    }
    entries = data.map(normalizeEntry);
  } catch (error) {
    console.error("Unable to load first-run configuration", error);
    showStatus(`Unable to load configuration: ${error.message}`, true);
    entries = [];
  }
  render();
}

function entryCard(entry) {
  const wrapper = document.createElement("article");
  wrapper.className = "entry-card";
  const header = document.createElement("h3");
  header.textContent = entry.name || "(Unnamed entry)";
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
  entriesListEl.innerHTML = "";
  if (!entries.length) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "No entries loaded.";
    entriesListEl.append(emptyState);
  } else {
    entries.forEach(entry => {
      entriesListEl.append(entryCard(entry));
    });
  }
  jsonPreviewEl.textContent = JSON.stringify(entries, null, 2);
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#cf222e" : "#1a7f37";
}

formEl.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const urlPatterns = parseLines(urlPatternsInput.value);
  const titleMustInclude = parseLines(titleAllInput.value);
  const titleShouldIncludeAny = parseLines(titleAnyInput.value);

  if (!name || !urlPatterns.length) {
    showStatus("Name and at least one URL pattern are required.", true);
    return;
  }

  const newEntry = {
    name,
    urlPatterns,
    titleMustInclude,
    titleShouldIncludeAny
  };
  entries.push(newEntry);
  render();
  showStatus(`Added entry “${name}”.`);
  formEl.reset();
  nameInput.focus();
});

refreshBtn.addEventListener("click", () => {
  loadEntriesFromFile();
  showStatus("Reloaded configuration from file.");
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
    showStatus("Copied JSON to clipboard.");
  } catch (error) {
    console.error("Failed to copy JSON", error);
    showStatus("Copy failed. Select and copy the JSON manually.", true);
  }
});

downloadBtn.addEventListener("click", () => {
  try {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
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

loadEntriesFromFile();
