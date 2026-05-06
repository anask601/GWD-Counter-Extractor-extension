class GWDExtractorPopup {
  constructor() {
    this.currentTab = null;
    this.extractedCounters = [];
    this.videoInfo = [];
    this.duplicateCounters = [];
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
      removeDuplicatesBtn: document.getElementById("removeDuplicatesBtn"),
      duplicateButtonGroup: document.getElementById("duplicateButtonGroup"),
      outputArea: document.getElementById("outputArea"),
      videoOutput: document.getElementById("videoOutput"),
      duplicateOutput: document.getElementById("duplicateOutput"),
      successMessage: document.getElementById("successMessage"),
      infoMessage: document.getElementById("infoMessage"),
      errorMessage: document.getElementById("errorMessage"),
      nanWarning: document.getElementById("nanWarning"),
      duplicateWarning: document.getElementById("duplicateWarning"),
      counterInfo: document.getElementById("counterInfo"),
      counterCount: document.getElementById("counterCount"),
      videoInfo: document.getElementById("videoInfo"),
      videoCount: document.getElementById("videoCount"),
      duplicateInfo: document.getElementById("duplicateInfo"),
      duplicateCount: document.getElementById("duplicateCount"),
      modalOverlay: document.getElementById("modalOverlay"),
      modalClose: document.getElementById("modalClose"),
    };
  }

  bindEvents() {
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

    if (this.elements.removeDuplicatesBtn) {
      this.elements.removeDuplicatesBtn.addEventListener("click", () =>
        this.removeDuplicates()
      );
    }

    this.elements.modalClose.addEventListener("click", () => this.closeModal());
    this.elements.modalOverlay.addEventListener("click", (e) => {
      if (e.target === this.elements.modalOverlay) {
        this.closeModal();
      }
    });

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

  convertToStagingUrl(productionUrl) {
    return productionUrl.replace(
      "https://img.medscapestatic.com",
      "https://img.staging.medscapestatic.com"
    );
  }

  async analyzeVideosFromUrls(urls, source = "production") {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: (videoUrls) => {
          console.log(
            `=== ${videoUrls.source.toUpperCase()} VIDEO EXTRACTION STARTED ===`
          );
          console.log("Video URLs:", videoUrls.urls);

          const videoPromises = videoUrls.urls.map((url, index) => {
            return new Promise((resolve) => {
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
              }, 15000);

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
          });

          return Promise.all(videoPromises).then((results) => {
            console.log(
              `=== ${videoUrls.source.toUpperCase()} VIDEO ANALYSIS COMPLETE ===`
            );
            console.log("Results:", results);
            return {
              videos: results,
              totalFound: results.length,
            };
          });
        },
        args: [{ urls, source }],
      });

      return results[0]?.result || { videos: [], totalFound: 0 };
    } catch (error) {
      console.error(`${source} video extraction error:`, error);
      return { videos: [], totalFound: 0 };
    }
  }

  async copyIndexUrl() {
    if (!this.currentTab) {
      this.showMessage("error", "❌ No active tab found");
      return;
    }

    try {
      const currentUrl = this.currentTab.url;
      let indexUrl;

      if (currentUrl.includes("/preview.html")) {
        indexUrl = currentUrl.replace("/preview.html", "/index.html");
      } else if (currentUrl.includes("/preview")) {
        indexUrl = currentUrl.replace("/preview", "/index.html");
      } else {
        const url = new URL(currentUrl);
        indexUrl = `${url.protocol}//${url.host}/index.html`;
      }

      await navigator.clipboard.writeText(indexUrl);

      this.showMessage(
        "success",
        `✅ Index URL copied to clipboard: ${indexUrl}`
      );
    } catch (error) {
      console.error("Copy URL error:", error);

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
      this.showMessage("info", "🎬 Analyzing videos from live URL...");

      // Step 1: Get all video URLs from the page
      const videoUrlResults = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: () => {
          const videoUrls = new Set();
          const videos = document.querySelectorAll("video");
          const sources = document.querySelectorAll("source");

          videos.forEach((video) => {
            if (video.src) videoUrls.add(video.src);
            if (video.currentSrc && video.currentSrc !== video.src) {
              videoUrls.add(video.currentSrc);
            }
          });

          sources.forEach((source) => {
            if (source.src) videoUrls.add(source.src);
          });

          return Array.from(videoUrls);
        },
      });

      const productionUrls = videoUrlResults[0]?.result || [];

      if (productionUrls.length === 0) {
        this.showMessage("error", "❌ No video sources found on this page");
        this.clearVideoOutput();
        return;
      }

      // Step 2: Try analyzing from production URLs
      let result = await this.analyzeVideosFromUrls(
        productionUrls,
        "production"
      );

      // Step 3: Check if production failed
      const hasErrors = result.videos.some(
        (v) => v.status === "error" || v.status === "timeout"
      );
      const allFailed = result.videos.every(
        (v) => v.status === "error" || v.status === "timeout"
      );

      // Step 4: If production failed, try staging
      if (allFailed || hasErrors) {
        this.showMessage("info", "⚠️ Live URL failed, trying staging URL...");

        const stagingUrls = productionUrls.map((url) =>
          this.convertToStagingUrl(url)
        );
        const stagingResult = await this.analyzeVideosFromUrls(
          stagingUrls,
          "staging"
        );

        // Use staging results if they're better
        const stagingSuccessCount = stagingResult.videos.filter(
          (v) => v.status === "success"
        ).length;
        const productionSuccessCount = result.videos.filter(
          (v) => v.status === "success"
        ).length;

        if (stagingSuccessCount > productionSuccessCount) {
          result = stagingResult;
          this.showMessage(
            "success",
            "✅ Successfully analyzed from staging URL!"
          );
        }
      }

      if (!result.videos || result.videos.length === 0) {
        this.showMessage(
          "error",
          "❌ Failed to analyze videos from both live and staging URLs"
        );
        this.clearVideoOutput();
        return;
      }

      this.videoInfo = result.videos;
      this.displayVideoInfo();

      if (this.extractedCounters.length > 0) {
        this.processCountersForNaN();

        const stillHasNaN = this.extractedCounters.some(
          (counter) => counter.includes("_NaN") || counter.includes("_nan")
        );

        this.detectDuplicates();
        this.displayCounters(stillHasNaN, []);
      }
    } catch (error) {
      console.error("Video extraction error:", error);
      this.showMessage(
        "error",
        "❌ Failed to analyze videos. Please try again."
      );
    }
  }

  displayVideoInfo() {
    const source = this.videoInfo[0]?.url.includes("staging")
      ? "STAGING"
      : "PRODUCTION";
    let videoOutput = `=== VIDEO ANALYSIS RESULTS (${source}) ===\n\n`;

    this.videoInfo.forEach((video) => {
      videoOutput += `Video ${video.index}:\n`;
      videoOutput += `URL: ${video.url}\n`;
      videoOutput += `Duration: ${video.duration}\n`;
      videoOutput += `Status: ${video.status}\n`;
      if (video.durationSeconds) {
        videoOutput += `Duration (seconds): ${video.durationSeconds.toFixed(
          2
        )}\n`;
      }
      videoOutput += "\n";
    });

    this.elements.videoOutput.textContent = videoOutput;

    const successCount = this.videoInfo.filter(
      (v) => v.status === "success"
    ).length;
    this.elements.videoCount.textContent = `Found ${
      this.videoInfo.length
    } video${
      this.videoInfo.length !== 1 ? "s" : ""
    } (${successCount} analyzed successfully from ${source})`;
    this.elements.videoInfo.style.display = "block";

    this.showMessage(
      "success",
      `✅ Analyzed ${this.videoInfo.length} video source${
        this.videoInfo.length !== 1 ? "s" : ""
      } from ${source}!`
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
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: () => {
          const counters = [];
          const nanCounters = [];

          try {
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

            const bodyElement = document.querySelector("body");
            if (bodyElement) {
              const attributes = ["name", "type", "duration", "increment"];
              const hasCounterAttrs = attributes.some((attr) =>
                bodyElement.hasAttribute(attr)
              );

              if (hasCounterAttrs && bodyElement.hasAttribute("name")) {
                let counterHtml = `<gwd-counter name="${bodyElement.getAttribute(
                  "name"
                )}"`;

                attributes.slice(1).forEach((attr) => {
                  if (bodyElement.hasAttribute(attr)) {
                    counterHtml += ` ${attr}="${bodyElement.getAttribute(
                      attr
                    )}"`;
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
            }

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
                const counterExists = counters.some((counter) =>
                  counter.includes(`name="${name}"`)
                );
                if (!counterExists) {
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

      this.detectDuplicates();

      this.processCountersForNaN();

      const stillHasNaN = this.extractedCounters.some(
        (counter) => counter.includes("_NaN") || counter.includes("_nan")
      );

      this.displayCounters(stillHasNaN, result.nanCounters);
    } catch (error) {
      console.error("Extraction error:", error);
      this.showMessage(
        "error",
        "❌ Failed to extract counters. Please refresh the page and try again."
      );
    }
  }

  detectDuplicates() {
    const counterMap = new Map();
    this.duplicateCounters = [];

    this.extractedCounters.forEach((counter) => {
      const nameMatch = counter.match(/name="([^"]+)"/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (counterMap.has(name)) {
          counterMap.set(name, counterMap.get(name) + 1);
        } else {
          counterMap.set(name, 1);
        }
      }
    });

    counterMap.forEach((count, name) => {
      if (count > 1) {
        this.duplicateCounters.push({
          name: name,
          count: count,
        });
      }
    });

    console.log("Duplicate counters detected:", this.duplicateCounters);

    this.displayDuplicates();
  }

  displayDuplicates() {
    if (!this.elements.duplicateWarning || !this.elements.duplicateInfo) {
      return;
    }

    if (this.duplicateCounters.length === 0) {
      this.elements.duplicateWarning.style.display = "none";
      this.elements.duplicateInfo.style.display = "none";
      this.elements.duplicateButtonGroup.style.display = "none";
      if (this.elements.removeDuplicatesBtn) {
        this.elements.removeDuplicatesBtn.disabled = true;
      }
      return;
    }

    this.elements.duplicateWarning.style.display = "block";
    this.elements.duplicateWarning.innerHTML = `
      <span class="warning-icon">🔄</span>
      <span class="warning-text">
        <strong>Duplicates Detected:</strong> Found ${
          this.duplicateCounters.length
        } duplicate counter${this.duplicateCounters.length !== 1 ? "s" : ""}!
      </span>
    `;

    let duplicateOutput = "=== DUPLICATE COUNTERS ===\n\n";
    this.duplicateCounters.forEach((dup) => {
      duplicateOutput += `"${dup.name}" appears ${dup.count} times\n`;
    });
    duplicateOutput += "\n⚠ Duplicates may cause tracking issues!\n";

    if (this.elements.duplicateOutput) {
      this.elements.duplicateOutput.textContent = duplicateOutput;
    }

    if (this.elements.duplicateCount) {
      this.elements.duplicateCount.textContent = `${
        this.duplicateCounters.length
      } duplicate${this.duplicateCounters.length !== 1 ? "s" : ""} found`;
    }

    this.elements.duplicateInfo.style.display = "block";
    this.elements.duplicateButtonGroup.style.display = "block";

    if (this.elements.removeDuplicatesBtn) {
      this.elements.removeDuplicatesBtn.disabled = false;
    }
  }

  removeDuplicates() {
    if (this.duplicateCounters.length === 0) {
      this.showMessage("info", "ℹ️ No duplicates to remove");
      return;
    }

    const originalCount = this.extractedCounters.length;
    const seen = new Set();
    const uniqueCounters = [];

    this.extractedCounters.forEach((counter) => {
      const nameMatch = counter.match(/name="([^"]+)"/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (!seen.has(name)) {
          seen.add(name);
          uniqueCounters.push(counter);
        }
      }
    });

    this.extractedCounters = uniqueCounters;
    const removedCount = originalCount - uniqueCounters.length;

    this.duplicateCounters = [];
    this.displayDuplicates();

    const stillHasNaN = this.extractedCounters.some(
      (counter) => counter.includes("_NaN") || counter.includes("_nan")
    );
    this.displayCounters(stillHasNaN, []);

    this.showMessage(
      "success",
      `✅ Removed ${removedCount} duplicate counter${
        removedCount !== 1 ? "s" : ""
      }!`
    );
  }

  processCountersForNaN() {
    if (!this.videoInfo || this.videoInfo.length === 0) {
      console.log("No video info available for NaN replacement");
      return;
    }

    const successfulVideo = this.videoInfo.find(
      (video) => video.status === "success" && video.durationSeconds
    );

    if (!successfulVideo) {
      console.log("No successful video analysis found");
      return;
    }

    const durationSeconds = Math.round(successfulVideo.durationSeconds);
    let hasChanges = false;

    const counterGroups = new Map();

    this.extractedCounters.forEach((counter, index) => {
      const nameMatch = counter.match(/name="([^"]+)"/);
      if (nameMatch) {
        const fullName = nameMatch[1];

        let baseName = fullName;
        let suffix = "";
        let isNaN = false;

        if (/_NaN$/i.test(fullName)) {
          baseName = fullName.replace(/_NaN$/i, "");
          suffix = "NaN";
          isNaN = true;
        } else if (/_\d+$/.test(fullName)) {
          const match = fullName.match(/^(.+)_(\d+)$/);
          if (match) {
            baseName = match[1];
            suffix = match[2];
          }
        }

        if (!counterGroups.has(baseName)) {
          counterGroups.set(baseName, {
            nanCounters: [],
            numericCounters: [],
            otherCounters: [],
          });
        }

        const group = counterGroups.get(baseName);

        if (isNaN) {
          group.nanCounters.push({ counter, index, fullName });
        } else if (/_\d+$/.test(fullName)) {
          group.numericCounters.push({ counter, index, fullName });
        } else {
          group.otherCounters.push({ counter, index, fullName });
        }
      }
    });

    const indicesToRemove = new Set();

    counterGroups.forEach((group, baseName) => {
      if (group.nanCounters.length > 0 && group.numericCounters.length > 0) {
        console.log(`Found conflict for ${baseName}: removing NaN versions`);
        group.nanCounters.forEach((nanItem) => {
          console.log(`Removing: ${nanItem.fullName}`);
          indicesToRemove.add(nanItem.index);
          hasChanges = true;
        });
      }
    });

    const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
    sortedIndices.forEach((index) => {
      this.extractedCounters.splice(index, 1);
    });

    this.extractedCounters = this.extractedCounters.map((counter) => {
      if (counter.includes("_NaN") || counter.includes("_nan")) {
        const nameMatch = counter.match(/name="([^"]+)"/);
        if (nameMatch) {
          const fullName = nameMatch[1];
          const baseName = fullName.replace(/_NaN$|_nan$/i, "");

          if (baseName.includes("vid-length") || baseName.includes("length")) {
            const updatedCounter = counter.replace(
              /_NaN|_nan/i,
              `_${durationSeconds}`
            );
            console.log(
              `Replaced ${fullName} with ${baseName}_${durationSeconds}`
            );
            hasChanges = true;
            return updatedCounter;
          }
        }
      }
      return counter;
    });

    if (hasChanges) {
      this.detectDuplicates();

      this.showMessage(
        "success",
        `✅ Processed NaN counters with video duration: ${durationSeconds}s`
      );
    }
  }

  displayCounters(hasNaN = false, nanCounters = []) {
    const counterHTML = this.extractedCounters.join("");
    this.elements.outputArea.textContent = counterHTML;

    this.elements.counterCount.textContent = `Found ${
      this.extractedCounters.length
    } counter${this.extractedCounters.length !== 1 ? "s" : ""}`;
    this.elements.counterInfo.style.display = "block";

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

    this.elements.copyBtn.disabled = false;

    this.showMessage(
      "success",
      `✅ Successfully extracted ${this.extractedCounters.length} gwd-counter elements!`
    );
  }

  clearOutput() {
    this.extractedCounters = [];
    this.duplicateCounters = [];
    this.elements.outputArea.textContent =
      "Extracted gwd-counter elements will appear here...";
    this.elements.counterInfo.style.display = "none";
    this.elements.nanWarning.style.display = "none";

    if (this.elements.duplicateWarning) {
      this.elements.duplicateWarning.style.display = "none";
    }
    if (this.elements.duplicateInfo) {
      this.elements.duplicateInfo.style.display = "none";
    }
    if (this.elements.duplicateButtonGroup) {
      this.elements.duplicateButtonGroup.style.display = "none";
    }

    this.elements.copyBtn.disabled = true;

    if (this.elements.removeDuplicatesBtn) {
      this.elements.removeDuplicatesBtn.disabled = true;
    }
  }

  async copyToClipboard() {
    if (this.extractedCounters.length === 0) return;

    try {
      const counterHTML = this.extractedCounters.join("");
      await navigator.clipboard.writeText(counterHTML);
      this.showMessage("success", "✅ Copied to clipboard successfully!");

      setTimeout(() => {
        this.hideMessages();
      }, 3000);
    } catch (error) {
      console.error("Copy failed:", error);

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

    if (type === "success") {
      this.elements.successMessage.textContent = message;
      this.elements.successMessage.style.display = "block";
    } else if (type === "info") {
      this.elements.infoMessage.textContent = message;
      this.elements.infoMessage.style.display = "block";
    } else if (type === "error") {
      this.elements.errorMessage.textContent = message;
      this.elements.errorMessage.style.display = "block";
    }
  }

  hideMessages() {
    this.elements.successMessage.style.display = "none";
    this.elements.infoMessage.style.display = "none";
    this.elements.errorMessage.style.display = "none";
  }

  openModal() {
    this.elements.modalOverlay.classList.add("show");
  }

  closeModal() {
    this.elements.modalOverlay.classList.remove("show");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GWDExtractorPopup();
});
