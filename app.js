(() => {
  // Generic open-source storage keys (v2) with automatic one-time migration from v1
  const KEYS = {
    sessions: "timetracker_sessions_v2",
    categories: "timetracker_categories_v2",
    goals: "timetracker_goals_v2",
    timer: "timetracker_timer_v2",
    theme: "timetracker_theme_v2",
    driveCfg: "timetracker_drive_cfg_v2",
    ui: "timetracker_ui_v2",
  };

  const LEGACY_KEYS = {};

  const DEFAULT_TITLE = "Time Tracker — Study, Work & Free Time";
  const DRIVE_FILE_NAME = "time-tracker-data.json";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

  const GROUPS = ["Studying", "Work", "Free Time"];
  const GROUP_COLORS = {
    Studying: "#6366f1",
    Work: "#f59e0b",
    "Free Time": "#10b981",
  };

  const ACCENT_COLORS = [
    "#8b5cf6",
    "#06b6d4",
    "#3b82f6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#6366f1",
    "#ef4444",
    "#14b8a6",
    "#f97316",
  ];

  const PRESETS = {
    student: [
      { id: "innovation", label: "Innovation", group: "Studying", color: "#8b5cf6" },
      { id: "statistik", label: "Statistik", group: "Studying", color: "#06b6d4" },
      { id: "analysis", label: "Analysis", group: "Studying", color: "#3b82f6" },
      { id: "ai_security", label: "AI & Security", group: "Studying", color: "#ec4899" },
      { id: "work", label: "Work", group: "Work", color: "#f59e0b" },
      { id: "free_time", label: "Free Time", group: "Free Time", color: "#10b981" },
    ],
    developer: [
      { id: "learning_docs", label: "Learning & Docs", group: "Studying", color: "#8b5cf6" },
      { id: "deep_coding", label: "Deep Coding", group: "Work", color: "#3b82f6" },
      { id: "meetings", label: "Meetings", group: "Work", color: "#f59e0b" },
      { id: "code_review", label: "Code Review", group: "Work", color: "#06b6d4" },
      { id: "free_time", label: "Free Time", group: "Free Time", color: "#10b981" },
    ],
    minimal: [
      { id: "studying", label: "Studying", group: "Studying", color: "#6366f1" },
      { id: "work", label: "Work", group: "Work", color: "#f59e0b" },
      { id: "free_time", label: "Free Time", group: "Free Time", color: "#10b981" },
    ],
  };

  const DEFAULT_GOALS = {
    Studying: 20,
    Work: 20,
    "Free Time": 10,
  };

  migrateLegacyStorage();

  // State
  let categories = loadCategories();
  let sessions = loadSessions();
  let weeklyGoals = loadGoals();
  let driveConfig = loadDriveConfig();
  let uiPrefs = loadUiPrefs();
  let timerState = loadTimerState();

  let currentView = "analytics";
  let currentRange = "week";
  let donutMode = "all"; // 'all' | 'group'
  let selectedSwatchColor = ACCENT_COLORS[0];
  let tickInterval = null;

  // Interactive chart hover & animation state
  let donutGeometry = { slices: [], cx: 110, cy: 110, innerR: 70, outerR: 98, total: 0 };
  let hoveredDonutIdx = -1;
  let donutAnimFrame = null;
  let barGeometry = { segments: [], columns: [], width: 760, height: 240 };
  let hoveredBarSegIdx = -1;
  let hoveredBarColIdx = -1;
  let barAnimFrame = null;
  const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Local server.py + Google Drive for Desktop state
  let localBackendAvailable = false;
  let localBackendStorage = { localPath: null, drivePath: null, driveSynced: false };
  let localBackendSaveTimer = null;

  // Optional direct browser Google Drive OAuth state
  let gisScriptPromise = null;
  let gisTokenClient = null;
  let gisClientIdBound = "";
  let driveAccessToken = null;
  let driveTokenExpiresAt = 0;
  let driveFileId = null;
  let driveConnected = false;
  let driveSyncing = false;
  let driveAutoSyncTimer = null;

  // DOM References
  const saveIndicator = document.getElementById("saveIndicator");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const dataSyncBtn = document.getElementById("dataSyncBtn");
  const driveStatusDot = document.getElementById("driveStatusDot");
  const driveStatusLabel = document.getElementById("driveStatusLabel");

  const welcomeBanner = document.getElementById("welcomeBanner");
  const welcomeCustomizeBtn = document.getElementById("welcomeCustomizeBtn");
  const dismissWelcomeBtn = document.getElementById("dismissWelcomeBtn");

  const timerNote = document.getElementById("timerNote");
  const activeCategoryLabel = document.getElementById("activeCategoryLabel");
  const timerStatusBadge = document.getElementById("timerStatusBadge");
  const timerDisplay = document.getElementById("timerDisplay");
  const startPauseBtn = document.getElementById("startPauseBtn");
  const saveSessionBtn = document.getElementById("saveSessionBtn");
  const resetTimerBtn = document.getElementById("resetTimerBtn");
  const categoryPillsWrap = document.getElementById("categoryPillsWrap");

  const viewTabs = document.querySelectorAll(".view-tab");
  const viewAnalytics = document.getElementById("viewAnalytics");
  const viewLog = document.getElementById("viewLog");
  const viewGoals = document.getElementById("viewGoals");

  const rangeTabs = document.querySelectorAll(".range-tab");
  const donutModeAll = document.getElementById("donutModeAll");
  const donutModeGroup = document.getElementById("donutModeGroup");
  const donutCanvas = document.getElementById("donutCanvas");
  const dailyBarCanvas = document.getElementById("dailyBarCanvas");
  const chartTooltip = document.getElementById("chartTooltip");

  const manualForm = document.getElementById("manualForm");
  const manualCat = document.getElementById("manualCat");
  const manualDate = document.getElementById("manualDate");
  const manualHours = document.getElementById("manualHours");
  const manualMinutes = document.getElementById("manualMinutes");
  const manualNote = document.getElementById("manualNote");
  const historyFilter = document.getElementById("historyFilter");

  const toggleEditGoalsBtn = document.getElementById("toggleEditGoalsBtn");
  const cancelEditGoalsBtn = document.getElementById("cancelEditGoalsBtn");
  const goalsForm = document.getElementById("goalsForm");
  const goalStudyInput = document.getElementById("goalStudyInput");
  const goalWorkInput = document.getElementById("goalWorkInput");
  const goalFreeInput = document.getElementById("goalFreeInput");

  // Manage Modules Modal
  const manageModulesModal = document.getElementById("manageModulesModal");
  const closeModulesModalBtn = document.getElementById("closeModulesModalBtn");
  const addModuleForm = document.getElementById("addModuleForm");
  const newModuleGroup = document.getElementById("newModuleGroup");
  const newModuleName = document.getElementById("newModuleName");
  const moduleColorSwatches = document.getElementById("moduleColorSwatches");
  const modulesManagerList = document.getElementById("modulesManagerList");

  // Edit Session Modal
  const editSessionModal = document.getElementById("editSessionModal");
  const editSessionForm = document.getElementById("editSessionForm");
  const editSessionId = document.getElementById("editSessionId");
  const editCat = document.getElementById("editCat");
  const editDate = document.getElementById("editDate");
  const editHours = document.getElementById("editHours");
  const editMinutes = document.getElementById("editMinutes");
  const editNote = document.getElementById("editNote");
  const closeEditModalBtn = document.getElementById("closeEditModalBtn");
  const cancelEditModalBtn = document.getElementById("cancelEditModalBtn");

  // Data & Sync Modal
  const dataSyncModal = document.getElementById("dataSyncModal");
  const closeDataSyncModalBtn = document.getElementById("closeDataSyncModalBtn");
  const driveOriginWarning = document.getElementById("driveOriginWarning");
  const driveModalStatusText = document.getElementById("driveModalStatusText");
  const driveLastSyncText = document.getElementById("driveLastSyncText");
  const exportJsonBtn = document.getElementById("exportJsonBtn");
  const importJsonInput = document.getElementById("importJsonInput");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const driveClientIdInput = document.getElementById("driveClientIdInput");
  const saveDriveClientIdBtn = document.getElementById("saveDriveClientIdBtn");
  const driveAutoSyncToggle = document.getElementById("driveAutoSyncToggle");
  const driveConnectBtn = document.getElementById("driveConnectBtn");
  const driveSyncNowBtn = document.getElementById("driveSyncNowBtn");
  const driveDisconnectBtn = document.getElementById("driveDisconnectBtn");

  const toastEl = document.getElementById("toast");

  // Init
  manualDate.value = toLocalDateKey(new Date());
  initTheme();
  initWelcomeBanner();
  initColorSwatches();
  initDriveUI();
  ensureValidSelectedCategory();
  timerNote.value = timerState.note || "";
  renderCategoryControls();
  updateTimerUI();
  if (timerState.running) {
    startTicker();
  }
  applyUrlParams();
  renderAll({ animateCharts: true });
  initLocalBackendSync();

  function applyUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("theme");
      if (t === "light" && !document.body.classList.contains("light")) {
        document.body.classList.add("light");
        themeToggleBtn.textContent = "🌙 Dark";
      } else if (t === "dark" && document.body.classList.contains("light")) {
        document.body.classList.remove("light");
        themeToggleBtn.textContent = "☀ Light";
      }
      if (params.get("welcome") === "0" && welcomeBanner) {
        welcomeBanner.classList.add("hidden");
      }
      const tab = params.get("tab");
      if (tab === "log" || tab === "goals" || tab === "analytics") {
        viewTabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
        viewAnalytics.classList.toggle("hidden", tab !== "analytics");
        viewLog.classList.toggle("hidden", tab !== "log");
        viewGoals.classList.toggle("hidden", tab !== "goals");
      }
    } catch {
      // ignore
    }
  }

  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("tab-hidden", document.hidden);
  });

  // --- Legacy Storage Migration ---
  function migrateLegacyStorage() {
    Object.entries(LEGACY_KEYS).forEach(([name, oldKey]) => {
      const newKey = KEYS[name];
      if (!localStorage.getItem(newKey)) {
        const oldVal = localStorage.getItem(oldKey);
        if (oldVal !== null) {
          localStorage.setItem(newKey, oldVal);
        }
      }
    });
  }

  // --- Category Helpers ---
  function sanitizeCategories(list) {
    if (!Array.isArray(list)) return null;
    const seen = new Set();
    const cleaned = [];
    list.forEach((c) => {
      if (!c || typeof c !== "object") return;
      const id = String(c.id || "").trim();
      const label = String(c.label || "").trim();
      const group = GROUPS.includes(c.group) ? c.group : "Studying";
      const color = typeof c.color === "string" && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : ACCENT_COLORS[0];
      if (!id || !label || seen.has(id)) return;
      seen.add(id);
      cleaned.push({ id, label: label.slice(0, 40), group, color });
    });
    return cleaned.length > 0 ? cleaned : null;
  }

  function loadCategories() {
    try {
      const raw = localStorage.getItem(KEYS.categories);
      if (raw) {
        const parsed = sanitizeCategories(JSON.parse(raw));
        if (parsed) return parsed;
      }
    } catch {
      // ignore
    }
    return PRESETS.student.map((c) => ({ ...c }));
  }

  function persistCategories(skipRemoteSync = false) {
    localStorage.setItem(KEYS.categories, JSON.stringify(categories));
    if (!skipRemoteSync) {
      driveConfig.categoriesUpdatedAt = Date.now();
      persistDriveConfig();
      scheduleLocalBackendSave();
      scheduleDriveAutoSync();
    }
    flashSaved();
  }

  function findCategory(catId) {
    return categories.find((c) => c.id === catId) || null;
  }

  function getCategoryMeta(catId, session = null) {
    const found = findCategory(catId);
    if (found) return found;
    return {
      id: catId || "archived",
      label: session?.categoryLabel || "Archived",
      group: GROUPS.includes(session?.categoryGroup) ? session.categoryGroup : "Studying",
      color: session?.categoryColor || "#64748b",
      archived: true,
    };
  }

  function ensureValidSelectedCategory() {
    if (!findCategory(timerState.category) && categories.length > 0) {
      timerState.category = categories[0].id;
      persistTimerState();
    }
  }

  function slugifyCategoryId(name) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "module";
    if (!findCategory(base)) return base;
    let i = 2;
    while (findCategory(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  }

  // --- Persistence ---
  function loadSessions() {
    try {
      const raw = localStorage.getItem(KEYS.sessions);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistSessions(skipRemoteSync = false) {
    localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
    flashSaved();
    if (!skipRemoteSync) {
      scheduleLocalBackendSave();
      scheduleDriveAutoSync();
    }
  }

  function loadTimerState() {
    try {
      const raw = localStorage.getItem(KEYS.timer);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            category: parsed.category || categories[0]?.id || "innovation",
            running: Boolean(parsed.running),
            startedAt: parsed.startedAt || null,
            accumulatedMs: Number(parsed.accumulatedMs) || 0,
            note: typeof parsed.note === "string" ? parsed.note : "",
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      category: categories[0]?.id || "innovation",
      running: false,
      startedAt: null,
      accumulatedMs: 0,
      note: "",
    };
  }

  function persistTimerState() {
    localStorage.setItem(KEYS.timer, JSON.stringify(timerState));
  }

  function loadGoals() {
    try {
      const raw = localStorage.getItem(KEYS.goals);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            Studying: sanitizeGoalHours(parsed.Studying, DEFAULT_GOALS.Studying),
            Work: sanitizeGoalHours(parsed.Work, DEFAULT_GOALS.Work),
            "Free Time": sanitizeGoalHours(parsed["Free Time"], DEFAULT_GOALS["Free Time"]),
          };
        }
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_GOALS };
  }

  function sanitizeGoalHours(val, fallback) {
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0 || num > 168) return fallback;
    return Math.round(num * 2) / 2;
  }

  function persistGoals(skipRemoteSync = false) {
    localStorage.setItem(KEYS.goals, JSON.stringify(weeklyGoals));
    if (!skipRemoteSync) {
      driveConfig.goalsUpdatedAt = Date.now();
      persistDriveConfig();
      scheduleLocalBackendSave();
      scheduleDriveAutoSync();
    }
    flashSaved();
  }

  function loadDriveConfig() {
    try {
      const raw = localStorage.getItem(KEYS.driveCfg);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            clientId: typeof parsed.clientId === "string" ? parsed.clientId.trim() : "",
            autoSync: parsed.autoSync !== false,
            lastSyncedAt: typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : null,
            goalsUpdatedAt: typeof parsed.goalsUpdatedAt === "number" ? parsed.goalsUpdatedAt : 0,
            categoriesUpdatedAt: typeof parsed.categoriesUpdatedAt === "number" ? parsed.categoriesUpdatedAt : 0,
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      clientId: "",
      autoSync: true,
      lastSyncedAt: null,
      goalsUpdatedAt: 0,
      categoriesUpdatedAt: 0,
    };
  }

  function persistDriveConfig() {
    localStorage.setItem(KEYS.driveCfg, JSON.stringify(driveConfig));
  }

  function loadUiPrefs() {
    try {
      const raw = localStorage.getItem(KEYS.ui);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // ignore
    }
    return { welcomeDismissed: false };
  }

  function persistUiPrefs() {
    localStorage.setItem(KEYS.ui, JSON.stringify(uiPrefs));
  }

  function flashSaved(customText) {
    if (!saveIndicator) return;
    if (customText) {
      saveIndicator.textContent = customText;
      return;
    }
    saveIndicator.textContent = `Saved locally · ${formatHHMM()}`;
  }

  function formatHHMM(date = new Date()) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  // --- Welcome Banner ---
  function initWelcomeBanner() {
    if (!uiPrefs.welcomeDismissed && sessions.length === 0) {
      welcomeBanner.classList.remove("hidden");
    }
  }

  welcomeCustomizeBtn.addEventListener("click", () => {
    uiPrefs.welcomeDismissed = true;
    persistUiPrefs();
    welcomeBanner.classList.add("hidden");
    openModulesModal();
  });

  dismissWelcomeBtn.addEventListener("click", () => {
    uiPrefs.welcomeDismissed = true;
    persistUiPrefs();
    welcomeBanner.classList.add("hidden");
  });

  // --- Theme ---
  function initTheme() {
    const saved = localStorage.getItem(KEYS.theme);
    if (saved === "light") {
      document.body.classList.add("light");
      themeToggleBtn.textContent = "🌙 Dark";
    }
  }

  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem(KEYS.theme, isLight ? "light" : "dark");
    themeToggleBtn.textContent = isLight ? "🌙 Dark" : "☀ Light";
    renderAll();
  });

  // --- Navigation Tabs (Analytics / Log / Goals) ---
  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      if (view === currentView) return;
      currentView = view;
      viewTabs.forEach((t) => {
        const active = t.dataset.view === view;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      viewAnalytics.classList.toggle("hidden", view !== "analytics");
      viewLog.classList.toggle("hidden", view !== "log");
      viewGoals.classList.toggle("hidden", view !== "goals");

      const activePanel = view === "analytics" ? viewAnalytics : view === "log" ? viewLog : viewGoals;
      activePanel.classList.remove("panel-enter");
      void activePanel.offsetWidth;
      activePanel.classList.add("panel-enter");

      hideChartTooltip();
      if (view === "analytics") {
        renderAnalytics({ animateCharts: true });
      } else if (view === "log") {
        renderHistory();
      } else if (view === "goals") {
        renderGoals();
      }
    });
  });

  // --- Dynamic Category Controls (Pills + Dropdowns) ---
  function renderCategoryControls() {
    ensureValidSelectedCategory();
    renderCategoryPills();
    populateCategorySelect(manualCat, manualCat.value || timerState.category);
    populateHistoryFilter();
    syncActiveCategoryLabel();
  }

  function renderCategoryPills() {
    const parts = [];
    GROUPS.forEach((group, groupIdx) => {
      const groupCats = categories.filter((c) => c.group === group);
      if (!groupCats.length) return;
      if (parts.length > 0) {
        parts.push('<span class="pill-divider" aria-hidden="true"></span>');
      }
      groupCats.forEach((cat) => {
        const active = cat.id === timerState.category ? " active" : "";
        parts.push(`
          <button class="cat-pill${active}" data-cat="${escapeHtml(cat.id)}" type="button" title="${escapeHtml(cat.group)}">
            <span class="dot" style="background:${cat.color}"></span>
            <span>${escapeHtml(cat.label)}</span>
          </button>
        `);
      });
    });

    parts.push('<span class="pill-divider" aria-hidden="true"></span>');
    parts.push('<button id="openManageModulesBtn" class="cat-pill cat-pill-customize" type="button">+ Customize</button>');

    categoryPillsWrap.innerHTML = parts.join("");

    categoryPillsWrap.querySelectorAll(".cat-pill[data-cat]").forEach((pill) => {
      pill.addEventListener("click", () => {
        timerState.category = pill.dataset.cat;
        persistTimerState();
        categoryPillsWrap.querySelectorAll(".cat-pill[data-cat]").forEach((p) => {
          p.classList.toggle("active", p.dataset.cat === timerState.category);
        });
        syncActiveCategoryLabel();
        updateTimerUI();
      });
    });

    const customizeBtn = document.getElementById("openManageModulesBtn");
    if (customizeBtn) {
      customizeBtn.addEventListener("click", openModulesModal);
    }
  }

  function syncActiveCategoryLabel() {
    const meta = getCategoryMeta(timerState.category);
    activeCategoryLabel.innerHTML = `<span class="dot" style="background:${meta.color}"></span> ${escapeHtml(meta.label)} · ${escapeHtml(meta.group)}`;
    document.documentElement.style.setProperty("--active-accent", meta.color);
  }

  function populateCategorySelect(selectEl, selectedValue, archivedSession = null) {
    const groupsHtml = GROUPS.map((group) => {
      const groupCats = categories.filter((c) => c.group === group);
      if (!groupCats.length) return "";
      const options = groupCats
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`)
        .join("");
      return `<optgroup label="${escapeHtml(group)}">${options}</optgroup>`;
    }).join("");

    let archivedHtml = "";
    if (archivedSession && !findCategory(archivedSession.category)) {
      const meta = getCategoryMeta(archivedSession.category, archivedSession);
      archivedHtml = `<optgroup label="Archived"><option value="${escapeHtml(archivedSession.category)}">${escapeHtml(meta.label)} (Archived)</option></optgroup>`;
    }

    selectEl.innerHTML = groupsHtml + archivedHtml;

    if (selectedValue && Array.from(selectEl.options).some((o) => o.value === selectedValue)) {
      selectEl.value = selectedValue;
    } else if (categories[0]) {
      selectEl.value = categories[0].id;
    }
  }

  function populateHistoryFilter() {
    const prev = historyFilter.value || "all";
    const opts = [
      '<option value="all">All Modules &amp; Categories</option>',
      '<option value="group:Studying">All Studying</option>',
      '<option value="group:Work">All Work</option>',
      '<option value="group:Free Time">All Free Time</option>',
    ];
    categories.forEach((c) => {
      opts.push(`<option value="cat:${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`);
    });
    historyFilter.innerHTML = opts.join("");
    if (Array.from(historyFilter.options).some((o) => o.value === prev)) {
      historyFilter.value = prev;
    } else {
      historyFilter.value = "all";
    }
  }

  // --- Manage Modules Modal ---
  function initColorSwatches() {
    moduleColorSwatches.innerHTML = ACCENT_COLORS.map(
      (color, idx) => `
        <button
          type="button"
          class="color-swatch${idx === 0 ? " selected" : ""}"
          data-color="${color}"
          style="background:${color}"
          aria-label="Select color ${color}"
        ></button>
      `
    ).join("");

    moduleColorSwatches.querySelectorAll(".color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSwatchColor = btn.dataset.color;
        moduleColorSwatches.querySelectorAll(".color-swatch").forEach((b) => {
          b.classList.toggle("selected", b === btn);
        });
      });
    });
  }

  function openModulesModal() {
    renderModulesManagerList();
    manageModulesModal.classList.remove("hidden");
    newModuleName.focus();
  }

  function closeModulesModal() {
    manageModulesModal.classList.add("hidden");
  }

  function renderModulesManagerList() {
    modulesManagerList.innerHTML = GROUPS.map((group) => {
      const groupCats = categories.filter((c) => c.group === group);
      const rows = groupCats.length
        ? groupCats
            .map(
              (c) => `
              <div class="module-item-row" data-id="${escapeHtml(c.id)}">
                <span class="dot" style="background:${c.color}"></span>
                <input
                  type="text"
                  class="module-name-input"
                  value="${escapeHtml(c.label)}"
                  maxlength="40"
                  data-rename-id="${escapeHtml(c.id)}"
                  aria-label="Rename ${escapeHtml(c.label)}"
                />
                <button type="button" class="delete-btn" data-remove-id="${escapeHtml(c.id)}" title="Delete module">Delete</button>
              </div>
            `
            )
            .join("")
        : '<div class="muted">No items in this group yet.</div>';

      return `
        <div class="module-group-block">
          <div class="module-group-title">${escapeHtml(group)}</div>
          ${rows}
        </div>
      `;
    }).join("");

    modulesManagerList.querySelectorAll("[data-rename-id]").forEach((input) => {
      const commitRename = () => {
        const id = input.dataset.renameId;
        const target = findCategory(id);
        const nextName = input.value.trim();
        if (!target) return;
        if (!nextName) {
          input.value = target.label;
          return;
        }
        if (nextName !== target.label) {
          target.label = nextName;
          persistCategories();
          renderCategoryControls();
          renderAll();
          updateTimerUI();
          showToast(`Renamed to "${nextName}".`);
        }
      };
      input.addEventListener("blur", commitRename);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        }
      });
    });

    modulesManagerList.querySelectorAll("[data-remove-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (categories.length <= 1) {
          showToast("Keep at least one module/category.");
          return;
        }
        const id = btn.dataset.removeId;
        const target = findCategory(id);
        if (!target) return;

        // Snapshot deleted metadata onto existing sessions so history stays intact
        let snapshotUpdated = false;
        sessions.forEach((s) => {
          if (s.category === id) {
            s.categoryLabel = target.label;
            s.categoryGroup = target.group;
            s.categoryColor = target.color;
            snapshotUpdated = true;
          }
        });
        if (snapshotUpdated) persistSessions(true);

        categories = categories.filter((c) => c.id !== id);
        ensureValidSelectedCategory();
        persistCategories();
        renderModulesManagerList();
        renderCategoryControls();
        renderAll();
        updateTimerUI();
        showToast(`Removed "${target.label}".`);
      });
    });
  }

  closeModulesModalBtn.addEventListener("click", closeModulesModal);
  manageModulesModal.addEventListener("click", (e) => {
    if (e.target === manageModulesModal) closeModulesModal();
  });

  addModuleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = newModuleName.value.trim();
    const group = GROUPS.includes(newModuleGroup.value) ? newModuleGroup.value : "Studying";
    if (!label) return;

    const newCat = {
      id: slugifyCategoryId(label),
      label,
      group,
      color: selectedSwatchColor,
    };

    categories.push(newCat);
    persistCategories();
    newModuleName.value = "";
    renderModulesManagerList();
    renderCategoryControls();
    renderAll();
    showToast(`Added "${label}" to ${group}.`);
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetKey = btn.dataset.preset;
      const preset = PRESETS[presetKey];
      if (!preset) return;

      // Snapshot current labels onto existing sessions before replacing list
      let snapshotUpdated = false;
      sessions.forEach((s) => {
        const cur = findCategory(s.category);
        if (cur) {
          s.categoryLabel = cur.label;
          s.categoryGroup = cur.group;
          s.categoryColor = cur.color;
          snapshotUpdated = true;
        }
      });
      if (snapshotUpdated) persistSessions(true);

      categories = preset.map((c) => ({ ...c }));
      ensureValidSelectedCategory();
      persistCategories();
      renderModulesManagerList();
      renderCategoryControls();
      renderAll();
      updateTimerUI();
      showToast(`Applied "${btn.textContent.trim()}" preset.`);
    });
  });

  // --- Timer Logic ---
  function getElapsedMs() {
    if (!timerState.running || !timerState.startedAt) {
      return timerState.accumulatedMs;
    }
    return timerState.accumulatedMs + (Date.now() - timerState.startedAt);
  }

  function startTicker() {
    stopTicker();
    tickInterval = setInterval(updateTimerUI, 250);
  }

  function stopTicker() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function updateTimerUI() {
    const elapsedMs = getElapsedMs();
    const formatted = formatHMS(elapsedMs);
    timerDisplay.textContent = formatted;

    const hasTime = elapsedMs >= 1000;
    saveSessionBtn.disabled = !hasTime;
    resetTimerBtn.disabled = !hasTime && !timerState.running;

    const activeCat = getCategoryMeta(timerState.category).label;
    document.body.classList.toggle("timer-running", timerState.running);

    if (timerState.running) {
      startPauseBtn.textContent = "Pause";
      timerStatusBadge.textContent = "Running";
      timerStatusBadge.className = "badge badge-running";
      document.title = `${formatted} · ${activeCat} — Time Tracker`;
    } else if (timerState.accumulatedMs > 0) {
      startPauseBtn.textContent = "Resume";
      timerStatusBadge.textContent = "Paused";
      timerStatusBadge.className = "badge badge-paused";
      document.title = `Paused · ${formatted} · ${activeCat} — Time Tracker`;
    } else {
      startPauseBtn.textContent = "Start";
      timerStatusBadge.textContent = "Idle";
      timerStatusBadge.className = "badge badge-idle";
      document.title = DEFAULT_TITLE;
    }
  }

  function toggleStartPause() {
    if (timerState.running) {
      timerState.accumulatedMs = getElapsedMs();
      timerState.running = false;
      timerState.startedAt = null;
      stopTicker();
    } else {
      timerState.running = true;
      timerState.startedAt = Date.now();
      startTicker();
    }
    persistTimerState();
    updateTimerUI();
  }

  timerNote.addEventListener("input", () => {
    timerState.note = timerNote.value;
    persistTimerState();
  });

  startPauseBtn.addEventListener("click", toggleStartPause);

  saveSessionBtn.addEventListener("click", () => {
    const durationSec = Math.round(getElapsedMs() / 1000);
    if (durationSec < 1) return;

    const meta = getCategoryMeta(timerState.category);
    const now = Date.now();
    const newSession = {
      id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
      category: meta.id,
      categoryLabel: meta.label,
      categoryGroup: meta.group,
      categoryColor: meta.color,
      date: toLocalDateKey(new Date()),
      durationSec,
      note: (timerNote.value || "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    sessions.unshift(newSession);
    persistSessions();

    timerState.running = false;
    timerState.startedAt = null;
    timerState.accumulatedMs = 0;
    timerState.note = "";
    timerNote.value = "";
    stopTicker();
    persistTimerState();
    updateTimerUI();
    renderAll({ animateCharts: true });
    triggerSaveCelebration(saveSessionBtn, meta.color);

    showToast(`Saved ${formatShort(durationSec)} to ${meta.label}`);
  });

  resetTimerBtn.addEventListener("click", () => {
    timerState.running = false;
    timerState.startedAt = null;
    timerState.accumulatedMs = 0;
    stopTicker();
    persistTimerState();
    updateTimerUI();
  });

  // Global Keyboard Shortcuts (Spacebar start/pause + Escape close modals)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!manageModulesModal.classList.contains("hidden")) closeModulesModal();
      if (!editSessionModal.classList.contains("hidden")) closeEditModal();
      if (!dataSyncModal.classList.contains("hidden")) closeDataSyncModal();
      return;
    }

    if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable;
      const modalOpen =
        !manageModulesModal.classList.contains("hidden") ||
        !editSessionModal.classList.contains("hidden") ||
        !dataSyncModal.classList.contains("hidden");
      if (!isTyping && !modalOpen) {
        e.preventDefault();
        toggleStartPause();
      }
    }
  });

  // --- Manual Entry ---
  manualForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const h = Math.max(0, parseInt(manualHours.value || "0", 10));
    const m = Math.max(0, parseInt(manualMinutes.value || "0", 10));
    const durationSec = h * 3600 + m * 60;

    if (durationSec <= 0) {
      showToast("Please enter at least 1 minute.");
      return;
    }

    const meta = getCategoryMeta(manualCat.value);
    const now = Date.now();
    const session = {
      id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
      category: meta.id,
      categoryLabel: meta.label,
      categoryGroup: meta.group,
      categoryColor: meta.color,
      date: manualDate.value || toLocalDateKey(new Date()),
      durationSec,
      note: manualNote.value.trim(),
      createdAt: now,
      updatedAt: now,
    };

    sessions.unshift(session);
    sessions.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    persistSessions();
    manualNote.value = "";
    renderAll();
    showToast(`Added ${formatShort(durationSec)} to ${meta.label}`);
  });

  // --- Filters & Controls ---
  rangeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      rangeTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentRange = tab.dataset.range;
      renderAnalytics({ animateCharts: true });
    });
  });

  donutModeAll.addEventListener("click", () => {
    donutMode = "all";
    hoveredDonutIdx = -1;
    hideChartTooltip();
    donutModeAll.classList.add("active");
    donutModeGroup.classList.remove("active");
    renderDonut(getFilteredSessions(), { animate: true });
  });

  donutModeGroup.addEventListener("click", () => {
    donutMode = "group";
    hoveredDonutIdx = -1;
    hideChartTooltip();
    donutModeGroup.classList.add("active");
    donutModeAll.classList.remove("active");
    renderDonut(getFilteredSessions(), { animate: true });
  });

  historyFilter.addEventListener("change", renderHistory);

  // --- Weekly Goals ---
  toggleEditGoalsBtn.addEventListener("click", () => {
    const isOpening = goalsForm.classList.contains("hidden");
    if (isOpening) {
      goalStudyInput.value = weeklyGoals.Studying;
      goalWorkInput.value = weeklyGoals.Work;
      goalFreeInput.value = weeklyGoals["Free Time"];
      goalsForm.classList.remove("hidden");
      toggleEditGoalsBtn.textContent = "Close";
    } else {
      goalsForm.classList.add("hidden");
      toggleEditGoalsBtn.textContent = "Edit Goals";
    }
  });

  cancelEditGoalsBtn.addEventListener("click", () => {
    goalsForm.classList.add("hidden");
    toggleEditGoalsBtn.textContent = "Edit Goals";
  });

  goalsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    weeklyGoals = {
      Studying: sanitizeGoalHours(goalStudyInput.value, DEFAULT_GOALS.Studying),
      Work: sanitizeGoalHours(goalWorkInput.value, DEFAULT_GOALS.Work),
      "Free Time": sanitizeGoalHours(goalFreeInput.value, DEFAULT_GOALS["Free Time"]),
    };
    persistGoals();
    goalsForm.classList.add("hidden");
    toggleEditGoalsBtn.textContent = "Edit Goals";
    renderGoals();
    showToast("Weekly goals updated.");
  });

  // --- Edit Session Modal ---
  function openEditModal(sessionId) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const totalMin = Math.max(1, Math.round(session.durationSec / 60));
    editSessionId.value = session.id;
    populateCategorySelect(editCat, session.category, session);
    editDate.value = session.date;
    editHours.value = Math.floor(totalMin / 60);
    editMinutes.value = totalMin % 60;
    editNote.value = session.note || "";

    editSessionModal.classList.remove("hidden");
    editCat.focus();
  }

  function closeEditModal() {
    editSessionModal.classList.add("hidden");
  }

  closeEditModalBtn.addEventListener("click", closeEditModal);
  cancelEditModalBtn.addEventListener("click", closeEditModal);
  editSessionModal.addEventListener("click", (e) => {
    if (e.target === editSessionModal) closeEditModal();
  });

  editSessionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const target = sessions.find((s) => s.id === editSessionId.value);
    if (!target) {
      closeEditModal();
      return;
    }

    const h = Math.max(0, parseInt(editHours.value || "0", 10));
    const m = Math.max(0, parseInt(editMinutes.value || "0", 10));
    const durationSec = h * 3600 + m * 60;

    if (durationSec <= 0) {
      showToast("Please enter at least 1 minute.");
      return;
    }

    const meta = getCategoryMeta(editCat.value, target);
    target.category = meta.id;
    target.categoryLabel = meta.label;
    target.categoryGroup = meta.group;
    target.categoryColor = meta.color;
    target.date = editDate.value || target.date;
    target.durationSec = durationSec;
    target.note = editNote.value.trim();
    target.updatedAt = Date.now();

    sessions.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    persistSessions();
    closeEditModal();
    renderAll();
    showToast("Session updated.");
  });

  // --- Local server.py + Google Drive for Desktop Auto-Save ---
  function hasLocalItemsNewerThanRemote(remoteData) {
    const remoteList = Array.isArray(remoteData?.sessions) ? remoteData.sessions : [];
    const remoteMap = new Map();
    remoteList.forEach((s) => {
      if (s && s.id) remoteMap.set(s.id, s);
    });

    for (const local of sessions) {
      if (!local || !local.id) continue;
      const remote = remoteMap.get(local.id);
      if (!remote) return true;
      if ((local.updatedAt || local.createdAt || 0) > (remote.updatedAt || remote.createdAt || 0)) {
        return true;
      }
    }

    if ((Number(driveConfig.goalsUpdatedAt) || 0) > (Number(remoteData?.goalsUpdatedAt) || 0)) return true;
    if ((Number(driveConfig.categoriesUpdatedAt) || 0) > (Number(remoteData?.categoriesUpdatedAt) || 0)) return true;
    if (!remoteData?.categories) return true;
    return false;
  }

  async function initLocalBackendSync() {
    if (window.location.protocol === "file:") return;
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data !== "object") return;

      localBackendAvailable = true;
      if (data.storage && typeof data.storage === "object") {
        localBackendStorage = {
          localPath: data.storage.localPath || null,
          drivePath: data.storage.drivePath || null,
          driveSynced: Boolean(data.storage.driveSynced),
        };
      }

      const localHasNewer = hasLocalItemsNewerThanRemote(data);
      const mergedFromRemote = mergeRemoteData(data);
      if (mergedFromRemote) {
        renderCategoryControls();
        renderAll();
        updateTimerUI();
      }

      if (localHasNewer) {
        await saveToLocalBackend();
      } else {
        updateLocalBackendStatusUI(false);
      }
    } catch {
      localBackendAvailable = false;
    }
  }

  function scheduleLocalBackendSave() {
    if (!localBackendAvailable || window.location.protocol === "file:") return;
    clearTimeout(localBackendSaveTimer);
    localBackendSaveTimer = setTimeout(saveToLocalBackend, 400);
  }

  async function saveToLocalBackend() {
    if (!localBackendAvailable || window.location.protocol === "file:") return;
    try {
      const payload = {
        version: 2,
        sessions,
        categories,
        goals: weeklyGoals,
        goalsUpdatedAt: driveConfig.goalsUpdatedAt || 0,
        categoriesUpdatedAt: driveConfig.categoriesUpdatedAt || 0,
      };
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const result = await res.json();
      if (result?.storage && typeof result.storage === "object") {
        localBackendStorage = {
          localPath: result.storage.localPath || null,
          drivePath: result.storage.drivePath || null,
          driveSynced: Boolean(result.storage.driveSynced),
        };
      }
      updateLocalBackendStatusUI(true);
    } catch {
      // localStorage remains intact
    }
  }

  function updateLocalBackendStatusUI(justSaved) {
    if (!localBackendAvailable) return;
    const timeStr = formatHHMM();
    if (localBackendStorage.driveSynced) {
      flashSaved(justSaved ? `Saved to Google Drive · ${timeStr}` : "Synced to Google Drive");
      if (!driveConnected) {
        driveStatusDot.className = "drive-dot drive-dot-ok";
        driveStatusLabel.textContent = "Data & Sync";
      }
    } else {
      flashSaved(justSaved ? `Saved to data.json · ${timeStr}` : "Connected to data.json");
    }
    refreshDriveModalMeta();
  }

  // --- Data & Sync Modal + Optional Direct OAuth Google Drive Sync ---
  function initDriveUI() {
    driveClientIdInput.value = driveConfig.clientId || "";
    driveAutoSyncToggle.checked = driveConfig.autoSync !== false;
    if (window.location.protocol === "file:") {
      driveOriginWarning.classList.remove("hidden");
    }
    refreshDriveModalMeta();
  }

  function openDataSyncModal() {
    driveClientIdInput.value = driveConfig.clientId || "";
    driveAutoSyncToggle.checked = driveConfig.autoSync !== false;
    refreshDriveModalMeta();
    dataSyncModal.classList.remove("hidden");
  }

  function closeDataSyncModal() {
    dataSyncModal.classList.add("hidden");
  }

  function refreshDriveModalMeta() {
    if (driveConnected && hasValidDriveToken()) {
      driveModalStatusText.textContent = "Connected to Google Drive (OAuth)";
      driveConnectBtn.textContent = "Reconnect";
      driveSyncNowBtn.disabled = driveSyncing;
      driveDisconnectBtn.classList.remove("hidden");
    } else if (driveConnected) {
      driveModalStatusText.textContent = "OAuth session expired — click Reconnect";
      driveConnectBtn.textContent = "Reconnect with Google";
      driveSyncNowBtn.disabled = true;
      driveDisconnectBtn.classList.remove("hidden");
    } else if (localBackendAvailable && localBackendStorage.driveSynced) {
      driveModalStatusText.textContent = "Auto-saving to data.json + Google Drive for Desktop";
      driveConnectBtn.textContent = "Connect via OAuth";
      driveSyncNowBtn.disabled = true;
      driveDisconnectBtn.classList.add("hidden");
    } else if (localBackendAvailable) {
      driveModalStatusText.textContent = "Auto-saving to local data.json";
      driveConnectBtn.textContent = "Connect with Google";
      driveSyncNowBtn.disabled = true;
      driveDisconnectBtn.classList.add("hidden");
    } else {
      driveModalStatusText.textContent = "Local browser storage (offline mode)";
      driveConnectBtn.textContent = "Connect with Google";
      driveSyncNowBtn.disabled = true;
      driveDisconnectBtn.classList.add("hidden");
    }

    if (driveConfig.lastSyncedAt) {
      const d = new Date(driveConfig.lastSyncedAt);
      driveLastSyncText.textContent = d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      driveLastSyncText.textContent = localBackendStorage.driveSynced ? "Automatic (Desktop)" : "Never";
    }
  }

  function updateDriveStatusUI(state, label) {
    driveStatusDot.className = `drive-dot drive-dot-${state}`;
    if (label) driveStatusLabel.textContent = label;
    refreshDriveModalMeta();
  }

  function hasValidDriveToken() {
    return Boolean(driveAccessToken && Date.now() < driveTokenExpiresAt - 30000);
  }

  function loadGisScript() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (gisScriptPromise) return gisScriptPromise;

    gisScriptPromise = new Promise((resolve, reject) => {
      if (!navigator.onLine) {
        gisScriptPromise = null;
        reject(new Error("Offline — connect to the internet to use OAuth sync."));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;

      const timer = setTimeout(() => {
        gisScriptPromise = null;
        reject(new Error("Timed out loading Google Sign-In."));
      }, 10000);

      script.onload = () => {
        clearTimeout(timer);
        if (window.google?.accounts?.oauth2) resolve();
        else {
          gisScriptPromise = null;
          reject(new Error("Google Identity Services did not initialize."));
        }
      };

      script.onerror = () => {
        clearTimeout(timer);
        gisScriptPromise = null;
        reject(new Error("Could not load Google Sign-In. Local saving still works."));
      };

      document.head.appendChild(script);
    });
    return gisScriptPromise;
  }

  async function connectGoogleDrive() {
    if (window.location.protocol === "file:") {
      driveOriginWarning.classList.remove("hidden");
      showToast("Launch via Start Time Tracker.bat (http://localhost:8765) for Google Drive.");
      return;
    }

    const clientId = driveClientIdInput.value.trim();
    if (!clientId) {
      showToast("Please paste your Google OAuth Client ID first.");
      driveClientIdInput.focus();
      return;
    }

    if (clientId !== driveConfig.clientId) {
      driveConfig.clientId = clientId;
      persistDriveConfig();
    }

    updateDriveStatusUI("syncing", "Syncing...");
    driveConnectBtn.disabled = true;

    try {
      await loadGisScript();
      if (!gisTokenClient || gisClientIdBound !== clientId) {
        gisClientIdBound = clientId;
        gisTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: async (resp) => {
            driveConnectBtn.disabled = false;
            if (!resp || resp.error || !resp.access_token) {
              updateDriveStatusUI(driveConnected ? "warn" : "off", "Data & Sync");
              showToast(`Google Drive: ${resp?.error_description || resp?.error || "Cancelled."}`);
              return;
            }
            driveAccessToken = resp.access_token;
            driveTokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3500) * 1000;
            driveConnected = true;
            await syncWithDrive({ silent: false });
          },
          error_callback: () => {
            driveConnectBtn.disabled = false;
            updateDriveStatusUI(driveConnected ? "warn" : "off", "Data & Sync");
          },
        });
      }
      gisTokenClient.requestAccessToken({ prompt: driveConnected ? "" : "consent" });
    } catch (err) {
      driveConnectBtn.disabled = false;
      updateDriveStatusUI(driveConnected ? "warn" : "off", "Data & Sync");
      showToast(err.message || "Could not connect to Google Drive.");
    }
  }

  function disconnectGoogleDrive() {
    clearTimeout(driveAutoSyncTimer);
    if (driveAccessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(driveAccessToken, () => {});
      } catch {
        // ignore
      }
    }
    driveAccessToken = null;
    driveTokenExpiresAt = 0;
    driveFileId = null;
    driveConnected = false;
    driveSyncing = false;
    updateDriveStatusUI(localBackendStorage.driveSynced ? "ok" : "off", "Data & Sync");
    showToast("Disconnected from Google Drive OAuth.");
  }

  function scheduleDriveAutoSync() {
    if (!driveConnected || !driveConfig.autoSync) return;
    if (!hasValidDriveToken()) {
      updateDriveStatusUI("warn", "Reconnect");
      return;
    }
    clearTimeout(driveAutoSyncTimer);
    driveAutoSyncTimer = setTimeout(() => syncWithDrive({ silent: true }), 1500);
  }

  async function driveFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${driveAccessToken}`);
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      driveAccessToken = null;
      driveTokenExpiresAt = 0;
      const err = new Error("TOKEN_EXPIRED");
      err.code = "TOKEN_EXPIRED";
      throw err;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Drive API error (${res.status}): ${text.slice(0, 120)}`);
    }
    return res;
  }

  async function findDriveSyncFile() {
    const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive&orderBy=modifiedTime desc`;
    const res = await driveFetch(url);
    const data = await res.json();
    return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
  }

  async function downloadDriveSyncFile(fileId) {
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    return res.json();
  }

  async function uploadDriveSyncFile(payload) {
    const jsonBody = JSON.stringify(payload, null, 2);
    if (driveFileId) {
      await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(driveFileId)}?uploadType=media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: jsonBody,
      });
      return driveFileId;
    }
    const boundary = `timetracker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const metadata = JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: "application/json" });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${jsonBody}\r\n` +
      `--${boundary}--`;
    const res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const created = await res.json();
    driveFileId = created.id || null;
    return driveFileId;
  }

  function mergeRemoteData(remote) {
    if (!remote || typeof remote !== "object") return false;
    let changed = false;

    const remoteCats = sanitizeCategories(remote.categories);
    if (remoteCats) {
      const remoteCatsTs = Number(remote.categoriesUpdatedAt) || 0;
      const localCatsTs = Number(driveConfig.categoriesUpdatedAt) || 0;
      if (remoteCatsTs > localCatsTs || (localCatsTs === 0 && remoteCatsTs > 0)) {
        categories = remoteCats;
        driveConfig.categoriesUpdatedAt = remoteCatsTs;
        persistCategories(true);
        changed = true;
      }
    }

    const remoteSessions = Array.isArray(remote.sessions) ? remote.sessions : [];
    const byId = new Map();
    sessions.forEach((s) => {
      if (s && s.id) byId.set(s.id, s);
    });

    let sessionsChanged = false;
    remoteSessions.forEach((rs) => {
      if (!rs || !rs.id || !rs.category || typeof rs.durationSec !== "number" || !rs.date) return;
      const local = byId.get(rs.id);
      if (!local) {
        byId.set(rs.id, rs);
        sessionsChanged = true;
      } else if ((rs.updatedAt || rs.createdAt || 0) > (local.updatedAt || local.createdAt || 0)) {
        byId.set(rs.id, rs);
        sessionsChanged = true;
      }
    });

    if (sessionsChanged) {
      sessions = Array.from(byId.values()).sort(
        (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)
      );
      persistSessions(true);
      changed = true;
    }

    if (remote.goals && typeof remote.goals === "object") {
      const remoteGoalsTs = Number(remote.goalsUpdatedAt) || 0;
      const localGoalsTs = Number(driveConfig.goalsUpdatedAt) || 0;
      if (remoteGoalsTs > localGoalsTs || (localGoalsTs === 0 && remoteGoalsTs > 0)) {
        weeklyGoals = {
          Studying: sanitizeGoalHours(remote.goals.Studying, weeklyGoals.Studying),
          Work: sanitizeGoalHours(remote.goals.Work, weeklyGoals.Work),
          "Free Time": sanitizeGoalHours(remote.goals["Free Time"], weeklyGoals["Free Time"]),
        };
        driveConfig.goalsUpdatedAt = remoteGoalsTs;
        persistGoals(true);
        changed = true;
      }
    }

    return changed;
  }

  async function syncWithDrive({ silent = false } = {}) {
    if (driveSyncing) return;
    if (!hasValidDriveToken()) {
      updateDriveStatusUI("warn", "Reconnect");
      if (!silent) showToast("Google Drive session expired — click Reconnect.");
      return;
    }

    driveSyncing = true;
    updateDriveStatusUI("syncing", "Syncing...");

    try {
      const existing = await findDriveSyncFile();
      if (existing?.id) {
        driveFileId = existing.id;
        try {
          const remoteData = await downloadDriveSyncFile(driveFileId);
          if (mergeRemoteData(remoteData)) {
            renderCategoryControls();
            renderAll();
            updateTimerUI();
          }
        } catch (downloadErr) {
          if (downloadErr?.code === "TOKEN_EXPIRED") throw downloadErr;
        }
      } else {
        driveFileId = null;
      }

      await uploadDriveSyncFile({
        version: 2,
        updatedAt: new Date().toISOString(),
        goalsUpdatedAt: driveConfig.goalsUpdatedAt || Date.now(),
        categoriesUpdatedAt: driveConfig.categoriesUpdatedAt || Date.now(),
        categories,
        goals: weeklyGoals,
        sessions,
      });

      driveConfig.lastSyncedAt = Date.now();
      persistDriveConfig();
      driveSyncing = false;
      updateDriveStatusUI("ok", "Data & Sync");
      flashSaved(`Saved to Google Drive · ${formatHHMM()}`);
      if (!silent) showToast("Synced with Google Drive.");
    } catch (err) {
      driveSyncing = false;
      if (err?.code === "TOKEN_EXPIRED") {
        updateDriveStatusUI("warn", "Reconnect");
        if (!silent) showToast("Google Drive token expired — please reconnect.");
      } else {
        updateDriveStatusUI("warn", "Sync error");
        if (!silent) showToast(err.message || "Google Drive sync failed.");
      }
    }
  }

  dataSyncBtn.addEventListener("click", openDataSyncModal);
  closeDataSyncModalBtn.addEventListener("click", closeDataSyncModal);
  dataSyncModal.addEventListener("click", (e) => {
    if (e.target === dataSyncModal) closeDataSyncModal();
  });

  saveDriveClientIdBtn.addEventListener("click", () => {
    driveConfig.clientId = driveClientIdInput.value.trim();
    persistDriveConfig();
    showToast(driveConfig.clientId ? "Google Client ID saved." : "Google Client ID cleared.");
  });

  driveAutoSyncToggle.addEventListener("change", () => {
    driveConfig.autoSync = driveAutoSyncToggle.checked;
    persistDriveConfig();
  });

  driveConnectBtn.addEventListener("click", connectGoogleDrive);
  driveSyncNowBtn.addEventListener("click", () => syncWithDrive({ silent: false }));
  driveDisconnectBtn.addEventListener("click", disconnectGoogleDrive);

  // --- Backup / Export / Import / Clear ---
  exportJsonBtn.addEventListener("click", () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      categories,
      goals: weeklyGoals,
      sessions,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `time-tracker-backup-${toLocalDateKey(new Date())}.json`,
      "application/json"
    );
    showToast("Backup JSON exported.");
  });

  importJsonInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = Array.isArray(parsed) ? parsed : parsed.sessions;
        if (!Array.isArray(incoming)) throw new Error("Invalid format");

        if (!Array.isArray(parsed) && parsed.categories) {
          const validCats = sanitizeCategories(parsed.categories);
          if (validCats) {
            categories = validCats;
            persistCategories(true);
          }
        }

        const existingIds = new Set(sessions.map((s) => s.id));
        let added = 0;
        incoming.forEach((s) => {
          if (s && s.category && typeof s.durationSec === "number" && s.date && !existingIds.has(s.id)) {
            sessions.push(s);
            added++;
          }
        });

        if (!Array.isArray(parsed) && parsed.goals && typeof parsed.goals === "object") {
          weeklyGoals = {
            Studying: sanitizeGoalHours(parsed.goals.Studying, weeklyGoals.Studying),
            Work: sanitizeGoalHours(parsed.goals.Work, weeklyGoals.Work),
            "Free Time": sanitizeGoalHours(parsed.goals["Free Time"], weeklyGoals["Free Time"]),
          };
          persistGoals(true);
        }

        sessions.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
        persistSessions();
        renderCategoryControls();
        renderAll();
        updateTimerUI();
        showToast(`Imported ${added} new session(s).`);
      } catch {
        showToast("Could not import file — invalid JSON format.");
      } finally {
        importJsonInput.value = "";
      }
    };
    reader.readAsText(file);
  });

  exportCsvBtn.addEventListener("click", () => {
    const header = ["Date", "Module / Category", "Group", "Duration (Minutes)", "Note"];
    const rows = sessions.map((s) => {
      const meta = getCategoryMeta(s.category, s);
      const mins = (s.durationSec / 60).toFixed(1);
      const safeNote = `"${(s.note || "").replace(/"/g, '""')}"`;
      return [s.date, `"${meta.label.replace(/"/g, '""')}"`, meta.group, mins, safeNote].join(",");
    });
    downloadFile([header.join(","), ...rows].join("\n"), `time-tracker-${toLocalDateKey(new Date())}.csv`, "text/csv");
    showToast("CSV exported.");
  });

  clearAllBtn.addEventListener("click", () => {
    if (!sessions.length) return;
    if (!confirm("Delete all saved time tracking sessions? You can export a JSON backup first.")) return;
    sessions = [];
    persistSessions();
    renderAll();
    showToast("All sessions cleared.");
  });

  // --- Analytics & Rendering ---
  function getFilteredSessions() {
    if (currentRange === "all") return sessions;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    if (currentRange === "week") cutoff.setDate(today.getDate() - 6);
    else if (currentRange === "month") cutoff.setDate(today.getDate() - 29);

    const cutoffKey = toLocalDateKey(cutoff);
    return sessions.filter((s) => s.date >= cutoffKey);
  }

  function getLast7DaysSessions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 6);
    const cutoffKey = toLocalDateKey(cutoff);
    return sessions.filter((s) => s.date >= cutoffKey);
  }

  function renderAll({ animateCharts = false } = {}) {
    renderAnalytics({ animateCharts });
    renderGoals();
    renderHistory();
  }

  function renderAnalytics({ animateCharts = false } = {}) {
    const filtered = getFilteredSessions();
    hoveredDonutIdx = -1;
    hoveredBarSegIdx = -1;
    hoveredBarColIdx = -1;
    hideChartTooltip();
    renderKPIs(filtered);
    renderInsights(filtered);
    renderDonut(filtered, { animate: animateCharts });
    renderSubjectBars(filtered);
    renderDailyBarChart({ animate: animateCharts });
  }

  function renderKPIs(list) {
    let total = 0;
    let study = 0;
    let work = 0;
    let free = 0;

    list.forEach((s) => {
      total += s.durationSec;
      const g = getCategoryMeta(s.category, s).group;
      if (g === "Studying") study += s.durationSec;
      else if (g === "Work") work += s.durationSec;
      else if (g === "Free Time") free += s.durationSec;
    });

    document.getElementById("kpiTotal").textContent = formatShort(total);
    document.getElementById("kpiCount").textContent = `${list.length} session${list.length === 1 ? "" : "s"}`;

    document.getElementById("kpiStudy").textContent = formatShort(study);
    document.getElementById("kpiStudyPct").textContent = `${pct(study, total)}% of total`;

    document.getElementById("kpiWork").textContent = formatShort(work);
    document.getElementById("kpiWorkPct").textContent = `${pct(work, total)}% of total`;

    document.getElementById("kpiFree").textContent = formatShort(free);
    document.getElementById("kpiFreePct").textContent = `${pct(free, total)}% of total`;
  }

  function renderInsights(list) {
    // 1. Study Streak
    const studyDateSet = new Set(
      sessions
        .filter((s) => getCategoryMeta(s.category, s).group === "Studying" && s.durationSec > 0)
        .map((s) => s.date)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toLocalDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = toLocalDateKey(yesterday);

    let streak = 0;
    let cursor = null;
    const studiedToday = studyDateSet.has(todayKey);

    if (studiedToday) cursor = new Date(today);
    else if (studyDateSet.has(yesterdayKey)) cursor = new Date(yesterday);

    if (cursor) {
      while (studyDateSet.has(toLocalDateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    document.getElementById("insightStreak").textContent = `${streak} day${streak === 1 ? "" : "s"}`;
    document.getElementById("insightStreakSub").textContent =
      streak === 0
        ? "Start a study session today"
        : studiedToday
          ? "Studied today — keep it going!"
          : "Study today to keep streak alive";

    // 2. Top Study Module in selected range
    const studyMap = new Map();
    let studyTotalSec = 0;
    list.forEach((s) => {
      const meta = getCategoryMeta(s.category, s);
      if (meta.group !== "Studying") return;
      studyTotalSec += s.durationSec;
      const cur = studyMap.get(meta.id) || { label: meta.label, color: meta.color, sec: 0 };
      cur.sec += s.durationSec;
      studyMap.set(meta.id, cur);
    });

    const top = Array.from(studyMap.values()).sort((a, b) => b.sec - a.sec)[0];
    const topEl = document.getElementById("insightTopSubject");
    const topSubEl = document.getElementById("insightTopSubjectSub");

    if (top && top.sec > 0) {
      topEl.innerHTML = `<span class="dot" style="background:${top.color}"></span>${escapeHtml(top.label)}`;
      topSubEl.textContent = `${formatShort(top.sec)} (${pct(top.sec, studyTotalSec)}% of studying)`;
    } else {
      topEl.textContent = "—";
      topSubEl.textContent = "No study sessions in range";
    }

    // 3. Daily Average
    const totalSec = list.reduce((a, b) => a + b.durationSec, 0);
    let daySpan = 1;
    let rangeLabel = "today";

    if (currentRange === "week") {
      daySpan = 7;
      rangeLabel = "last 7 days";
    } else if (currentRange === "month") {
      daySpan = 30;
      rangeLabel = "last 30 days";
    } else if (currentRange === "all") {
      if (list.length > 0) {
        const earliest = list.reduce((min, s) => (s.date < min ? s.date : min), list[0].date);
        const startDate = new Date(`${earliest}T00:00:00`);
        daySpan = Math.max(1, Math.floor((today - startDate) / 86400000) + 1);
        rangeLabel = `${daySpan} day${daySpan === 1 ? "" : "s"} tracked`;
      } else {
        rangeLabel = "all time";
      }
    }

    document.getElementById("insightDailyAvg").textContent = formatShort(Math.round(totalSec / daySpan));
    document.getElementById("insightDailyAvgSub").textContent = `Across ${rangeLabel}`;
  }

  function renderGoals() {
    const container = document.getElementById("goalsProgressList");
    const last7 = getLast7DaysSessions();

    container.innerHTML = GROUPS.map((group) => {
      const actualSec = last7
        .filter((s) => getCategoryMeta(s.category, s).group === group)
        .reduce((a, b) => a + b.durationSec, 0);
      const goalHours = weeklyGoals[group] ?? DEFAULT_GOALS[group];
      const goalSec = goalHours * 3600;
      const percent = goalSec > 0 ? Math.round((actualSec / goalSec) * 100) : 0;
      const barWidth = goalSec > 0 ? Math.min(100, (actualSec / goalSec) * 100) : 0;
      const reached = goalSec > 0 && actualSec >= goalSec;
      const remainingSec = Math.max(0, goalSec - actualSec);
      const color = GROUP_COLORS[group];

      const statusText =
        goalSec === 0 ? "No target set" : reached ? "Goal reached ✓" : `${formatShort(remainingSec)} left`;

      return `
        <div class="goal-item${reached ? " goal-reached" : ""}">
          <div class="goal-head">
            <span class="goal-title">
              <span class="dot" style="background:${color}"></span>
              ${escapeHtml(group)}
            </span>
            <span class="goal-pct">${goalSec > 0 ? `${percent}%` : "—"}</span>
          </div>
          <div class="goal-track">
            <div class="goal-fill" style="width:${barWidth}%; background:${color}"></div>
          </div>
          <div class="goal-meta">
            <span>${formatShort(actualSec)} / ${goalHours}h</span>
            <span>${statusText}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderDonut(list, { animate = false } = {}) {
    if (donutAnimFrame) {
      cancelAnimationFrame(donutAnimFrame);
      donutAnimFrame = null;
    }

    const shouldAnimate = animate && !prefersReducedMotion();
    if (!shouldAnimate) {
      drawDonutFrame(list, 1);
      return;
    }

    const duration = 420;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      drawDonutFrame(list, eased);
      if (t < 1) {
        donutAnimFrame = requestAnimationFrame(step);
      } else {
        donutAnimFrame = null;
      }
    };
    donutAnimFrame = requestAnimationFrame(step);
  }

  function drawDonutFrame(list, progress) {
    const ctx = donutCanvas.getContext("2d");
    const legendEl = document.getElementById("donutLegend");

    const dpr = window.devicePixelRatio || 1;
    const size = 220;
    donutCanvas.width = size * dpr;
    donutCanvas.height = size * dpr;
    donutCanvas.style.width = `${size}px`;
    donutCanvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const slices = [];
    if (donutMode === "all") {
      const totalsMap = new Map();
      categories.forEach((c) => totalsMap.set(c.id, { label: c.label, color: c.color, value: 0 }));
      list.forEach((s) => {
        const meta = getCategoryMeta(s.category, s);
        const entry = totalsMap.get(meta.id) || { label: meta.label, color: meta.color, value: 0 };
        entry.value += s.durationSec;
        totalsMap.set(meta.id, entry);
      });
      totalsMap.forEach((entry) => slices.push(entry));
    } else {
      GROUPS.forEach((group) => {
        const val = list
          .filter((s) => getCategoryMeta(s.category, s).group === group)
          .reduce((a, b) => a + b.durationSec, 0);
        slices.push({ label: group, color: GROUP_COLORS[group], value: val });
      });
    }

    const total = slices.reduce((a, b) => a + b.value, 0);
    const cx = size / 2;
    const cy = size / 2;
    const radius = 84;
    const lineWidth = 28;

    const styles = getComputedStyle(document.body);
    const textColor = styles.getPropertyValue("--text").trim();
    const mutedColor = styles.getPropertyValue("--muted").trim();
    const trackColor = styles.getPropertyValue("--surface-2").trim();

    const geomSlices = [];

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else {
      let startAngle = -Math.PI / 2;
      const sweepTotal = Math.PI * 2 * progress;
      slices.forEach((slice, idx) => {
        if (slice.value <= 0) return;
        const fullAngle = (slice.value / total) * Math.PI * 2;
        const angle = (slice.value / total) * sweepTotal;
        const endAngle = startAngle + angle;
        const isHovered = hoveredDonutIdx === idx;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = slice.color;
        ctx.lineWidth = isHovered ? lineWidth + 6 : lineWidth;
        ctx.globalAlpha = hoveredDonutIdx >= 0 && !isHovered ? 0.55 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        geomSlices.push({
          idx,
          label: slice.label,
          color: slice.color,
          value: slice.value,
          percent: pct(slice.value, total),
          startAngle,
          endAngle: startAngle + fullAngle,
        });
        startAngle = endAngle;
      });
    }

    donutGeometry = {
      slices: geomSlices,
      cx,
      cy,
      innerR: radius - lineWidth / 2 - 4,
      outerR: radius + lineWidth / 2 + 6,
      total,
    };

    const activeSlice = geomSlices.find((s) => s.idx === hoveredDonutIdx);
    ctx.fillStyle = textColor;
    ctx.font = "700 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(activeSlice ? formatShort(activeSlice.value) : formatShort(total), cx, cy - 6);

    ctx.fillStyle = mutedColor;
    ctx.font = "500 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText(activeSlice ? `${activeSlice.percent}% · ${activeSlice.label}` : "Total Time", cx, cy + 14);

    if (progress >= 1 || !legendEl.childElementCount) {
      legendEl.innerHTML = slices
        .map(
          (s, idx) => `
          <div class="legend-item${hoveredDonutIdx === idx ? " is-hovered" : ""}">
            <span class="legend-left">
              <span class="dot" style="background:${s.color}"></span>
              <span>${escapeHtml(s.label)}</span>
            </span>
            <span class="legend-val">${formatShort(s.value)} (${pct(s.value, total)}%)</span>
          </div>
        `
        )
        .join("");
    }
  }

  donutCanvas.addEventListener("mousemove", (e) => {
    if (!donutGeometry.total || !donutGeometry.slices.length) {
      hideChartTooltip();
      return;
    }
    const rect = donutCanvas.getBoundingClientRect();
    const dx = e.clientX - rect.left - donutGeometry.cx;
    const dy = e.clientY - rect.top - donutGeometry.cy;
    const dist = Math.hypot(dx, dy);

    let found = null;
    if (dist >= donutGeometry.innerR && dist <= donutGeometry.outerR) {
      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;
      found = donutGeometry.slices.find((s) => angle >= s.startAngle && angle <= s.endAngle) || null;
    }

    const nextIdx = found ? found.idx : -1;
    if (nextIdx !== hoveredDonutIdx) {
      hoveredDonutIdx = nextIdx;
      renderDonut(getFilteredSessions());
    }

    if (found) {
      showChartTooltip(
        `
        <div class="tooltip-title">
          <span class="dot" style="background:${found.color}"></span>
          <span>${escapeHtml(found.label)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-row-label">Duration</span>
          <span class="tooltip-row-val">${formatShort(found.value)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-row-label">Share</span>
          <span class="tooltip-row-val">${found.percent}%</span>
        </div>
      `,
        e.clientX,
        e.clientY
      );
    } else {
      hideChartTooltip();
    }
  });

  donutCanvas.addEventListener("mouseleave", () => {
    if (hoveredDonutIdx !== -1) {
      hoveredDonutIdx = -1;
      renderDonut(getFilteredSessions());
    }
    hideChartTooltip();
  });

  function renderSubjectBars(list) {
    const container = document.getElementById("subjectBars");
    const totalsMap = new Map();

    categories
      .filter((c) => c.group === "Studying")
      .forEach((c) => totalsMap.set(c.id, { label: c.label, color: c.color, sec: 0 }));

    list.forEach((s) => {
      const meta = getCategoryMeta(s.category, s);
      if (meta.group !== "Studying") return;
      const cur = totalsMap.get(meta.id) || { label: meta.label, color: meta.color, sec: 0 };
      cur.sec += s.durationSec;
      totalsMap.set(meta.id, cur);
    });

    const totals = Array.from(totalsMap.values());
    const studyTotal = totals.reduce((a, b) => a + b.sec, 0);
    const maxSec = Math.max(...totals.map((t) => t.sec), 1);

    document.getElementById("studyTotalBadge").textContent = formatShort(studyTotal);

    if (!totals.length) {
      container.innerHTML = '<div class="empty-state">Add a Studying module via <strong>+ Customize</strong> to see breakdown bars.</div>';
      return;
    }

    container.innerHTML = totals
      .map((t) => {
        const widthPct = studyTotal === 0 ? 0 : Math.max((t.sec / maxSec) * 100, t.sec > 0 ? 4 : 0);
        return `
          <div class="subject-row">
            <div class="subject-head">
              <span><strong>${escapeHtml(t.label)}</strong></span>
              <span class="muted">${formatShort(t.sec)} (${pct(t.sec, studyTotal)}%)</span>
            </div>
            <div class="subject-track">
              <div class="subject-fill" style="width:${widthPct}%; background:${t.color}"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderDailyBarChart({ animate = false } = {}) {
    if (barAnimFrame) {
      cancelAnimationFrame(barAnimFrame);
      barAnimFrame = null;
    }

    const shouldAnimate = animate && !prefersReducedMotion();
    if (!shouldAnimate) {
      drawDailyBarFrame(1);
      return;
    }

    const duration = 440;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      drawDailyBarFrame(eased);
      if (t < 1) {
        barAnimFrame = requestAnimationFrame(step);
      } else {
        barAnimFrame = null;
      }
    };
    barAnimFrame = requestAnimationFrame(step);
  }

  function drawDailyBarFrame(progress) {
    const ctx = dailyBarCanvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const width = 760;
    const height = 240;
    dailyBarCanvas.width = width * dpr;
    dailyBarCanvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.body);
    const textColor = styles.getPropertyValue("--text").trim();
    const mutedColor = styles.getPropertyValue("--muted").trim();
    const borderColor = styles.getPropertyValue("--border").trim();

    // Build last 7 days with dynamic categories (active + any archived present in last 7 days)
    const days = [];
    const today = new Date();
    const activeOrder = categories.map((c) => c.id);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toLocalDateKey(d);
      const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
      const perCat = new Map();
      let sumSec = 0;

      sessions.forEach((s) => {
        if (s.date !== key || s.durationSec <= 0) return;
        const meta = getCategoryMeta(s.category, s);
        const cur = perCat.get(meta.id) || { id: meta.id, label: meta.label, color: meta.color, sec: 0 };
        cur.sec += s.durationSec;
        perCat.set(meta.id, cur);
        sumSec += s.durationSec;
      });

      const orderedItems = Array.from(perCat.values()).sort((a, b) => {
        const ia = activeOrder.indexOf(a.id);
        const ib = activeOrder.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      days.push({ key, label, items: orderedItems, sumSec, sumHours: sumSec / 3600 });
    }

    const maxHours = Math.max(2, Math.ceil(Math.max(...days.map((d) => d.sumHours))));
    const padLeft = 44;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 34;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Horizontal grid lines
    const steps = 4;
    ctx.font = "500 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= steps; i++) {
      const val = (maxHours / steps) * i;
      const y = padTop + chartH - (val / maxHours) * chartH;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = mutedColor;
      ctx.fillText(`${val.toFixed(1)}h`, padLeft - 8, y);
    }

    const colW = chartW / days.length;
    const barW = Math.min(44, colW * 0.54);
    const segments = [];
    const columns = [];

    days.forEach((day, colIdx) => {
      const colX = padLeft + colIdx * colW;
      const x = colX + (colW - barW) / 2;
      let currentY = padTop + chartH;

      if (hoveredBarColIdx === colIdx) {
        ctx.fillStyle = borderColor;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(colX + 4, padTop, colW - 8, chartH);
        ctx.globalAlpha = 1;
      }

      const breakdown = [];
      day.items.forEach((entry) => {
        const segH = (entry.sec / 3600 / maxHours) * chartH * progress;
        currentY -= segH;

        const segIdx = segments.length;
        const isSegHovered = hoveredBarSegIdx === segIdx;
        ctx.fillStyle = entry.color;
        ctx.globalAlpha = hoveredBarSegIdx >= 0 && !isSegHovered ? 0.65 : 1;
        ctx.fillRect(x, currentY, barW, segH);
        if (isSegHovered) {
          ctx.strokeStyle = textColor;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.75, currentY + 0.75, barW - 1.5, Math.max(0, segH - 1.5));
        }
        ctx.globalAlpha = 1;

        const seg = {
          colIdx,
          x,
          y: currentY,
          w: barW,
          h: segH,
          dayLabel: day.label,
          dayKey: day.key,
          catLabel: entry.label,
          color: entry.color,
          sec: entry.sec,
          dayTotalSec: day.sumSec,
        };
        segments.push(seg);
        breakdown.push(seg);
      });

      columns.push({
        colIdx,
        x: colX,
        y: padTop,
        w: colW,
        h: chartH,
        dayLabel: day.label,
        dayKey: day.key,
        sumSec: day.sumSec,
        breakdown,
      });

      if (day.sumHours > 0 && progress > 0.75) {
        ctx.globalAlpha = Math.min(1, (progress - 0.75) * 4);
        ctx.fillStyle = hoveredBarColIdx === colIdx ? textColor : mutedColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${day.sumHours.toFixed(1)}h`, x + barW / 2, currentY - 4);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = hoveredBarColIdx === colIdx ? textColor : mutedColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(day.label, x + barW / 2, padTop + chartH + 10);
    });

    barGeometry = { segments, columns, width, height };
  }

  dailyBarCanvas.addEventListener("mousemove", (e) => {
    const rect = dailyBarCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = ((e.clientX - rect.left) / rect.width) * barGeometry.width;
    const my = ((e.clientY - rect.top) / rect.height) * barGeometry.height;

    const segIdx = barGeometry.segments.findIndex(
      (s) => mx >= s.x && mx <= s.x + s.w && my >= s.y && my <= s.y + s.h
    );
    const col = barGeometry.columns.find(
      (c) => mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h
    );
    const colIdx = col ? col.colIdx : -1;

    if (segIdx !== hoveredBarSegIdx || colIdx !== hoveredBarColIdx) {
      hoveredBarSegIdx = segIdx;
      hoveredBarColIdx = colIdx;
      renderDailyBarChart();
    }

    if (segIdx >= 0) {
      const seg = barGeometry.segments[segIdx];
      showChartTooltip(
        `
        <div class="tooltip-title">
          <span class="dot" style="background:${seg.color}"></span>
          <span>${escapeHtml(seg.catLabel)} · ${escapeHtml(seg.dayLabel)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-row-label">Module</span>
          <span class="tooltip-row-val">${formatShort(seg.sec)} (${pct(seg.sec, seg.dayTotalSec)}%)</span>
        </div>
        <hr class="tooltip-divider" />
        <div class="tooltip-row">
          <span class="tooltip-row-label">Day Total</span>
          <span class="tooltip-row-val">${formatShort(seg.dayTotalSec)}</span>
        </div>
      `,
        e.clientX,
        e.clientY
      );
    } else if (col && col.sumSec > 0) {
      const rows = col.breakdown
        .slice()
        .reverse()
        .map(
          (b) => `
          <div class="tooltip-row">
            <span class="tooltip-row-label">
              <span class="dot" style="background:${b.color}"></span>
              ${escapeHtml(b.catLabel)}
            </span>
            <span class="tooltip-row-val">${formatShort(b.sec)}</span>
          </div>
        `
        )
        .join("");
      showChartTooltip(
        `
        <div class="tooltip-title">${escapeHtml(col.dayLabel)} (${escapeHtml(col.dayKey)})</div>
        ${rows}
        <hr class="tooltip-divider" />
        <div class="tooltip-row">
          <span class="tooltip-row-label">Total</span>
          <span class="tooltip-row-val">${formatShort(col.sumSec)}</span>
        </div>
      `,
        e.clientX,
        e.clientY
      );
    } else {
      hideChartTooltip();
    }
  });

  dailyBarCanvas.addEventListener("mouseleave", () => {
    if (hoveredBarSegIdx !== -1 || hoveredBarColIdx !== -1) {
      hoveredBarSegIdx = -1;
      hoveredBarColIdx = -1;
      renderDailyBarChart();
    }
    hideChartTooltip();
  });

  function showChartTooltip(html, clientX, clientY) {
    chartTooltip.innerHTML = html;
    chartTooltip.classList.remove("hidden");
    const offset = 14;
    const tipRect = chartTooltip.getBoundingClientRect();
    let left = clientX + offset;
    let top = clientY + offset;
    if (left + tipRect.width > window.innerWidth - 10) left = clientX - tipRect.width - offset;
    if (top + tipRect.height > window.innerHeight - 10) top = clientY - tipRect.height - offset;
    chartTooltip.style.left = `${Math.max(8, left)}px`;
    chartTooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideChartTooltip() {
    chartTooltip.classList.add("hidden");
  }

  function renderHistory() {
    const tbody = document.getElementById("historyBody");
    const emptyEl = document.getElementById("emptyHistory");
    const filter = historyFilter.value || "all";

    const visible = sessions.filter((s) => {
      if (filter === "all") return true;
      if (filter.startsWith("group:")) {
        return getCategoryMeta(s.category, s).group === filter.slice(6);
      }
      if (filter.startsWith("cat:")) {
        return s.category === filter.slice(4);
      }
      return true;
    });

    if (!visible.length) {
      tbody.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    tbody.innerHTML = visible
      .slice(0, 150)
      .map((s) => {
        const meta = getCategoryMeta(s.category, s);
        return `
          <tr>
            <td>${escapeHtml(s.date)}</td>
            <td>
              <span class="cat-chip">
                <span class="dot" style="background:${meta.color}"></span>
                ${escapeHtml(meta.label)}
              </span>
            </td>
            <td class="muted">${escapeHtml(meta.group)}</td>
            <td><strong>${formatShort(s.durationSec)}</strong></td>
            <td class="muted">${escapeHtml(s.note || "—")}</td>
            <td class="col-action">
              <div class="action-btns">
                <button class="edit-btn" data-id="${escapeHtml(s.id)}" type="button" title="Edit session">Edit</button>
                <button class="delete-btn" data-id="${escapeHtml(s.id)}" type="button" title="Delete session">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });

    tbody.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        sessions = sessions.filter((s) => s.id !== id);
        persistSessions();
        renderAll();
        showToast("Session deleted.");
      });
    });
  }

  // --- Helpers ---
  function formatHMS(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function formatShort(sec) {
    const totalMin = Math.round(sec / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0 && totalMin === 0 && sec > 0) return "<1m";
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  function toLocalDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2600);
  }

  function triggerSaveCelebration(originEl, primaryColor) {
    if (prefersReducedMotion()) return;
    const rect = originEl ? originEl.getBoundingClientRect() : null;
    const ox = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const oy = rect ? rect.top + rect.height / 2 : 90;
    const palette = [primaryColor || "#6366f1", "#10b981", "#06b6d4", "#ec4899", "#f59e0b"];
    const count = 20;
    const frag = document.createDocumentFragment();
    const particles = [];

    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti-particle";
      p.style.left = `${ox}px`;
      p.style.top = `${oy}px`;
      p.style.background = palette[i % palette.length];
      p.style.borderRadius = i % 3 === 0 ? "50%" : "2px";
      p.style.transform = "translate3d(0, 0, 0) scale(1)";
      p.style.opacity = "1";
      frag.appendChild(p);
      particles.push(p);
    }

    document.body.appendChild(frag);

    requestAnimationFrame(() => {
      particles.forEach((p, idx) => {
        const angle = (Math.PI * 2 * idx) / count + (Math.random() - 0.5) * 0.35;
        const dist = 36 + Math.random() * 68;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 18;
        const rot = Math.round((Math.random() - 0.5) * 320);
        p.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${rot}deg) scale(0.35)`;
        p.style.opacity = "0";
      });
    });

    setTimeout(() => {
      particles.forEach((p) => p.remove());
    }, 760);
  }
})();
