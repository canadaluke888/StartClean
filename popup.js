document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("auto-record");
  const status = document.getElementById("status");

  function updateStatus(isEnabled) {
    status.textContent = isEnabled
      ? "Auto-recording is enabled for the next browser startup."
      : "Auto-recording is currently disabled.";
  }

  chrome.storage.local.get({ autoRecordEnabled: false }, ({ autoRecordEnabled }) => {
    const enabled = Boolean(autoRecordEnabled);
    checkbox.checked = enabled;
    updateStatus(enabled);
  });

  checkbox.addEventListener("change", event => {
    const isEnabled = Boolean(event.target.checked);
    chrome.storage.local.set({ autoRecordEnabled: isEnabled }, () => {
      updateStatus(isEnabled);
    });
  });
});
