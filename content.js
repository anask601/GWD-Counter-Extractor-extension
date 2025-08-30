// Content script for GWD Counter Extractor
class GWDCounterContentScript {
  constructor() {
    this.isInjected = false;
    this.initialize();
  }

  initialize() {
    // Prevent multiple injections
    if (window.gwdExtractorInjected) return;
    window.gwdExtractorInjected = true;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "extractCounters") {
        const counters = this.extractCounters();
        sendResponse({ counters });
      } else if (request.action === "getPageInfo") {
        sendResponse({
          url: window.location.href,
          title: document.title,
          hasCounters: this.hasGWDCounters(),
        });
      }
    });

    console.log("GWD Counter Extractor content script loaded");
  }

  extractCounters() {
    const counters = [];

    try {
      // Method 1: Look for gwd-counter elements
      const gwdCounters = document.querySelectorAll("gwd-counter");
      gwdCounters.forEach((counter) => {
        counters.push(counter.outerHTML);
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
              counterHtml += ` ${attr}="${bodyElement.getAttribute(attr)}"`;
            }
          });

          counterHtml += "></gwd-counter>";
          counters.push(counterHtml);
        }
      }

      // Method 3: Look for any elements with gwd-counter-like attributes
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
            counters.push(`<gwd-counter name="${name}"></gwd-counter>`);
          }
        }
      });

      console.log(`Found ${counters.length} counter elements:`, counters);
      return counters;
    } catch (error) {
      console.error("Error extracting counters:", error);
      return [];
    }
  }

  hasGWDCounters() {
    const gwdCounters = document.querySelectorAll("gwd-counter");
    const bodyWithCounterAttrs = document.querySelector("body[name]");
    const elementsWithCounterAttrs = document.querySelectorAll(
      '[name*="counter"], [name*="vid"], [name*="cta"], [name*="isi"]'
    );

    return (
      gwdCounters.length > 0 ||
      bodyWithCounterAttrs ||
      elementsWithCounterAttrs.length > 0
    );
  }

  // Helper method to highlight elements (for debugging)
  highlightCounters() {
    const style = document.createElement("style");
    style.textContent = `
      gwd-counter, [name*="counter"], [name*="vid"], [name*="cta"], [name*="isi"] {
        outline: 2px solid #ff0000 !important;
        background: rgba(255, 0, 0, 0.1) !important;
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      document.head.removeChild(style);
    }, 5000);
  }
}

// Initialize content script
new GWDCounterContentScript();
