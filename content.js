// Content Script - Runs on localhost pages
(function() {
  'use strict';

  // Check if this is a GWD page
  function isGWDPage() {
    const url = window.location.href.toLowerCase();
    return (url.includes('localhost') || url.includes('127.0.0.1')) &&
           (url.includes('preview.html') || url.includes('index.html') || url.endsWith('.html'));
  }

  // Check if notification has been shown
  function shouldShowNotification() {
    const shown = sessionStorage.getItem('gwdNotificationShown');
    return !shown;
  }

  // Create and show notification
  function showGWDNotification() {
    // Check if already exists
    if (document.getElementById('gwd-test-reminder')) {
      return;
    }

    // Create notification container
    const notification = document.createElement('div');
    notification.id = 'gwd-test-reminder';
    notification.className = 'gwd-notification';
    notification.innerHTML = `
      <div class="gwd-notification-content">
        <div class="gwd-notification-header">
          <div class="gwd-notification-icon">🧪</div>
          <div class="gwd-notification-title">
            <strong>GWD Testing Reminder</strong>
            <button class="gwd-notification-close" id="gwdNotificationClose">×</button>
          </div>
        </div>
        <div class="gwd-notification-message">
          Remember to <strong>test all GWD counters thoroughly</strong> before deployment!
          <br>Use the extension to extract and verify counters.
        </div>
        <div class="gwd-notification-actions">
          <button class="gwd-btn-primary" id="gwdOpenExtension">Open Extension</button>
          <button class="gwd-btn-secondary" id="gwdDismiss">Got it</button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Show notification with animation
    setTimeout(() => {
      notification.classList.add('gwd-notification-show');
    }, 100);

    // Event listeners
    document.getElementById('gwdNotificationClose').addEventListener('click', dismissNotification);
    document.getElementById('gwdDismiss').addEventListener('click', dismissNotification);
    document.getElementById('gwdOpenExtension').addEventListener('click', () => {
      // Send message to background script to open extension
      chrome.runtime.sendMessage({ action: 'openExtension' });
      dismissNotification();
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      dismissNotification();
    }, 15000);
  }

  function dismissNotification() {
    const notification = document.getElementById('gwd-test-reminder');
    if (notification) {
      notification.classList.remove('gwd-notification-show');
      notification.classList.add('gwd-notification-hide');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
    sessionStorage.setItem('gwdNotificationShown', 'true');
  }

  // Initialize
  if (isGWDPage() && shouldShowNotification()) {
    // Wait a bit for page to load
    setTimeout(() => {
      showGWDNotification();
    }, 1500);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkGWDPage') {
      sendResponse({ isGWD: isGWDPage() });
    }
  });
})();