# Shut Up First-Run Tab Blocker

This Chrome extension automatically closes "first-run" or "update" tabs that some extensions open the first time they run. You can configure which tabs should be closed by editing a JSON file that lists the URL and/or title patterns to match.

## How it works

* `background.js` listens for newly created or updated tabs and compares them against the configured rules.
* Rules are loaded at runtime from `first-run-config.json` inside the extension package.
* When a tab's URL matches a configured pattern, or its title satisfies the provided keywords, the tab is closed automatically.

## Configuration

Edit `first-run-config.json` to list every first-run tab you want to close. The file should contain an array of objects with the following shape:

```json
[
  {
    "name": "Descriptive label",
    "urlPatterns": ["https://example.com/*"],
    "titleMustInclude": ["required", "keywords"],
    "titleShouldIncludeAny": ["optional", "keywords"]
  }
]
```

* **name**: Optional description that helps you remember what the rule targets.
* **urlPatterns**: Wildcard patterns ("*" is supported) checked against tab URLs.
* **titleMustInclude**: Lower-case strings that all must appear in the tab title before it is closed.
* **titleShouldIncludeAny**: Lower-case strings where at least one must appear, allowing you to narrow down matches when multiple titles share the required keywords.

You can provide only the fields you need. For example, use `urlPatterns` alone to block a known URL, or rely on the title matching fields when the URL is unpredictable.

After updating the file, reload the extension in `chrome://extensions` for the new rules to take effect.

## Capturing a first-run tab to block

1. Install or update the extension that opens the unwanted first-run tab.
2. When the tab appears, record its URL and title:
   * Copy the URL from the address bar.
   * Right-click the tab title and choose **Copy > Copy page title**, or note the text manually.
3. Decide whether matching by URL, title, or both is most reliable:
   * Use `urlPatterns` if the URL is stable and predictable. Replace variable parts with `*` wildcards.
   * Use `titleMustInclude` and `titleShouldIncludeAny` when the title text is consistent but the URL changes.
4. Add or update an entry in `first-run-config.json` using the captured values.
5. Reload the Shut Up extension and repeat the first-run scenario to confirm the tab now closes automatically.

## Development

This repository contains the Chrome extension source. To test locally:

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository directory.
4. Trigger a first-run tab to verify that it is closed according to your configuration.

Feel free to extend `first-run-config.json` with more rules as you encounter additional first-run tabs.
