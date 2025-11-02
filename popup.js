document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("auto-record");
  const status = document.getElementById("status");

  const extensionApi =
    typeof chrome !== "undefined"
      ? chrome
      : typeof browser !== "undefined"
      ? browser
      : null;

  const storageArea = extensionApi?.storage?.local;

  function markStorageUnavailable(message) {
    checkbox.checked = false;
    checkbox.disabled = true;
    status.textContent = message;
  }

  function updateStatus(isEnabled) {
    status.textContent = isEnabled
      ? "Auto-recording is enabled for the next browser startup."
      : "Auto-recording is currently disabled.";
  }

  if (!storageArea) {
    markStorageUnavailable(
      "Extension storage is unavailable; auto-recording cannot be configured."
    );
    return;
  }

  const usesCallbackApi = typeof storageArea.get === "function" && storageArea.get.length > 1;

  function storageGet(defaults) {
    if (usesCallbackApi) {
      return new Promise(resolve => {
        storageArea.get(defaults, resolve);
      });
    }
    const result = storageArea.get(defaults);
    return typeof result?.then === "function"
      ? result
      : Promise.resolve(result || defaults);
  }

  function storageSet(values) {
    if (usesCallbackApi) {
      return new Promise((resolve, reject) => {
        try {
          storageArea.set(values, () => {
            const error = extensionApi?.runtime?.lastError;
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    try {
      const result = storageArea.set(values);
      return typeof result?.then === "function" ? result : Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  storageGet({ autoRecordEnabled: false })
    .then(({ autoRecordEnabled }) => {
      const enabled = Boolean(autoRecordEnabled);
      checkbox.checked = enabled;
      updateStatus(enabled);
    })
    .catch(error => {
      console.error("Unable to read auto-recording preference", error);
      markStorageUnavailable(
        "Unable to read saved preferences; auto-recording is disabled."
      );
    });

  checkbox.addEventListener("change", event => {
    const isEnabled = Boolean(event.target.checked);
    storageSet({ autoRecordEnabled: isEnabled })
      .then(() => {
        updateStatus(isEnabled);
      })
      .catch(error => {
        console.error("Unable to persist auto-recording preference", error);
        markStorageUnavailable(
          "Unable to save your choice; auto-recording has been disabled."
        );
      });
  });
});
