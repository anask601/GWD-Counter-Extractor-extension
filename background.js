// Background script for GWD Counter Extractor
class GWDExtractorBackground {
  constructor() {
    this.initialize();
  }

  initialize() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      console.log("GWD Counter Extractor installed:", details.reason);

      if (details.reason === "install") {
        this.showWelcomeNotification();
      }
    });

    // Handle messages from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "extractCounters") {
        this.handleExtractCounters(sender.tab.id, sendResponse);
        return true; // Keep message channel open for async response
      }
    });

    // Handle tab updates to check for GWD pages
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.checkForGWDPage(tab);
      }
    });
  }

  showWelcomeNotification() {
    try {
      // Check if notifications API is available
      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "GWD Counter Extractor",
          message:
            "Extension installed! Click the extension icon to start extracting GWD counters.",
        });
      } else {
        // Fallback: just log to console if notifications aren't available
        console.log("GWD Counter Extractor installed successfully!");
      }
    } catch (error) {
      console.error("Error showing welcome notification:", error);
      // Silent fail - don't break the extension if notifications fail
    }
  }

  async handleExtractCounters(tabId, sendResponse) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          // This function runs in the page context
          const counters = [];
          const nanCounters = [];

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

          // Look for gwd-counter elements
          const gwdCounters = document.querySelectorAll("gwd-counter");
          gwdCounters.forEach((counter) => {
            const counterHTML = counter.outerHTML;
            counters.push(counterHTML);

            if (
              hasNaNValue(counter) ||
              counterHTML.includes("NaN") ||
              counterHTML.includes("nan")
            ) {
              nanCounters.push(counterHTML);
            }
          });

          // Check body element
          const bodyElement = document.querySelector("body");
          if (bodyElement && bodyElement.hasAttribute("name")) {
            let counterHtml = `<gwd-counter name="${bodyElement.getAttribute(
              "name"
            )}"`;

            ["type", "duration", "increment"].forEach((attr) => {
              if (bodyElement.hasAttribute(attr)) {
                counterHtml += ` ${attr}="${bodyElement.getAttribute(attr)}"`;
              }
            });

            counterHtml += "></gwd-counter>";
            counters.push(counterHtml);

            if (
              hasNaNValue(bodyElement) ||
              counterHtml.includes("NaN") ||
              counterHtml.includes("nan")
            ) {
              nanCounters.push(counterHtml);
            }
          }

          // Look for other elements with counter-like attributes
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
              if (
                !counterExists &&
                element.tagName.toLowerCase() !== "gwd-counter" &&
                element.tagName.toLowerCase() !== "body"
              ) {
                const counterHtml = `<gwd-counter name="${name}"></gwd-counter>`;
                counters.push(counterHtml);

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

          return {
            counters: counters,
            hasNaN: nanCounters.length > 0,
            nanCounters: nanCounters,
          };
        },
      });

      const result = results[0]?.result || {
        counters: [],
        hasNaN: false,
        nanCounters: [],
      };
      sendResponse({ success: true, ...result });
    } catch (error) {
      console.error("Error in handleExtractCounters:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  checkForGWDPage(tab) {
    try {
      // Check if the page might be a GWD page
      if (
        tab.url &&
        (tab.url.includes("localhost") ||
          tab.url.includes("preview.html") ||
          tab.url.includes("index.html"))
      ) {
        // Update badge to indicate potential GWD page
        chrome.action.setBadgeText({
          tabId: tab.id,
          text: "GWD",
        });

        chrome.action.setBadgeBackgroundColor({
          tabId: tab.id,
          color: "#4facfe",
        });
      } else {
        // Clear badge for non-GWD pages
        chrome.action.setBadgeText({
          tabId: tab.id,
          text: "",
        });
      }
    } catch (error) {
      console.error("Error in checkForGWDPage:", error);
      // Silent fail - don't break the extension
    }
  }
}

// Initialize background script
try {
  new GWDExtractorBackground();
} catch (error) {
  console.error("Error initializing GWD Extractor Background:", error);
}
