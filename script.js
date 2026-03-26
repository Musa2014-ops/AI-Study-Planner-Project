const tasks = [
    {
        title: "Complete Math Assignment 1",
        subject: "Math",
        hours: 3,
        priority: "Urgent",
        due: "2026-03-28"
    },
    {
        title: "Revise Physics Midterm Topics",
        subject: "Physics",
        hours: 4,
        priority: "High",
        due: "2026-04-02"
    },
    {
        title: "Prepare Computer Science Slides",
        subject: "Computer Science",
        hours: 2.5,
        priority: "Medium",
        due: "2026-04-04"
    },
    {
        title: "Review Lecture Notes",
        subject: "History",
        hours: 1.5,
        priority: "Low",
        due: "2026-04-06"
    }
];

const priorityOrder = ["Urgent", "High", "Medium", "Low"];

function formatHours(hours) {
    return `${hours.toFixed(1)} hrs`;
}

function renderPriorities() {
    const board = document.getElementById("priority-board");

    board.innerHTML = priorityOrder.map((level) => {
        const group = tasks.filter((task) => task.priority === level);

        const cards = group.map((task) => `
            <article class="priority-task">
                <h4>${task.title}</h4>
                <p class="priority-meta">Estimated study time: ${formatHours(task.hours)}</p>
                <strong><span class="priority-tag">${task.priority}</span></strong>
            </article>
        `).join("");

        return `
            <section class="priority-column ${level.toLowerCase()}">
                <h3>${level}</h3>
                <div class="priority-stack">
                    ${cards || '<p class="priority-meta">No tasks in this priority yet.</p>'}
                </div>
            </section>
        `;
    }).join("");
}

function renderTaskCards() {
    const taskRow = document.getElementById("task-card-row");

    taskRow.innerHTML = tasks.map((task) => `
        <article class="task-card">
            <div class="icon-badge">${task.priority.slice(0, 2).toUpperCase()}</div>
            <h3>${task.title}</h3>
            <p class="task-meta">Due: ${task.due}</p>
            <p class="task-meta">Estimated study time: ${formatHours(task.hours)}</p>
            <span class="priority-tag">${task.priority}</span>
        </article>
    `).join("");
}

function renderStudyPlan() {
    const studyPlanGrid = document.getElementById("study-plan-grid");
    const orderedTasks = [...tasks].sort((a, b) => new Date(a.due) - new Date(b.due));

    studyPlanGrid.innerHTML = orderedTasks.map((task) => `
        <article class="study-plan-card">
            <p class="card-label">Recommended Task</p>
            <h3>${task.title}</h3>
            <p class="task-meta">Subject: ${task.subject}</p>
            <p class="task-meta">Recommended study time: ${formatHours(task.hours)}</p>
            <span class="priority-tag">${task.priority}</span>
        </article>
    `).join("");
}

function updateAnalytics() {
    const totalHours = tasks.reduce((sum, task) => sum + task.hours, 0);
    const averageHours = totalHours / tasks.length;

    document.getElementById("total-study-hours").textContent = formatHours(totalHours);
    document.getElementById("average-study-time").textContent = formatHours(averageHours);
    document.getElementById("planned-hours").textContent = formatHours(totalHours);
    document.getElementById("priority-count").textContent = `${tasks.length}`;
    document.getElementById("task-summary").textContent =
        `You have ${tasks.length} tasks scheduled across four urgency levels.`;
}

function addTask(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const title = document.getElementById("task-title").value.trim();
    const due = document.getElementById("task-date").value;
    const priority = document.getElementById("task-priority").value;
    const hours = Number(document.getElementById("task-hours").value);
    const subject = title.includes("Math") ? "Math" : title.includes("Physics") ? "Physics" : "General Study";

    if (!title || !due || !hours) {
        return;
    }

    tasks.unshift({ title, subject, due, priority, hours });

    renderDashboard();
    form.reset();
    document.getElementById("task-priority").value = "Medium";
    document.getElementById("task-hours").value = "1.5";
}

function renderDashboard() {
    renderStudyPlan();
    renderPriorities();
    renderTaskCards();
    updateAnalytics();
}

document.getElementById("task-form").addEventListener("submit", addTask);
renderDashboard();
