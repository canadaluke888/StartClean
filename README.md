# StartClean First-Run Tab Blocker

StartClean closes those noisy "welcome" or "what's new" tabs that other extensions open the moment Chrome launches. Instead of editing JSON by hand, you curate the block list directly from Chrome’s UI, optionally letting StartClean auto-record offenders when the browser starts.

## Install & Load Locally

1. Clone or download this repository.
2. Open `chrome://extensions`, toggle **Developer mode**, and click **Load unpacked**.
3. Select the repo root so Chrome loads `manifest.json`.
4. Click the extension card’s **Details** button; the **Extension options** link opens the configurator page described below.

## Capture the First-Run Tab You Want to Block

1. Trigger the extension or app that spawns the unwanted first-run tab (install/update it, or restart Chrome).
2. When the tab appears:
   - Copy the full URL from the address bar. Note any variable portions so you can replace them with `*` later.
   - Copy the tab title (right-click the tab → **Copy > Copy page title**) so you know which keywords appear consistently.
3. Decide how you want StartClean to recognize the tab:
   - Prefer URL matches when the address is deterministic.
   - Use title keywords when the URL is unstable but the title text is predictable.

> Tip: If you do not want to repeat these steps, enable **Auto-record first-run tabs on startup** from the browser action popup. StartClean will watch the next Chrome launch, capture any first-run tabs it sees, and insert draft entries for you.

## Add the Tab to the Block List from the Browser

1. Open the configurator (options) page from the extension card or by navigating to `chrome-extension://<id>/configurator.html`.
2. The **Current entries** section lists rules bundled in `first-run-config.json` plus anything you have saved locally. Use **Reload from file** if you edited the shipped JSON outside the browser; your saved entries remain intact and are shown with a “Saved locally” badge.
3. Scroll to **Add a new entry** and fill in the fields:
   - **Display name** – Friendly label shown in the list (e.g., “Grammarly welcome tab”).
   - **URL patterns** – One pattern per line. Use `*` as a wildcard (`https://example.com/*/welcome`). StartClean tests the tab URL against each pattern.
   - **Title must include (all)** – Keywords (one per line) that must *all* appear in the tab title. Lower/upper case does not matter.
   - **Title should include (any)** – Optional list where at least one keyword must appear. Use this to disambiguate tabs that share the required keywords.
4. Click **Add entry**. The configurator stores the entry in `chrome.storage.local`, updates the preview JSON, and the new card shows up immediately.
5. Reload Chrome (or simply reenact the first-run scenario) to confirm the tab now closes on sight.

## Understand Each Entry Field

| Field | Purpose | Example |
| --- | --- | --- |
| `name` | Human-readable hint for future you. | `Grammarly welcome` |
| `urlPatterns` | Glob-style URL matches (`*` wildcard only). | `https://*.grammarly.com/welcome*` |
| `titleMustInclude` | All listed words must exist in the tab title. | `["welcome", "grammarly"]` |
| `titleShouldIncludeAny` | At least one listed word must exist in the title. | `["changelog", "new features"]` |

You can leave the title lists empty when URL matching is enough, or skip `urlPatterns` when only the title is reliable.

## Export or Share Your Rules

- **Copy JSON** copies the combined (file + saved) configuration to the clipboard.
- **Download JSON** saves the merged configuration as `first-run-config.json`, which you can drop into another copy of the extension.

## Auto-Recording First-Run Tabs

1. Click the StartClean toolbar icon to open the popup.
2. Toggle **Auto-record first-run tabs on startup**. The choice is stored via `chrome.storage.local`.
3. On the next browser launch, StartClean observes newly opened tabs during startup. Any tab that looks like a first-run/update page gets added to your local entries so it appears in the configurator automatically.

Review those recorded entries in the configurator, tweak patterns if needed, and export them once you are happy.

## Development Notes

- `background.js` evaluates tabs using the merged rule list (bundled JSON + locally saved entries) and closes matches.
- `configurator.html/js/css` implement the browser-based editor described above.
- `popup.html/js` hosts the auto-record toggle.
- After any code change, reload the extension from `chrome://extensions` and rerun a first-run scenario to verify behavior.
