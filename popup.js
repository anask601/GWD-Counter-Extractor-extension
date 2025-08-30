// Popup JavaScript for Chrome Extension
class GWDExtractorPopup {
  constructor() {
    this.currentTab = null;
    this.extractedCounters = [];
    this.initializeElements();
    this.bindEvents();
    this.loadCurrentTab();
  }

  initializeElements() {
    this.elements = {
      urlValue: document.getElementById("urlValue"),
      navigateBtn: document.getElementById("navigateBtn"),
      extractBtn: document.getElementById("extractBtn"),
      copyBtn: document.getElementById("copyBtn"),
      clearBtn: document.getElementById("clearBtn"),
      refreshBtn: document.getElementById("refreshBtn"),
      helpBtn: document.getElementById("helpBtn"),
      outputArea: document.getElementById("outputArea"),
      successMessage: document.getElementById("successMessage"),
      errorMessage: document.getElementById("errorMessage"),
      nanWarning: document.getElementById("nanWarning"),
      counterInfo: document.getElementById("counterInfo"),
      counterCount: document.getElementById("counterCount"),
      modalOverlay: document.getElementById("modalOverlay"),
      modalClose: document.getElementById("modalClose"),
    };
  }

  bindEvents() {
    this.elements.navigateBtn.addEventListener("click", () =>
      this.navigateToIndex()
    );
    this.elements.extractBtn.addEventListener("click", () =>
      this.extractCounters()
    );
    this.elements.copyBtn.addEventListener("click", () =>
      this.copyToClipboard()
    );
    this.elements.clearBtn.addEventListener("click", () => this.clearAll());
    this.elements.refreshBtn.addEventListener("click", () =>
      this.refreshPage()
    );
    this.elements.helpBtn.addEventListener("click", () => this.openModal());
    this.elements.modalClose.addEventListener("click", () => this.closeModal());
    this.elements.modalOverlay.addEventListener("click", (e) => {
      if (e.target === this.elements.modalOverlay) {
        this.closeModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
      }
      if (e.ctrlKey && e.key === "Enter") {
        this.extractCounters();
      }
    });
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.currentTab = tab;
      this.elements.urlValue.textContent = tab.url || "No URL available";

      // Check if we're on a localhost URL
      const isLocalhost = tab.url && tab.url.includes("localhost");
      this.elements.navigateBtn.disabled = !isLocalhost;

      if (!isLocalhost) {
        this.elements.navigateBtn.textContent = "🚫 Not on localhost";
      }
    } catch (error) {
      console.error("Error loading current tab:", error);
      this.elements.urlValue.textContent = "Error loading URL";
      this.elements.navigateBtn.disabled = true;
    }
  }

  async navigateToIndex() {
    if (!this.currentTab) return;

    try {
      const currentUrl = this.currentTab.url;
      const newUrl = currentUrl.replace("/preview.html", "/index.html");

      if (currentUrl === newUrl) {
        this.showMessage(
          "info",
          "Already on index.html or URL pattern not found"
        );
        return;
      }

      await chrome.tabs.update(this.currentTab.id, { url: newUrl });

      // Wait a moment and reload tab info
      setTimeout(() => {
        this.loadCurrentTab();
        this.showMessage("success", "✅ Navigated to index.html");
      }, 1000);
    } catch (error) {
      console.error("Navigation error:", error);
      this.showMessage("error", "❌ Failed to navigate to index.html");
    }
  }

  async extractCounters() {
    if (!this.currentTab) {
      this.showMessage("error", "❌ No active tab found");
      return;
    }

    try {
      // Inject content script to extract counters
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: () => {
          // This function will be executed in the page context
          const counters = [];
          const nanCounters = []; // Track counters with NaN values

          try {
            // Helper function to check for NaN in attribute values
            function hasNaNValue(element) {
              const attributes = [
                "name",
                "duration",
                "increment",
                "type",
                "value",
              ];
              return attributes.some((attr) => {
                const value = element.getAttribute(attr);
                return (
                  value &&
                  (value.toLowerCase().includes("nan") ||
                    value === "NaN" ||
                    (attr === "duration" && isNaN(parseFloat(value))) ||
                    (attr === "increment" && isNaN(parseFloat(value))))
                );
              });
            }

            // Method 1: Look for gwd-counter elements
            const gwdCounters = document.querySelectorAll("gwd-counter");
            gwdCounters.forEach((counter) => {
              const counterHTML = counter.outerHTML;
              counters.push(counterHTML);

              // Check for NaN values
              if (
                hasNaNValue(counter) ||
                counterHTML.includes("NaN") ||
                counterHTML.includes("nan")
              ) {
                nanCounters.push(counterHTML);
              }
            });

            // Method 2: Check body element for counter attributes
            const bodyElement = document.querySelector("body");
            if (bodyElement) {
              // Look for counter-related attributes in body
              const attributes = ["name", "type", "duration", "increment"];
              const hasCounterAttrs = attributes.some((attr) =>
                bodyElement.hasAttribute(attr)
              );

              if (hasCounterAttrs && bodyElement.hasAttribute("name")) {
                let counterHtml = `<gwd-counter name="${bodyElement.getAttribute(
                  "name"
                )}"`;

                // Add other relevant attributes
                attributes.slice(1).forEach((attr) => {
                  if (bodyElement.hasAttribute(attr)) {
                    counterHtml += ` ${attr}="${bodyElement.getAttribute(
                      attr
                    )}"`;
                  }
                });

                counterHtml += "></gwd-counter>";
                counters.push(counterHtml);

                // Check for NaN values in body element
                if (
                  hasNaNValue(bodyElement) ||
                  counterHtml.includes("NaN") ||
                  counterHtml.includes("nan")
                ) {
                  nanCounters.push(counterHtml);
                }
              }
            }

            // Method 3: Look for any elements with counter-like names
            const elementsWithCounterAttrs = document.querySelectorAll(
              '[name*="counter"], [name*="vid"], [name*="cta"], [name*="isi"]'
            );
            elementsWithCounterAttrs.forEach((element) => {
              if (
                element.tagName.toLowerCase() !== "gwd-counter" &&
                element.tagName.toLowerCase() !== "body"
              ) {
                const name = element.getAttribute("name");
                if (name) {
                  const counterHtml = `<gwd-counter name="${name}"></gwd-counter>`;
                  counters.push(counterHtml);

                  // Check for NaN values
                  if (
                    hasNaNValue(element) ||
                    name.includes("NaN") ||
                    name.includes("nan")
                  ) {
                    nanCounters.push(counterHtml);
                  }
                }
              }
            });

            // Method 4: Scan entire DOM for elements that might have tracking attributes
            const allElements = document.querySelectorAll("*[name]");
            allElements.forEach((element) => {
              const name = element.getAttribute("name");
              if (
                name &&
                (name.includes("cta") ||
                  name.includes("vid") ||
                  name.includes("isi") ||
                  name.includes("counter") ||
                  name.includes("embd") ||
                  name.includes("lnk") ||
                  name.includes("btn") ||
                  name.includes("play") ||
                  name.includes("pause") ||
                  name.includes("scrb") ||
                  name.includes("participation") ||
                  name.includes("start") ||
                  name.includes("pct") ||
                  name.includes("length"))
              ) {
                // Check if we already have this counter
                const counterExists = counters.some((counter) =>
                  counter.includes(`name="${name}"`)
                );
                if (!counterExists) {
                  const counterHtml = `<gwd-counter name="${name}"></gwd-counter>`;
                  counters.push(counterHtml);

                  // Check for NaN values
                  if (
                    hasNaNValue(element) ||
                    name.includes("NaN") ||
                    name.includes("nan")
                  ) {
                    nanCounters.push(counterHtml);
                  }
                }
              }
            });

            console.log("Extracted counters:", counters);
            console.log("NaN counters found:", nanCounters);

            return {
              counters: counters,
              hasNaN: nanCounters.length > 0,
              nanCounters: nanCounters,
            };
          } catch (error) {
            console.error("Error in counter extraction:", error);
            return {
              counters: [],
              hasNaN: false,
              nanCounters: [],
            };
          }
        },
      });

      const result = results[0]?.result || {
        counters: [],
        hasNaN: false,
        nanCounters: [],
      };

      if (!result.counters || result.counters.length === 0) {
        this.showMessage("error", "❌ No gwd-counter elements found");
        this.clearOutput();
        return;
      }

      this.extractedCounters = result.counters;
      this.displayCounters(result.hasNaN, result.nanCounters);
    } catch (error) {
      console.error("Extraction error:", error);
      this.showMessage(
        "error",
        "❌ Failed to extract counters. Please refresh the page and try again."
      );
    }
  }

  displayCounters(hasNaN = false, nanCounters = []) {
    const counterHTML = this.extractedCounters.join("");
    this.elements.outputArea.textContent = counterHTML;

    // Update counter info
    this.elements.counterCount.textContent = `Found ${
      this.extractedCounters.length
    } counter${this.extractedCounters.length !== 1 ? "s" : ""}`;
    this.elements.counterInfo.style.display = "block";
    // Show NaN warning if any NaN values were detected
    debugger;
    if (hasNaN) {
      debugger;
      this.elements.nanWarning.style.display = "block";

      // Update warning message with exact styling
      this.elements.nanWarning.innerHTML = `
        <span class="warning-icon">⚠</span>
        <span class="warning-text">
          <strong>Warning:</strong> Found counters with "NaN" values. These may cause tracking issues!
        </span>
      `;
    } else {
      this.elements.nanWarning.style.display = "none";
    }

    // Enable copy button
    this.elements.copyBtn.disabled = false;

    this.showMessage(
      "success",
      `✅ Successfully extracted ${this.extractedCounters.length} gwd-counter elements!`,
      hasNaN
    );
  }

  clearOutput() {
    this.extractedCounters = [];
    this.elements.outputArea.textContent =
      "Extracted gwd-counter elements will appear here...";
    this.elements.counterInfo.style.display = "none";
    this.elements.copyBtn.disabled = true;
  }

  async copyToClipboard() {
    if (this.extractedCounters.length === 0) return;

    try {
      const counterHTML = this.extractedCounters.join("");
      await navigator.clipboard.writeText(counterHTML);
      this.showMessage("success", "✅ Copied to clipboard successfully!");

      // Hide success message after 3 seconds
      setTimeout(() => {
        this.hideMessages();
      }, 3000);
    } catch (error) {
      console.error("Copy failed:", error);

      // Fallback method for copying
      try {
        const textArea = document.createElement("textarea");
        textArea.value = this.extractedCounters.join("");
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        this.showMessage("success", "✅ Copied to clipboard successfully!");
      } catch (fallbackError) {
        console.error("Fallback copy also failed:", fallbackError);
        this.showMessage("error", "❌ Failed to copy to clipboard");
      }
    }
  }

  clearAll() {
    this.clearOutput();
    this.hideMessages();
  }

  async refreshPage() {
    if (!this.currentTab) return;

    try {
      await chrome.tabs.reload(this.currentTab.id);
      setTimeout(() => {
        this.loadCurrentTab();
        this.showMessage("success", "✅ Page refreshed");
      }, 1000);
    } catch (error) {
      console.error("Refresh error:", error);
      this.showMessage("error", "❌ Failed to refresh page");
    }
  }

  showMessage(type, message, isNaN = false) {
    this.hideMessages();

    if (type === "success") {
      this.elements.successMessage.textContent = message;
      this.elements.successMessage.style.display = "block";
    } else if (type === "error") {
      this.elements.errorMessage.textContent = message;
      this.elements.errorMessage.style.display = "block";
    }
  }

  hideMessages() {
    this.elements.successMessage.style.display = "none";
    this.elements.errorMessage.style.display = "none";
    if (!isNaN) {
      this.elements.nanWarning.style.display = "none";
    }
  }

  openModal() {
    this.elements.modalOverlay.classList.add("show");
  }

  closeModal() {
    this.elements.modalOverlay.classList.remove("show");
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new GWDExtractorPopup();
});
