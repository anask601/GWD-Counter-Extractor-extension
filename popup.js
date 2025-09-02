// Popup JavaScript for Chrome Extension
class GWDExtractorPopup {
  constructor() {
    this.currentTab = null;
    this.extractedCounters = [];
    this.videoInfo = [];
    this.initializeElements();
    this.bindEvents();
    this.loadCurrentTab();
  }

  initializeElements() {
    this.elements = {
      urlValue: document.getElementById("urlValue"),
      navigateBtn: document.getElementById("navigateBtn"),
      extractBtn: document.getElementById("extractBtn"),
      videoBtn: document.getElementById("videoBtn"),
      copyBtn: document.getElementById("copyBtn"),
      clearBtn: document.getElementById("clearBtn"),
      helpBtn: document.getElementById("helpBtn"),
      outputArea: document.getElementById("outputArea"),
      videoOutput: document.getElementById("videoOutput"),
      successMessage: document.getElementById("successMessage"),
      errorMessage: document.getElementById("errorMessage"),
      nanWarning: document.getElementById("nanWarning"),
      counterInfo: document.getElementById("counterInfo"),
      counterCount: document.getElementById("counterCount"),
      videoInfo: document.getElementById("videoInfo"),
      videoCount: document.getElementById("videoCount"),
      modalOverlay: document.getElementById("modalOverlay"),
      modalClose: document.getElementById("modalClose"),
    };
  }

  bindEvents() {
    // Changed from navigation to copy URL functionality
    this.elements.navigateBtn.addEventListener("click", () =>
      this.copyIndexUrl()
    );
    this.elements.extractBtn.addEventListener("click", () =>
      this.extractCounters()
    );
    this.elements.videoBtn.addEventListener("click", () =>
      this.extractVideoInfo()
    );
    this.elements.copyBtn.addEventListener("click", () =>
      this.copyToClipboard()
    );
    this.elements.clearBtn.addEventListener("click", () => this.clearAll());
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
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        this.extractVideoInfo();
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

      // Check if we're on a localhost URL and update button accordingly
      const isLocalhost = tab.url && tab.url.includes("localhost");
      this.elements.navigateBtn.disabled = !isLocalhost;

      if (!isLocalhost) {
        this.elements.navigateBtn.textContent = "🚫 Not on localhost";
      } else {
        this.elements.navigateBtn.textContent = "📋 Copy Index URL";
      }
    } catch (error) {
      console.error("Error loading current tab:", error);
      this.elements.urlValue.textContent = "Error loading URL";
      this.elements.navigateBtn.disabled = true;
    }
  }

  // Copy index.html URL instead of navigating
  async copyIndexUrl() {
    if (!this.currentTab) {
      this.showMessage("error", "❌ No active tab found");
      return;
    }

    try {
      const currentUrl = this.currentTab.url;
      let indexUrl;

      // Convert preview.html to index.html in the URL
      if (currentUrl.includes("/preview.html")) {
        indexUrl = currentUrl.replace("/preview.html", "/index.html");
      } else if (currentUrl.includes("/preview")) {
        indexUrl = currentUrl.replace("/preview", "/index.html");
      } else {
        // If not on preview, construct index URL from base
        const url = new URL(currentUrl);
        indexUrl = `${url.protocol}//${url.host}/index.html`;
      }

      // Copy the index URL to clipboard
      await navigator.clipboard.writeText(indexUrl);

      this.showMessage(
        "success",
        `✅ Index URL copied to clipboard: ${indexUrl}`
      );
    } catch (error) {
      console.error("Copy URL error:", error);

      // Fallback method for copying
      try {
        const currentUrl = this.currentTab.url;
        const indexUrl = currentUrl.includes("/preview.html")
          ? currentUrl.replace("/preview.html", "/index.html")
          : currentUrl.replace("/preview", "/index.html");

        const textArea = document.createElement("textarea");
        textArea.value = indexUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        this.showMessage("success", `✅ Index URL copied: ${indexUrl}`);
      } catch (fallbackError) {
        this.showMessage("error", "❌ Failed to copy index URL");
      }
    }
  }

  async extractVideoInfo() {
    if (!this.currentTab) {
      this.showMessage("error", "❌ No active tab found");
      return;
    }

    try {
      this.showMessage("info", "🎬 Analyzing videos...");

      // Inject content script to extract video information
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: () => {
          console.log("=== VIDEO EXTRACTION STARTED ===");

          const videoData = [];
          const videoPromises = [];

          try {
            // Find all video elements and source elements
            const videos = document.querySelectorAll("video");
            const sources = document.querySelectorAll("source");
            const videoUrls = new Set();

            // Extract URLs from video elements
            videos.forEach((video, index) => {
              if (video.src) {
                videoUrls.add(video.src);
                console.log(`Video ${index + 1} src:`, video.src);
              }

              // Check for currentSrc (actual playing source)
              if (video.currentSrc && video.currentSrc !== video.src) {
                videoUrls.add(video.currentSrc);
                console.log(`Video ${index + 1} currentSrc:`, video.currentSrc);
              }
            });

            // Extract URLs from source elements
            sources.forEach((source, index) => {
              if (source.src) {
                videoUrls.add(source.src);
                console.log(`Source ${index + 1} src:`, source.src);
              }
            });

            // Convert Set to Array for processing
            const uniqueUrls = Array.from(videoUrls);
            console.log("Unique video URLs found:", uniqueUrls);

            // Create promises to load each video and get duration
            uniqueUrls.forEach((url, index) => {
              const promise = new Promise((resolve) => {
                const tempVideo = document.createElement("video");
                tempVideo.preload = "metadata";
                tempVideo.crossOrigin = "anonymous";

                const timeout = setTimeout(() => {
                  resolve({
                    url: url,
                    duration: "Unknown (timeout)",
                    durationSeconds: null,
                    status: "timeout",
                    index: index + 1,
                  });
                }, 10000); // 10 second timeout

                tempVideo.onloadedmetadata = () => {
                  clearTimeout(timeout);
                  const duration = tempVideo.duration;
                  const minutes = Math.floor(duration / 60);
                  const seconds = Math.floor(duration % 60);
                  const formattedDuration = `${minutes}:${seconds
                    .toString()
                    .padStart(2, "0")}`;

                  resolve({
                    url: url,
                    duration: formattedDuration,
                    durationSeconds: duration,
                    status: "success",
                    index: index + 1,
                  });
                };

                tempVideo.onerror = () => {
                  clearTimeout(timeout);
                  resolve({
                    url: url,
                    duration: "Error loading video",
                    durationSeconds: null,
                    status: "error",
                    index: index + 1,
                  });
                };

                tempVideo.src = url;
              });

              videoPromises.push(promise);
            });

            // Wait for all videos to be processed (max 15 seconds total)
            return Promise.all(videoPromises).then((results) => {
              console.log("=== VIDEO ANALYSIS COMPLETE ===");
              console.log("Results:", results);
              return {
                videos: results,
                totalFound: results.length,
              };
            });
          } catch (error) {
            console.error("Error in video extraction:", error);
            return {
              videos: [],
              totalFound: 0,
              error: error.message,
            };
          }
        },
      });

      const result = results[0]?.result || { videos: [], totalFound: 0 };

      if (!result.videos || result.videos.length === 0) {
        this.showMessage("error", "❌ No video sources found on this page");
        this.clearVideoOutput();
        return;
      }

      this.videoInfo = result.videos;
      this.displayVideoInfo();
    } catch (error) {
      console.error("Video extraction error:", error);
      this.showMessage(
        "error",
        "❌ Failed to analyze videos. Please try again."
      );
    }
  }

  displayVideoInfo() {
    let videoOutput = "=== VIDEO ANALYSIS RESULTS ===\n\n";

    this.videoInfo.forEach((video, index) => {
      videoOutput += `Video ${video.index}:\n`;
      videoOutput += `URL: ${video.url}\n`;
      videoOutput += `Duration: ${video.duration}\n`;
      videoOutput += `Status: ${video.status}\n`;
      if (video.durationSeconds) {
        videoOutput += `Duration (seconds): ${video.durationSeconds.toFixed(
          2
        )}\n`;
      }
    });

    this.elements.videoOutput.textContent = videoOutput;

    // Update video info
    const successCount = this.videoInfo.filter(
      (v) => v.status === "success"
    ).length;
    this.elements.videoCount.textContent = `Found ${
      this.videoInfo.length
    } video${
      this.videoInfo.length !== 1 ? "s" : ""
    } (${successCount} analyzed successfully)`;
    this.elements.videoInfo.style.display = "block";

    this.showMessage(
      "success",
      `✅ Analyzed ${this.videoInfo.length} video source${
        this.videoInfo.length !== 1 ? "s" : ""
      }!`
    );
  }

  clearVideoOutput() {
    this.videoInfo = [];
    this.elements.videoOutput.textContent =
      "Video analysis results will appear here...";
    this.elements.videoInfo.style.display = "none";
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
    if (hasNaN) {
      this.elements.nanWarning.style.display = "block";
      this.elements.nanWarning.innerHTML = `
      <span class="warning-icon">⚠</span>
      <span class="warning-text">
        <strong>Warning:</strong> Found counters with "NaN" values. These may cause tracking issues!
      </span>
    `;
    } else {
      this.elements.nanWarning.style.display = "none";
    }

    // Enable copy button only when there are counters
    this.elements.copyBtn.disabled = false;

    this.showMessage(
      "success",
      `✅ Successfully extracted ${this.extractedCounters.length} gwd-counter elements!`
    );
  }

  clearOutput() {
    this.extractedCounters = [];
    this.elements.outputArea.textContent =
      "Extracted gwd-counter elements will appear here...";
    this.elements.counterInfo.style.display = "none";
    this.elements.nanWarning.style.display = "none";
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
    this.clearVideoOutput();
    this.hideMessages();
  }

  showMessage(type, message) {
    this.hideMessages();

    if (type === "success" || type === "info") {
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
