/* Stage-first browser shell. Playback, particles, lyrics and queue stay in the legacy engine. */
(function () {
  'use strict';
  if (document.body.classList.contains('desktop-shell')) return;
  if (!window.matchMedia('(min-width: 768px)').matches) {
    document.body.classList.remove(
      'web-player-layout', 'web-player-stage-only', 'web-stage-boot',
      'web-player-controls-hidden', 'home-controls-locked'
    );
    return;
  }

  document.body.classList.add('web-player-layout', 'web-player-stage-only');

  var searchHideTimer = null;
  var playerHideTimer = null;
  var libraryHovering = false;
  var searchHovering = false;
  var playerHovering = false;
  var SEARCH_IDLE_MS = 2800;
  var PLAYER_IDLE_MS = 3200;

  function forcePlayerStage() {
    window.homeSuppressed = true;
    window.homeForcedOpen = false;
    window.emptyHomeActive = false;
    window.startupLoginGuideShown = true;
    document.body.classList.remove('empty-home-active', 'hp-sidebar-open', 'home-controls-locked');
    var home = document.getElementById('empty-home');
    if (home) home.setAttribute('aria-hidden', 'true');
    if (typeof window.deactivateHomeWallpaperPreview === 'function') window.deactivateHomeWallpaperPreview(false);
  }

  function resetLegacyPanels() {
    var playlistPanel = document.getElementById('playlist-panel');
    if (playlistPanel) {
      playlistPanel.classList.remove('show', 'peek', 'pinned', 'closing');
      playlistPanel.removeAttribute('data-preserve-tab-on-open');
    }
    if (typeof window.playlistPanelPinned !== 'undefined') window.playlistPanelPinned = false;
  }

  function settingsIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 14.8 6l-.3-2.5h-4L10.2 6a7 7 0 0 0-1.7 1.1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 6 12c0 .3 0 .7.1 1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1.1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"></path></svg>';
  }

  function isSettingsOpen() {
    var panel = document.getElementById('fx-panel');
    return !!(panel && (panel.classList.contains('show') || panel.classList.contains('peek')));
  }

  function syncSettingsButton() {
    var panel = document.getElementById('fx-panel');
    if (panel && panel.classList.contains('web-settings-drawer')) {
      var legacyOpen = panel.classList.contains('show') || panel.classList.contains('peek');
      if (legacyOpen && !panel.classList.contains('web-drawer-open')) {
        window.requestAnimationFrame(function () {
          if (panel.classList.contains('show') || panel.classList.contains('peek')) panel.classList.add('web-drawer-open');
        });
      }
      if (!legacyOpen && panel.classList.contains('web-drawer-open')) panel.classList.remove('web-drawer-open');
    }
    var button = document.getElementById('web-settings-btn');
    if (button) button.setAttribute('aria-expanded', isSettingsOpen() ? 'true' : 'false');
  }

  function toggleWebSettings(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    var panel = document.getElementById('fx-panel');
    if (!panel) return;
    if (isSettingsOpen()) {
      if (typeof window.toggleFxPanel === 'function') window.toggleFxPanel(false);
      else panel.classList.remove('show', 'peek');
    } else {
      var playlistPanel = document.getElementById('playlist-panel');
      if (playlistPanel) playlistPanel.classList.remove('show', 'peek');
      if (typeof window.organizeFxPanel === 'function') window.organizeFxPanel();
      if (typeof window.toggleFxPanel === 'function') window.toggleFxPanel(true);
      /* The legacy edge-hover panel uses `peek` and closes while the pointer
         travels from the top-right button. A settings button needs a pinned
         drawer, so promote it to the persistent `show` state. */
      panel.classList.remove('peek', 'closing');
      panel.classList.add('show');
    }
    window.setTimeout(syncSettingsButton, 0);
  }

  function updateLibraryDrawer(event) {
    if (!event || event.pointerType === 'touch') return;
    var panel = document.getElementById('playlist-panel');
    if (!panel) return;
    var x = event.clientX;
    var y = event.clientY;
    var edgeHit = x >= 0 && x < 58 && y > 104 && y < window.innerHeight - 104;
    var rect = panel.getBoundingClientRect();
    var panelOpen = panel.classList.contains('peek') || panel.classList.contains('show');
    var panelHit = panelOpen && x >= rect.left - 18 && x <= rect.right + 24 && y >= rect.top - 20 && y <= rect.bottom + 20;
    if (edgeHit || panelHit) {
      if (!libraryHovering) {
        libraryHovering = true;
        var settingsPanel = document.getElementById('fx-panel');
        if (settingsPanel) settingsPanel.classList.remove('show', 'peek');
      }
      if (typeof window.setPeek === 'function') window.setPeek(panel, true, 'pl');
      else panel.classList.add('peek');
      return;
    }
    if (libraryHovering && panelOpen && x > rect.right + 54) {
      libraryHovering = false;
      if (typeof window.setPeek === 'function') window.setPeek(panel, false, 'pl');
      else panel.classList.remove('peek');
    }
  }

  function ensureSettingsCloseButton() {
    var head = document.querySelector('#fx-panel .fx-head');
    if (!head || document.getElementById('web-settings-close')) return;
    var title = head.querySelector('.fx-title');
    var sub = head.querySelector('.fx-sub');
    if (title) title.textContent = '\u8bbe\u7f6e';
    if (sub) sub.textContent = '\u64ad\u653e\u3001\u6b4c\u8bcd\u4e0e\u89c6\u89c9';
    var close = document.createElement('button');
    close.id = 'web-settings-close';
    close.className = 'web-settings-close';
    close.type = 'button';
    close.setAttribute('aria-label', '\u5173\u95ed\u8bbe\u7f6e');
    close.title = '\u5173\u95ed\u8bbe\u7f6e';
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
    close.addEventListener('click', toggleWebSettings);
    head.appendChild(close);
  }

  function ensureTopTools() {
    var topRight = document.getElementById('top-right');
    var userButton = document.getElementById('user-btn');
    var homeButton = document.getElementById('home-btn');
    var hideButton = document.getElementById('user-capsule-hide-btn');
    if (homeButton) homeButton.style.display = 'none';
    if (hideButton) hideButton.style.display = 'none';
    if (!topRight || !userButton) return;
    userButton.setAttribute('aria-label', '\u767b\u5f55\u4e0e\u8d26\u53f7');
    userButton.title = '\u767b\u5f55\u4e0e\u8d26\u53f7';
    var settings = document.getElementById('web-settings-btn');
    if (!settings) {
      settings = document.createElement('button');
      settings.id = 'web-settings-btn';
      settings.className = 'web-top-tool';
      settings.type = 'button';
      settings.setAttribute('aria-label', '\u8bbe\u7f6e');
      settings.setAttribute('aria-controls', 'fx-panel');
      settings.setAttribute('aria-expanded', 'false');
      settings.title = '\u8bbe\u7f6e';
      settings.innerHTML = settingsIcon();
      settings.addEventListener('click', toggleWebSettings);
      topRight.insertBefore(settings, userButton);
    }
    ensureSettingsCloseButton();
    var panel = document.getElementById('fx-panel');
    if (panel && !panel._webSettingsObserver) {
      panel.classList.add('web-settings-drawer');
      panel._webSettingsObserver = new MutationObserver(syncSettingsButton);
      panel._webSettingsObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function hideSearch() {
    var area = document.getElementById('search-area');
    var input = document.getElementById('search-input');
    if (!area || searchHovering || document.activeElement === input) return;
    area.classList.add('web-ui-auto-hidden');
  }

  function revealSearch(delay) {
    var area = document.getElementById('search-area');
    if (!area) return;
    area.classList.remove('web-ui-auto-hidden');
    if (searchHideTimer) window.clearTimeout(searchHideTimer);
    searchHideTimer = window.setTimeout(hideSearch, delay == null ? SEARCH_IDLE_MS : delay);
  }

  function hidePlayer() {
    var bar = document.getElementById('bottom-bar');
    var queue = document.getElementById('mini-queue-popover');
    var volume = document.getElementById('volume-control');
    var quality = document.getElementById('quality-control');
    var popoverOpen = !!((queue && queue.classList.contains('show')) ||
      (volume && volume.classList.contains('open')) ||
      (quality && quality.classList.contains('open')));
    if (!bar || playerHovering || popoverOpen) return;
    bar.classList.add('web-ui-auto-hidden');
    document.body.classList.add('web-player-controls-hidden');
  }

  function revealPlayer(delay) {
    var bar = document.getElementById('bottom-bar');
    if (!bar) return;
    bar.classList.add('visible');
    bar.classList.remove('soft-hidden', 'web-ui-auto-hidden');
    document.body.classList.remove('web-player-controls-hidden');
    if (playerHideTimer) window.clearTimeout(playerHideTimer);
    playerHideTimer = window.setTimeout(hidePlayer, delay == null ? PLAYER_IDLE_MS : delay);
  }

  function ensureFloatingSearch() {
    var area = document.getElementById('search-area');
    var input = document.getElementById('search-input');
    if (area) area.classList.add('web-floating-search');
    if (input) input.placeholder = '\u641c\u7d22 QQ \u97f3\u4e50\u3001\u6b4c\u624b\u6216\u6b4c\u5355\u2026';
    if (area) {
      area.addEventListener('mouseenter', function () { searchHovering = true; revealSearch(); });
      area.addEventListener('mouseleave', function () { searchHovering = false; revealSearch(900); });
      area.addEventListener('focusin', function () { revealSearch(60000); });
      area.addEventListener('focusout', function () { revealSearch(1400); });
    }
    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') {
        event.preventDefault();
        revealSearch(60000);
        if (input) { input.focus(); input.select(); }
      }
      if (event.code === 'Escape' && document.activeElement === input) {
        input.blur();
        revealSearch(500);
      }
    }, true);
  }

  function initAutoHide() {
    var bar = document.getElementById('bottom-bar');
    var handle = document.getElementById('bottom-handle');
    if (bar) {
      bar.addEventListener('mouseenter', function () { playerHovering = true; revealPlayer(60000); });
      bar.addEventListener('mouseleave', function () { playerHovering = false; revealPlayer(1100); });
      bar.addEventListener('focusin', function () { revealPlayer(60000); });
      bar.addEventListener('focusout', function () { revealPlayer(1500); });
    }
    if (handle) handle.addEventListener('click', function () { revealPlayer(PLAYER_IDLE_MS); });
    window.addEventListener('pointermove', function (event) {
      updateLibraryDrawer(event);
      if (event.clientY < 96) revealSearch();
      if (event.clientY > window.innerHeight - 150) revealPlayer();
    }, { passive: true });
    window.addEventListener('touchstart', function () {
      revealSearch(1800);
      revealPlayer(2200);
    }, { passive: true });
    window.addEventListener('keydown', function () { revealPlayer(1800); }, { passive: true });
    revealSearch(SEARCH_IDLE_MS);
    revealPlayer(PLAYER_IDLE_MS);
  }

  function enterDirectly() {
    forcePlayerStage();
    document.body.classList.remove('splash-active', 'splash-revealing');
    window.splashAnimating = false;
    window.splashReadyToEnter = false;
    var splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('hide');
    splash.style.display = 'none';
  }

  forcePlayerStage();
  resetLegacyPanels();
  ensureTopTools();
  ensureFloatingSearch();
  initAutoHide();
  document.body.classList.remove('web-stage-boot');
  enterDirectly();
  window.setTimeout(enterDirectly, 120);
  window.setTimeout(function () {
    forcePlayerStage();
    ensureTopTools();
    if (typeof window.updateEmptyHomeVisibility === 'function') window.updateEmptyHomeVisibility({ forceLoad: false });
  }, 1400);
}());
