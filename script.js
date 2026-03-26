const ACCOUNTS_KEY = "studyBuddyAccounts";
const SESSION_KEY = "studyBuddySession";
const AI_CONFIG_KEY = "studyBuddyAIConfig";
const priorityOrder = ["Urgent", "High", "Medium", "Low"];
const priorityWeights = { Urgent: 10, High: 7, Medium: 4, Low: 2 };
const difficultyWeights = { Challenging: 4, Moderate: 2.5, Light: 1.5 };

const starterSettings = {
    dailyStudyHours: 4,
    preferredStudyTime: "18:00-20:00",
    taskDifficultyWeighting: 1
};

const defaultAiConfig = {
    provider: "gemini",
    enabled: true,
    apiKey: "",
    model: "gemini-1.5-flash",
    purpose: "Organise notes and generate study plans"
};

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function qs(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[character]));
}

function currentPage() {
    return document.body.dataset.page || "";
}

function normalizeEmail(email) {
    return (email || "").trim().toLowerCase();
}

function loadAiConfig() {
    try {
        return {
            ...defaultAiConfig,
            ...JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || "{}")
        };
    } catch (error) {
        return { ...defaultAiConfig };
    }
}

function saveAiConfig(config) {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({
        ...defaultAiConfig,
        ...(config || {})
    }));
}

function buildGeminiStudyPlanPayload(activeStore) {
    if (!activeStore) {
        return null;
    }

    return {
        provider: "gemini",
        model: loadAiConfig().model,
        settings: activeStore.settings,
        tasks: activeStore.orderedTasks.map((task) => ({
            title: task.title,
            subject: task.subject,
            deadline: task.deadline,
            priority: task.priority,
            difficulty: task.difficulty,
            hours: task.hours
        })),
        prompt: "Create a balanced weekly study plan from these tasks. Prioritise near deadlines, difficult tasks, and realistic daily study limits."
    };
}

function buildGeminiNotesPayload(note) {
    return {
        provider: "gemini",
        model: loadAiConfig().model,
        title: note?.title || "Untitled Note",
        body: note?.body || "",
        prompt: "Organise these study notes into a concise summary, key topics, action items, and revision questions."
    };
}

function loadAccounts() {
    try {
        return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
    } catch (error) {
        return {};
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function sessionEmail() {
    return normalizeEmail(localStorage.getItem(SESSION_KEY) || "");
}

function hasSession() {
    const email = sessionEmail();
    return Boolean(email && loadAccounts()[email]);
}

function setSession(email) {
    if (email) {
        localStorage.setItem(SESSION_KEY, normalizeEmail(email));
    } else {
        localStorage.removeItem(SESSION_KEY);
    }
}

function isStorageDebugMode() {
    return new URLSearchParams(window.location.search).get("debug") === "1";
}

function guardPage() {
    const page = currentPage();

    if (page === "login") {
        if (hasSession()) {
            window.location.replace("dashboard.html");
            return false;
        }
        return true;
    }

    if (!hasSession()) {
        window.location.replace("login.html");
        return false;
    }

    if (page === "storage" && !isStorageDebugMode()) {
        window.location.replace("dashboard.html");
        return false;
    }

    return true;
}

function blankStore(user) {
    return {
        users: [user],
        settings: cloneData(starterSettings),
        tasks: [],
        modules: [],
        studyPlans: [],
        notes: [],
        aiAssistant: {
            lastPrompt: "",
            lastGeneratedAt: "",
            lastPlan: null
        }
    };
}

function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatHours(hours) {
    return `${Number(hours || 0).toFixed(1)} hrs`;
}

function formatDate(dateString) {
    if (!dateString) {
        return "No date";
    }

    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short"
    });
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function safeDaysUntil(dateString) {
    const dueDate = new Date(`${dateString}T00:00:00`);
    return Math.ceil((dueDate - getToday()) / 86400000);
}

function getDeadlineLabel(dateString) {
    const days = safeDaysUntil(dateString);

    if (days < 0) {
        return "Past due";
    }
    if (days === 0) {
        return "Due today";
    }
    if (days === 1) {
        return "Due tomorrow";
    }
    return `Due in ${days} days`;
}

function normalizeTask(task) {
    const deadline = task.deadline || task.due || "";
    return {
        id: task.id || `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title: task.title || "Untitled Task",
        subject: task.subject || "General Study",
        deadline,
        due: deadline,
        priority: priorityWeights[task.priority] ? task.priority : "Medium",
        hours: Number(task.hours || 0),
        difficulty: difficultyWeights[task.difficulty] ? task.difficulty : "Moderate",
        completed: Boolean(task.completed),
        createdAt: task.createdAt || new Date().toISOString()
    };
}

function normalizeNote(note) {
    return {
        id: note.id || `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title: note.title || "Untitled Note",
        taskId: note.taskId || "",
        taskTitle: note.taskTitle || "General Note",
        subject: note.subject || "General",
        body: note.body || "",
        createdAt: note.createdAt || new Date().toISOString()
    };
}

function deriveModules(tasks) {
    const moduleMap = new Map();

    tasks.forEach((task) => {
        const existing = moduleMap.get(task.subject) || {
            name: task.subject,
            targetHours: 0,
            completedTasks: 0,
            activeTasks: 0
        };

        existing.targetHours += Number(task.hours || 0);
        if (task.completed) {
            existing.completedTasks += 1;
        } else {
            existing.activeTasks += 1;
        }

        moduleMap.set(task.subject, existing);
    });

    return Array.from(moduleMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function computeTaskScore(task, settings) {
    const daysUntil = safeDaysUntil(task.deadline);
    const urgencyScore = Math.max(0, 14 - Math.max(daysUntil, 0));
    const difficultyScore = difficultyWeights[task.difficulty] * Number(settings.taskDifficultyWeighting || 1);
    const workloadScore = Math.min(Number(task.hours || 0) * 1.4, 8);
    const priorityScore = priorityWeights[task.priority] || priorityWeights.Medium;
    const totalScore = urgencyScore + difficultyScore + workloadScore + priorityScore;
    const recommendedHours = Math.max(1, Number(task.hours || 0) + urgencyScore * 0.12 + difficultyScore * 0.35);

    return {
        ...task,
        score: Number(totalScore.toFixed(2)),
        daysUntil,
        recommendedHours: Number(recommendedHours.toFixed(1))
    };
}

function buildWeeklySchedule(orderedTasks, settings) {
    const days = [];
    const start = getToday();
    const dailyLimit = Number(settings.dailyStudyHours || 4);

    for (let index = 0; index < 7; index += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        days.push({
            iso: date.toISOString().slice(0, 10),
            label: date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
            slots: [],
            totalHours: 0
        });
    }

    orderedTasks.forEach((task) => {
        let remaining = task.recommendedHours;
        const dueIndex = Math.max(0, Math.min(days.length - 1, task.daysUntil >= 0 ? task.daysUntil : 0));

        for (let dayIndex = 0; dayIndex <= dueIndex && remaining > 0; dayIndex += 1) {
            const day = days[dayIndex];
            const available = Math.max(0, dailyLimit - day.totalHours);

            if (available <= 0) {
                continue;
            }

            const allocation = Number(Math.min(remaining, Math.max(1, available)).toFixed(1));
            day.slots.push({
                id: task.id,
                title: task.title,
                subject: task.subject,
                hours: allocation,
                priority: task.priority,
                deadline: task.deadline
            });
            day.totalHours = Number((day.totalHours + allocation).toFixed(1));
            remaining = Number((remaining - allocation).toFixed(1));
        }

        if (remaining > 0) {
            const fallbackDay = days[Math.min(dueIndex, days.length - 1)];
            fallbackDay.slots.push({
                id: task.id,
                title: task.title,
                subject: task.subject,
                hours: remaining,
                priority: task.priority,
                deadline: task.deadline
            });
            fallbackDay.totalHours = Number((fallbackDay.totalHours + remaining).toFixed(1));
        }
    });

    return days;
}

function buildStoreModel(rawStore) {
    const tasks = (rawStore.tasks || []).map(normalizeTask);
    const notes = (rawStore.notes || []).map(normalizeNote).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const orderedTasks = tasks
        .filter((task) => !task.completed)
        .map((task) => computeTaskScore(task, rawStore.settings))
        .sort((a, b) => b.score - a.score || new Date(a.deadline) - new Date(b.deadline));
    const completedTasks = tasks.filter((task) => task.completed);
    const modules = deriveModules(tasks);
    const weeklySchedule = buildWeeklySchedule(orderedTasks, rawStore.settings);
    const studyPlans = weeklySchedule.flatMap((day) => day.slots.map((slot) => ({
        date: day.iso,
        time: rawStore.settings.preferredStudyTime,
        taskId: slot.id,
        title: slot.title,
        subject: slot.subject,
        hours: slot.hours,
        priority: slot.priority
    })));
    const totalHours = orderedTasks.reduce((sum, task) => sum + task.recommendedHours, 0);
    const completedHours = completedTasks.reduce((sum, task) => sum + Number(task.hours || 0), 0);

    return {
        ...rawStore,
        tasks,
        notes,
        modules,
        studyPlans,
        orderedTasks,
        completedTasks,
        weeklySchedule,
        stats: {
            totalTasks: tasks.length,
            activeTasks: orderedTasks.length,
            completedTasks: completedTasks.length,
            totalHours: Number(totalHours.toFixed(1)),
            completedHours: Number(completedHours.toFixed(1)),
            averageHours: Number((tasks.length ? (totalHours + completedHours) / tasks.length : 0).toFixed(1)),
            moduleCount: modules.length,
            noteCount: notes.length,
            studyPlanCount: studyPlans.length
        }
    };
}

function loadStore() {
    const account = loadAccounts()[sessionEmail()];
    if (!account) {
        return null;
    }

    const planner = account.planner || blankStore({ id: account.id, name: account.name, email: account.email });
    planner.users = [{ id: account.id, name: account.name, email: account.email }];
    planner.settings = { ...starterSettings, ...(planner.settings || {}) };
    planner.tasks = planner.tasks || [];
    planner.notes = planner.notes || [];
    planner.modules = planner.modules || [];
    planner.studyPlans = planner.studyPlans || [];
    planner.aiAssistant = planner.aiAssistant || {
        lastPrompt: "",
        lastGeneratedAt: "",
        lastPlan: null
    };
    return buildStoreModel(planner);
}

function saveStore(nextStore) {
    const email = sessionEmail();
    const accounts = loadAccounts();
    const account = accounts[email];

    if (!account) {
        return buildStoreModel(nextStore);
    }

    const model = buildStoreModel(nextStore);
    accounts[email] = {
        ...account,
        name: model.users[0]?.name || account.name,
        planner: {
            settings: model.settings,
            tasks: model.tasks,
            modules: model.modules,
            studyPlans: model.studyPlans,
            notes: model.notes,
            aiAssistant: model.aiAssistant
        }
    };
    saveAccounts(accounts);
    return model;
}

function setText(id, value) {
    const element = qs(id);
    if (element) {
        element.textContent = value;
    }
}

function renderGreeting() {
    setText("user-name", store?.users[0]?.name || "Student");
}

function renderStudyPlan() {
    const studyPlanGrid = qs("study-plan-grid");
    if (!studyPlanGrid || !store) {
        return;
    }

    const todayPlan = store.weeklySchedule[0]?.slots || [];
    studyPlanGrid.innerHTML = todayPlan.length ? todayPlan.map((slot) => `
        <article class="study-plan-card">
            <p class="card-label">Today</p>
            <h3>${slot.title}</h3>
            <p class="task-meta">${slot.subject}</p>
            <p class="task-meta">Focus block: ${formatHours(slot.hours)}</p>
            <p class="task-meta">${getDeadlineLabel(slot.deadline)}</p>
            <span class="priority-tag">${slot.priority}</span>
        </article>
    `).join("") : `
        <article class="study-plan-card empty-card">
            <p class="card-label">Today</p>
            <h3>No study blocks yet</h3>
            <p class="task-meta">Add a task to generate your first AI plan.</p>
        </article>
    `;
}

function renderPriorities() {
    const board = qs("priority-board");
    if (!board || !store) {
        return;
    }

    board.innerHTML = priorityOrder.map((level) => {
        const group = store.orderedTasks.filter((task) => task.priority === level);
        return `
            <section class="priority-column ${level.toLowerCase()}">
                <h3>${level}</h3>
                <div class="priority-stack">
                    ${group.length ? group.map((task) => `
                        <article class="priority-task">
                            <h4>${task.title}</h4>
                            <p class="priority-meta">${task.subject} · ${getDeadlineLabel(task.deadline)}</p>
                            <p class="priority-meta">Score ${task.score} · ${formatHours(task.recommendedHours)}</p>
                            <strong><span class="priority-tag">${task.priority}</span></strong>
                        </article>
                    `).join("") : '<p class="priority-meta">No tasks in this priority yet.</p>'}
                </div>
            </section>
        `;
    }).join("");
}

function renderTaskCards() {
    const row = qs("task-card-row");
    if (!row || !store) {
        return;
    }

    row.innerHTML = store.orderedTasks.map((task) => `
        <article class="task-card">
            <div class="icon-badge">${task.priority.slice(0, 2).toUpperCase()}</div>
            <h3>${task.title}</h3>
            <p class="task-meta">Subject: ${task.subject}</p>
            <p class="task-meta">${getDeadlineLabel(task.deadline)}</p>
            <p class="task-meta">Difficulty: ${task.difficulty}</p>
            <p class="task-meta">Recommended time: ${formatHours(task.recommendedHours)}</p>
            <span class="priority-tag">${task.priority}</span>
        </article>
    `).join("") || '<article class="task-card"><h3>No active tasks</h3><p class="task-meta">Add a task to populate the dashboard.</p></article>';
}

function renderDeadlines() {
    const deadlineGrid = document.querySelector(".deadline-grid");
    if (!deadlineGrid || !store) {
        return;
    }

    deadlineGrid.innerHTML = store.orderedTasks.slice(0, 3).map((task) => `
        <article class="deadline-card">
            <div class="icon-badge">${task.subject.slice(0, 2).toUpperCase()}</div>
            <h3>${task.title}</h3>
            <p>${getDeadlineLabel(task.deadline)}</p>
            <strong>Subject: ${task.subject}</strong>
        </article>
    `).join("") || '<article class="deadline-card"><div class="icon-badge">OK</div><h3>No upcoming deadlines</h3><p>Your task list is clear.</p><strong>Ready for a new task</strong></article>';
}

function renderTaskTable() {
    const taskTable = qs("task-table-body");
    if (!taskTable || !store) {
        return;
    }

    taskTable.innerHTML = store.tasks.map((task) => `
        <tr>
            <td>${task.title}</td>
            <td>${task.subject}</td>
            <td>${formatDate(task.deadline)}</td>
            <td>${task.priority}</td>
            <td>${formatHours(task.hours)}</td>
            <td>${task.completed ? "Completed" : "Active"}</td>
            <td>
                <button class="ghost-button small-button action-button" type="button" data-complete-id="${task.id}">
                    ${task.completed ? "Reopen" : "Complete"}
                </button>
            </td>
        </tr>
    `).join("");
}

function renderPreviewMetrics() {
    if (!store) {
        return;
    }

    const hoursInput = qs("task-hours");
    if (!hoursInput) {
        return;
    }

    const projectedHours = store.stats.totalHours + Number(hoursInput.value || 0);
    const activeCount = store.stats.activeTasks + (qs("task-title")?.value.trim() ? 1 : 0);

    setText("preview-task-count", `${activeCount}`);
    setText("preview-total-hours", formatHours(projectedHours));
}

function renderCalendarPage() {
    const calendarGrid = qs("calendar-week-grid");
    if (!calendarGrid || !store) {
        return;
    }

    calendarGrid.innerHTML = store.weeklySchedule.map((day) => `
        <article class="calendar-day-card">
            <div class="calendar-day-header">
                <h3>${day.label}</h3>
                <span>${formatHours(day.totalHours)}</span>
            </div>
            <div class="calendar-slots">
                ${day.slots.length ? day.slots.map((slot) => `
                    <div class="calendar-slot ${slugify(slot.priority)}">
                        <strong>${slot.title}</strong>
                        <p>${slot.subject}</p>
                        <span>${formatHours(slot.hours)} · ${getDeadlineLabel(slot.deadline)}</span>
                    </div>
                `).join("") : '<p class="priority-meta">No study blocks scheduled.</p>'}
            </div>
        </article>
    `).join("");
}

function renderProgressCharts() {
    if (!store) {
        return;
    }

    const barChart = qs("progress-bar-chart");
    if (barChart) {
        const heights = store.weeklySchedule.map((day) => {
            const ratio = Number(store.settings.dailyStudyHours || 4) ? day.totalHours / Number(store.settings.dailyStudyHours || 4) : 0;
            return `${Math.max(12, Math.min(100, ratio * 100))}%`;
        });
        barChart.innerHTML = heights.map((height) => `<span style="height: ${height};"></span>`).join("");
    }

    const pieChart = qs("subject-pie-chart");
    if (pieChart) {
        const total = store.modules.reduce((sum, module) => sum + Number(module.targetHours || 0), 0) || 1;
        const colors = ["#d9d5cd", "#7d7d7d", "#b4b1aa", "#c9c4ba", "#e5e1d8", "#d7e0dc"];
        let cursor = 0;
        const slices = store.modules.map((module, index) => {
            const share = Number(module.targetHours || 0) / total;
            const start = Math.round(cursor * 100);
            cursor += share;
            const end = Math.round(cursor * 100);
            return `${colors[index % colors.length]} ${start}% ${end}%`;
        });
        pieChart.style.background = `conic-gradient(${slices.join(", ") || "#d9d5cd 0 100%"})`;
    }

    const legend = qs("subject-legend");
    if (legend) {
        legend.innerHTML = store.modules.map((module) => `<li>${module.name}: ${formatHours(module.targetHours)}</li>`).join("");
    }
}

function renderModules() {
    const grid = qs("module-grid");
    if (!grid || !store) {
        return;
    }

    grid.innerHTML = store.modules.map((module) => `
        <article class="overview-card mini-stat-card">
            <p class="card-label">Module</p>
            <strong>${module.name}</strong>
            <span>${formatHours(module.targetHours)} · ${module.activeTasks} active · ${module.completedTasks} completed</span>
        </article>
    `).join("");
}

function renderStudyPlanList() {
    const list = qs("study-plan-list");
    if (!list || !store) {
        return;
    }

    list.innerHTML = store.studyPlans.slice(0, 8).map((item) => `
        <article class="study-plan-card">
            <p class="card-label">${formatDate(item.date)}</p>
            <h3>${item.title}</h3>
            <p class="task-meta">${item.subject}</p>
            <p class="task-meta">${item.time}</p>
            <span class="priority-tag">${formatHours(item.hours)}</span>
        </article>
    `).join("") || '<p class="priority-meta">No study plan generated yet.</p>';
}

function renderNoteTaskOptions() {
    const select = qs("note-task");
    if (!select || !store) {
        return;
    }

    const options = ['<option value="">General Note</option>'].concat(
        store.tasks.map((task) => `<option value="${task.id}">${task.title}</option>`)
    );
    select.innerHTML = options.join("");
}

function renderNotes() {
    const noteList = qs("note-list");
    if (!noteList || !store) {
        return;
    }

    noteList.innerHTML = store.notes.map((note) => `
        <article class="note-card">
            <div class="note-card-header">
                <div>
                    <p class="card-label">${note.subject}</p>
                    <h3>${note.title}</h3>
                </div>
                <div class="note-card-actions">
                    <button class="ghost-button small-button action-button" type="button" data-view-note-id="${note.id}">
                        View
                    </button>
                    <button class="ghost-button small-button action-button" type="button" data-edit-note-id="${note.id}">Edit</button>
                    <button class="ghost-button small-button action-button" type="button" data-delete-note-id="${note.id}">Delete</button>
                </div>
            </div>
            <p class="task-meta">${note.taskTitle}</p>
            <p class="task-meta">${formatDateTime(note.createdAt)}</p>
            <p class="note-card-preview">${note.body.slice(0, 110)}${note.body.length > 110 ? "..." : ""}</p>
        </article>
    `).join("") || '<article class="note-card"><h3>No notes yet</h3><p class="task-meta">Save a note and link it to a task when needed.</p></article>';
}

function renderStoragePage() {
    const dump = qs("storage-dump");
    if (!dump || !store) {
        return;
    }

    dump.textContent = JSON.stringify({
        users: store.users,
        tasks: store.tasks,
        modules: store.modules,
        studyPlans: store.studyPlans,
        settings: store.settings,
        notes: store.notes
    }, null, 2);

    setText("storage-task-count", `${store.stats.totalTasks}`);
    setText("storage-module-count", `${store.stats.moduleCount}`);
    setText("storage-plan-count", `${store.stats.studyPlanCount}`);
}

function renderSettingsForm() {
    if (!qs("settings-form") || !store) {
        return;
    }

    qs("daily-study-hours").value = store.settings.dailyStudyHours;
    qs("preferred-study-time").value = store.settings.preferredStudyTime;
    qs("difficulty-weighting").value = String(store.settings.taskDifficultyWeighting);
}

function buildGeminiMvpPlan(promptText) {
    const prompt = promptText.trim() || "Create a balanced study plan for my current workload.";
    const sessions = [];

    (store?.weeklySchedule || []).forEach((day) => {
        day.slots.forEach((slot) => {
            if (sessions.length < 6) {
                sessions.push({
                    day: day.label,
                    title: slot.title,
                    subject: slot.subject,
                    hours: slot.hours,
                    priority: slot.priority,
                    reason: `${slot.priority} priority with ${getDeadlineLabel(slot.deadline).toLowerCase()}`
                });
            }
        });
    });

    if (!sessions.length) {
        (store?.orderedTasks || []).slice(0, 3).forEach((task, index) => {
            sessions.push({
                day: `Session ${index + 1}`,
                title: task.title,
                subject: task.subject,
                hours: Math.max(1, Math.min(3, Number(task.recommendedHours || task.hours || 1))),
                priority: task.priority,
                reason: `${task.priority} priority and ${getDeadlineLabel(task.deadline).toLowerCase()}`
            });
        });
    }

    return {
        prompt,
        title: sessions.length ? "Study plan generated" : "No tasks available",
        summary: sessions.length
            ? "This plan organises your current tasks into manageable study blocks and surfaces the most urgent work first."
            : "Add some tasks first so the AI section has something to organise.",
        sessions
    };
}

function renderAiWorkspace() {
    const summaryTitle = qs("gemini-summary-title");
    if (!summaryTitle || !store) {
        return;
    }

    const summaryText = qs("gemini-summary-text");
    const sessionList = qs("gemini-session-list");
    const modelName = qs("gemini-model-name");
    const configStatus = qs("gemini-config-status");
    const promptBox = qs("gemini-prompt");
    const aiConfig = loadAiConfig();
    const plan = store.aiAssistant?.lastPlan;

    if (modelName) {
        modelName.textContent = `${aiConfig.provider} · ${aiConfig.model}`;
    }

    if (configStatus) {
        configStatus.textContent = aiConfig.apiKey
            ? "Gemini is available to support study planning and note organisation."
            : "Gemini is set up through the app configuration and supports study planning features.";
    }

    if (promptBox && store.aiAssistant?.lastPrompt && !promptBox.value) {
        promptBox.value = store.aiAssistant.lastPrompt;
    }

    if (!plan) {
        summaryTitle.textContent = "No plan generated yet";
        summaryText.textContent = "Submit a prompt and StudyBuddy will create a study plan from your current tasks.";
        sessionList.innerHTML = `
            <div class="ai-session-card empty-card">
                <strong>Waiting for input</strong>
                <p class="task-meta">Your generated study sessions will appear here.</p>
            </div>
        `;
        return;
    }

    summaryTitle.textContent = plan.title;
    summaryText.textContent = `${plan.summary} Prompt: "${plan.prompt}"`;
    sessionList.innerHTML = plan.sessions.length ? plan.sessions.map((session) => `
        <article class="ai-session-card">
            <div class="ai-session-topline">
                <strong>${escapeHtml(session.day)}</strong>
                <span class="priority-tag">${escapeHtml(session.priority)}</span>
            </div>
            <h4>${escapeHtml(session.title)}</h4>
            <p class="task-meta">${escapeHtml(session.subject)} · ${formatHours(session.hours)}</p>
            <p class="task-meta">${escapeHtml(session.reason)}</p>
        </article>
    `).join("") : `
        <div class="ai-session-card empty-card">
            <strong>No tasks available</strong>
            <p class="task-meta">Add tasks in StudyBuddy before generating a study plan.</p>
        </div>
    `;
}

function updateAnalytics() {
    if (!store) {
        return;
    }

    setText("priority-count", `${store.stats.activeTasks}`);
    setText("planned-hours", formatHours(store.stats.totalHours));
    setText("total-study-hours", formatHours(store.stats.totalHours + store.stats.completedHours));
    setText("average-study-time", formatHours(store.stats.averageHours));
    setText("task-summary", `You have ${store.stats.activeTasks} active tasks, ${store.stats.completedTasks} completed tasks, and ${store.stats.noteCount} notes.`);
    setText("progress-completed-count", `${store.stats.completedTasks}`);
    setText("progress-total-hours", formatHours(store.stats.totalHours + store.stats.completedHours));
    setText("progress-average-hours", formatHours(store.stats.averageHours));
    setText("settings-total-tasks", `${store.stats.totalTasks}`);
    setText("settings-completed-tasks", `${store.stats.completedTasks}`);
    setText("settings-deadlines", `${store.stats.activeTasks}`);
    setText("notes-count", `${store.stats.noteCount}`);
}

function refreshUI() {
    renderGreeting();
    renderStudyPlan();
    renderPriorities();
    renderTaskCards();
    renderDeadlines();
    renderTaskTable();
    renderPreviewMetrics();
    renderCalendarPage();
    renderProgressCharts();
    renderModules();
    renderStudyPlanList();
    renderNoteTaskOptions();
    renderNotes();
    renderStoragePage();
    renderSettingsForm();
    renderAiWorkspace();
    updateAnalytics();
}

function resetNoteEditor() {
    const form = qs("notes-form");
    if (!form) {
        return;
    }

    form.reset();
    qs("editing-note-id").value = "";
    setText("notes-editor-status", "Create a new note");
    renderNoteTaskOptions();
}

function inferSubject(title, subject) {
    if (subject) {
        return subject;
    }

    const subjects = ["Math", "Physics", "Computer Science", "History", "Biology", "Chemistry", "English"];
    return subjects.find((entry) => title.toLowerCase().includes(entry.toLowerCase())) || "General Study";
}

function showAuthMessage(message, isError = false) {
    const output = qs("auth-message");
    if (!output) {
        return;
    }

    output.textContent = message;
    output.classList.toggle("error-text", isError);
}

function signUp(event) {
    event.preventDefault();

    const name = qs("signup-name")?.value.trim();
    const email = normalizeEmail(qs("signup-email")?.value);
    const password = qs("signup-password")?.value.trim();

    if (!name || !email || !password) {
        showAuthMessage("Fill in all sign up fields.", true);
        return;
    }

    const accounts = loadAccounts();
    if (accounts[email]) {
        showAuthMessage("That email already has an account. Sign in instead.", true);
        return;
    }

    const userId = `user-${Date.now()}`;
    accounts[email] = {
        id: userId,
        name,
        email,
        password,
        planner: blankStore({ id: userId, name, email })
    };
    saveAccounts(accounts);
    setSession(email);
    window.location.replace("dashboard.html");
}

function signIn(event) {
    event.preventDefault();

    const email = normalizeEmail(qs("signin-email")?.value);
    const password = qs("signin-password")?.value.trim();
    const account = loadAccounts()[email];

    if (!account || account.password !== password) {
        showAuthMessage("Email or password is incorrect.", true);
        return;
    }

    setSession(email);
    window.location.replace("dashboard.html");
}

function addTask(event) {
    event.preventDefault();

    const title = qs("task-title")?.value.trim();
    const subject = inferSubject(title, qs("task-subject")?.value.trim());
    const deadline = qs("task-date")?.value;
    const priority = qs("task-priority")?.value || "Medium";
    const difficulty = qs("task-difficulty")?.value || "Moderate";
    const hours = Number(qs("task-hours")?.value || 0);

    if (!title || !deadline || !hours) {
        return;
    }

    store.tasks.unshift(normalizeTask({
        title,
        subject,
        deadline,
        priority,
        difficulty,
        hours,
        completed: false
    }));

    store = saveStore(store);
    event.currentTarget.reset();

    if (qs("task-priority")) {
        qs("task-priority").value = "Medium";
    }
    if (qs("task-difficulty")) {
        qs("task-difficulty").value = "Moderate";
    }
    if (qs("task-hours")) {
        qs("task-hours").value = "1.5";
    }

    refreshUI();
}

function saveSettings(event) {
    event.preventDefault();

    store.settings = {
        dailyStudyHours: Number(qs("daily-study-hours").value || 4),
        preferredStudyTime: qs("preferred-study-time").value.trim() || "18:00-20:00",
        taskDifficultyWeighting: Number(qs("difficulty-weighting").value || 1)
    };

    store = saveStore(store);
    refreshUI();
}

function saveNote(event) {
    event.preventDefault();

    const editingId = qs("editing-note-id")?.value || "";
    const title = qs("note-title")?.value.trim();
    const taskId = qs("note-task")?.value || "";
    const linkedTask = store.tasks.find((task) => task.id === taskId);
    const body = qs("note-body")?.value.trim();
    const subject = linkedTask?.subject || qs("note-subject")?.value.trim() || "General";

    if (!title || !body) {
        return;
    }

    const nextNote = normalizeNote({
        id: editingId || undefined,
        title,
        taskId,
        taskTitle: linkedTask?.title || "General Note",
        subject,
        body
    });

    if (editingId) {
        store.notes = store.notes.map((note) => note.id === editingId ? { ...note, ...nextNote, createdAt: note.createdAt } : note);
    } else {
        store.notes.unshift(nextNote);
    }

    store = saveStore(store);
    resetNoteEditor();
    refreshUI();
}

function generateGeminiPlan(event) {
    event.preventDefault();

    if (!store) {
        return;
    }

    const prompt = qs("gemini-prompt")?.value || "";
    store.aiAssistant = {
        lastPrompt: prompt,
        lastGeneratedAt: new Date().toISOString(),
        lastPlan: buildGeminiMvpPlan(prompt)
    };

    store = saveStore(store);
    renderAiWorkspace();
}

function loadNoteIntoEditor(noteId, mode = "edit") {
    const note = store.notes.find((entry) => entry.id === noteId);
    if (!note) {
        return;
    }

    qs("editing-note-id").value = note.id;
    qs("note-title").value = note.title;
    qs("note-subject").value = note.subject;
    qs("note-body").value = note.body;
    renderNoteTaskOptions();
    qs("note-task").value = note.taskId || "";
    setText("notes-editor-status", mode === "view" ? "Viewing saved note" : "Editing saved note");
    refreshUI();
    document.querySelector(".notes-editor-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    qs("note-title")?.focus();
}

function toggleTaskCompletion(taskId) {
    store.tasks = store.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task);
    store = saveStore(store);
    refreshUI();
}

function deleteNote(noteId) {
    store.notes = store.notes.filter((note) => note.id !== noteId);
    store = saveStore(store);
    refreshUI();
}

function handleActionClick(event) {
    const completeButton = event.target.closest("[data-complete-id]");
    if (completeButton) {
        toggleTaskCompletion(completeButton.dataset.completeId);
        return;
    }

    const deleteButton = event.target.closest("[data-delete-note-id]");
    if (deleteButton) {
        deleteNote(deleteButton.dataset.deleteNoteId);
        return;
    }

    const viewButton = event.target.closest("[data-view-note-id]");
    if (viewButton) {
        loadNoteIntoEditor(viewButton.dataset.viewNoteId, "view");
        return;
    }

    const editButton = event.target.closest("[data-edit-note-id]");
    if (editButton) {
        loadNoteIntoEditor(editButton.dataset.editNoteId);
        return;
    }

    if (event.target.closest("[data-logout]")) {
        setSession("");
        window.location.replace("login.html");
    }
}

function attachEvents() {
    document.addEventListener("click", handleActionClick);

    const signUpForm = qs("signup-form");
    if (signUpForm) {
        signUpForm.addEventListener("submit", signUp);
    }

    const signInForm = qs("signin-form");
    if (signInForm) {
        signInForm.addEventListener("submit", signIn);
    }

    const taskForm = qs("task-form");
    if (taskForm) {
        taskForm.addEventListener("submit", addTask);
        taskForm.addEventListener("input", renderPreviewMetrics);
    }

    const settingsForm = qs("settings-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", saveSettings);
    }

    const notesForm = qs("notes-form");
    if (notesForm) {
        notesForm.addEventListener("submit", saveNote);
    }

    const geminiForm = qs("gemini-form");
    if (geminiForm) {
        geminiForm.addEventListener("submit", generateGeminiPlan);
    }

    const cancelEditButton = qs("cancel-note-edit");
    if (cancelEditButton) {
        cancelEditButton.addEventListener("click", resetNoteEditor);
    }
}

function highlightCurrentNav() {
    const page = currentPage();
    document.querySelectorAll(".sidebar-nav .nav-item").forEach((link) => {
        link.classList.toggle("active", link.dataset.page === page);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    saveAiConfig(loadAiConfig());

    if (!guardPage()) {
        return;
    }

    attachEvents();

    if (currentPage() === "login") {
        return;
    }

    store = loadStore();
    if (!store) {
        setSession("");
        window.location.replace("login.html");
        return;
    }

    highlightCurrentNav();
    refreshUI();
});
