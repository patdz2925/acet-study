/**
 * Pages module - Renders each screen of the application.
 */

import { API } from "./api.js";

let currentPage = "dashboard";
let currentStudyData = null;
let currentPracticeQuestions = [];
let currentAnswers = {};
let currentConceptId = null;
let currentMockQuestions = [];
let currentMockAnswers = {};

export function setPage(name, preserveStudy) {
    currentPage = name;
    currentStudyData = null;
    currentPracticeQuestions = [];
    currentAnswers = {};
    currentMockQuestions = [];
    currentMockAnswers = {};
    // Only reset conceptId when navigating AWAY from study, or when explicitly not preserving
    if (name !== "study" || !preserveStudy) {
        currentConceptId = null;
    }
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === name);
    });
    renderPage();
}

export function showStatus(message, type = "info") {
    const el = document.getElementById("status-text");
    if (el) {
        el.textContent = message;
        el.className = `text-${type}`;
    }
}

function renderPage() {
    const main = document.getElementById("main-content");
    switch (currentPage) {
        case "dashboard": renderDashboard(main); break;
        case "mistakes": renderMistakes(main); break;
        case "study": renderStudy(main); break;
        case "mock": renderMock(main); break;
        case "concepts": renderConcepts(main); break;
        case "import": renderImport(main); break;
        default: renderDashboard(main);
    }
}

// ─── DASHBOARD ───────────────────────────────────────────────

async function renderDashboard(el) {
    el.innerHTML = '<div class="loading">Loading...</div>';
    let result = await API.concepts();
    if (!result.ok) {
        const detail = result.data && (result.data.error || result.data.message)
            ? escapeHtml(result.data.error || result.data.message)
            : `HTTP status ${result.status}`;
        el.innerHTML = `<div class="error-message">Failed to load data. (${detail}) Make sure the server is running, then refresh the page.</div>`;
        return;
    }
    let { concepts, stats } = result.data;

    // Auto-restore from localStorage if server was redeployed/empty of study sessions
    const totalPracticeOnServer = (stats || []).reduce((sum, s) => sum + (s.total_practice || 0), 0);
    if (totalPracticeOnServer === 0) {
        try {
            const localSessions = JSON.parse(localStorage.getItem("acet_study_sessions") || "[]");
            if (Array.isArray(localSessions) && localSessions.length > 0) {
                const syncRes = await API.syncProgress(localSessions);
                if (syncRes.ok && syncRes.data.restored_sessions > 0) {
                    showStatus(`Restored ${syncRes.data.restored_sessions} study sessions from browser storage!`, "success");
                    result = await API.concepts();
                    if (result.ok) {
                        concepts = result.data.concepts;
                        stats = result.data.stats;
                    }
                }
            }
        } catch (e) {
            console.warn("Could not auto-restore progress from localStorage", e);
        }
    }


    let html = `
        <div class="concept-header">
            <h1>ACET Study Dashboard</h1>
            <p>Your weakest concepts are at the top</p>
        </div>
    `;

    if (stats.length === 0) {
        html += `
            <div class="card">
                <h2>No data yet</h2>
                <p>Import your ACET mistakes to get started.</p>
                <div class="btn-group" style="margin-top:12px;">
                    <button class="btn btn-primary" onclick="setPage('import')">Import Mistakes</button>
                </div>
            </div>
        `;
    } else {
        html += '<div class="section-label">Recommended Study Order</div>';
        stats.forEach((s, i) => {
            const priorityClass = s.total_mistakes >= 3 ? "priority-high" : s.total_mistakes >= 1 ? "priority-medium" : "priority-low";
            const accuracyText = s.accuracy !== null ? `${Math.round(s.accuracy * 100)}%` : "Not practiced yet";
            html += `
                <div class="card" style="cursor:pointer;" onclick="studyConcept('${s.concept_id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong>${i + 1}. ${escapeHtml(s.concept_name)}</strong>
                            <div style="font-size:0.85rem;color:var(--text-light);">
                                ${s.total_mistakes} mistakes &bull; ${accuracyText} accuracy &bull; Last reviewed: ${s.last_reviewed || "Never"}
                            </div>
                        </div>
                        <span class="priority-badge ${priorityClass}">${s.total_mistakes} mistakes</span>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="section-label">Quick Actions</div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="setPage('study')">Study Now</button>
                <button class="btn btn-outline" onclick="setPage('mistakes')">View Mistakes (${stats.reduce((a,s) => a + s.total_mistakes, 0)})</button>
                <button class="btn btn-outline" onclick="setPage('concepts')">All Concepts</button>
            </div>
        `;
    }

    el.innerHTML = html;
}

// ─── MISTAKES ────────────────────────────────────────────────

async function renderMistakes(el) {
    el.innerHTML = '<div class="loading">Loading...</div>';
    const result = await API.mistakes();
    if (!result.ok) {
        const detail = result.data && (result.data.error || result.data.message)
            ? escapeHtml(result.data.error || result.data.message)
            : `HTTP status ${result.status}`;
        el.innerHTML = `<div class="error-message">Failed to load mistakes. (${detail}) Make sure the server is running, then refresh the page.</div>`;
        return;
    }
    const mistakes = result.data.mistakes;

    let html = `
        <div class="concept-header">
            <h1>Your Mistakes</h1>
            <p>${mistakes.length} recorded mistakes</p>
        </div>
    `;

    if (mistakes.length === 0) {
        html += '<div class="card"><p>No mistakes recorded yet. Import your ACET data to get started.</p></div>';
    } else {
        const grouped = {};
        mistakes.forEach(m => {
            const concept = m.concept || "Unknown";
            if (!grouped[concept]) grouped[concept] = [];
            grouped[concept].push(m);
        });

        for (const [concept, items] of Object.entries(grouped)) {
            html += `<h3 style="margin-top:16px;">${escapeHtml(concept)} (${items.length})</h3>`;
            items.forEach(m => {
                html += `
                    <div class="mistake-item">
                        <div class="mistake-header">
                            <span class="mistake-concept">${escapeHtml(m.concept)}</span>
                            <span class="source-label source-booklet">Original</span>
                        </div>
                        <div class="question-block">
                            <div style="margin-bottom:8px;">${escapeHtml(m.question_text || "No question text")}</div>
                            <div style="font-size:0.85rem;">
                                <span class="text-danger">Your answer: ${escapeHtml(m.your_answer || "N/A")}</span>
                                <span style="margin:0 8px;">→</span>
                                <span class="text-success">Correct: ${escapeHtml(m.correct_answer || "N/A")}</span>
                            </div>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-light);">Recorded: ${m.recorded_at || "Unknown"}</div>
                    </div>
                `;
            });
        }
    }

    el.innerHTML = html;
}

// ─── STUDY NOW ───────────────────────────────────────────────

async function renderStudy(el) {
    if (currentStudyData && currentPracticeQuestions.length > 0) {
        renderStudyInteractive(el);
        return;
    }

    el.innerHTML = '<div class="loading">Loading study recommendation...</div>';

    if (!currentConceptId) {
        const result = await API.studyRecommend();
        if (!result.ok || result.data.status !== "ok") {
            const detail = !result.ok
                ? ((result.data && (result.data.error || result.data.message)) || `HTTP status ${result.status}`)
                : (result.data?.message || "No concepts found.");
            el.innerHTML = `
                <div class="card">
                    <h2>Nothing to Study</h2>
                    <p>${escapeHtml(detail)}</p>
                    <button class="btn btn-primary" style="margin-top:12px;" onclick="setPage('import')">Import Mistakes</button>
                </div>
            `;
            return;
        }
        currentStudyData = result.data;
    } else {
        const result = await API.studyConcept(currentConceptId);
        if (!result.ok || result.data.status !== "ok") {
            const detail = !result.ok
                ? ((result.data && (result.data.error || result.data.message)) || `HTTP status ${result.status}`)
                : (result.data?.message || `Concept '${currentConceptId}' not found.`);
            el.innerHTML = `<div class="error-message">Failed to load concept. (${escapeHtml(detail)})</div>`;
            return;
        }
        currentStudyData = result.data;
    }

    currentPracticeQuestions = currentStudyData.practice_questions || [];
    currentAnswers = {};

    renderStudyInteractive(el);
}

function renderStudyInteractive(el) {
    const concept = currentStudyData.concept;
    const explanation = currentStudyData.explanation;
    const mistakes = currentStudyData.mistakes || [];
    const questions = currentPracticeQuestions;

    let html = `
        <div class="concept-header">
            <h1>Study: ${escapeHtml(concept.name)}</h1>
            <p>${escapeHtml(concept.id || "")}</p>
        </div>
    `;

    if (explanation) {
        html += `
            <div class="explanation-box">
                <h3>Concept Explanation</h3>
                <pre style="white-space:pre-wrap;font-family:inherit;line-height:1.6;">${escapeHtml(explanation)}</pre>
            </div>
        `;
    }

    if (mistakes.length > 0) {
        html += '<div class="section-label">Original ACET Questions You Got Wrong</div>';
        mistakes.forEach(m => {
            html += `
                <div class="question-block">
                    <div style="margin-bottom:4px;"><span class="source-label source-booklet">Original ACET</span></div>
                    <div style="margin-bottom:8px;">${escapeHtml(m.question_text || "No question text")}</div>
                    <div style="font-size:0.85rem;">
                        <span class="text-danger">Your answer: ${escapeHtml(m.your_answer || "N/A")}</span>
                        <span style="margin:0 8px;">→</span>
                        <span class="text-success">Correct: ${escapeHtml(m.correct_answer || "N/A")}</span>
                    </div>
                </div>
            `;
        });
    }

    html += '<div class="section-label">Practice Questions</div>';
    questions.forEach((q, index) => {
        const sourceClass = q.source === "template" ? "source-template" : q.source === "booklet" ? "source-booklet" : q.source === "curated" ? "source-curated" : "source-ai";
        const sourceLabel = q.source === "template" ? "Practice - Verified" : q.source === "booklet" ? "Original ACET" : q.source === "curated" ? "Practice - Curated" : "Practice - AI Draft";
        const instruction = getInstruction(q.concept, q.id);
        const keyWord = getKeyWord(q.id);
        const questionHtml = keyWord ? highlightKeyWord(q.question_text, keyWord) : escapeHtml(q.question_text);
        // Strip [Figure referenced...] prefix for cleaner display
        const cleanText = questionHtml.replace(/^\[.*?\]\s*/, '');
        // Check if this question references a figure
        const originalId = q.id.replace(/^BOOKLET-/, "");
        const hasFigure = FIGURE_QUESTIONS.has(originalId);
        const figureUrl = hasFigure ? `/static/img/${originalId}.png` : null;
        html += `
            <div class="card" id="practice-question-${index}" style="display:none;">
                <div style="margin-bottom:8px;">
                    <span class="source-label ${sourceClass}">${sourceLabel}</span>
                    <span style="font-size:0.8rem;color:var(--ink-subtle);"> Question ${index + 1} of ${questions.length}</span>
                </div>
                ${instruction ? `<div style="margin-bottom:10px;padding:10px 14px;background:var(--accent-wash);border:1px solid rgba(80,70,229,0.15);border-radius:var(--radius-sm);font-size:13px;color:var(--accent-strong);font-weight:500;">${escapeHtml(instruction)}</div>` : ''}
                ${hasFigure ? `<div style="margin-bottom:12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);overflow:hidden;"><img src="${figureUrl}" alt="Question figure" style="width:100%;display:block;"></div>` : ''}
                <div style="margin-bottom:12px;"><strong>${cleanText}</strong></div>
                <div id="choices-${index}"></div>
                <div id="feedback-${index}" style="margin-top:12px;display:none;"></div>
            </div>
        `;
    });

    html += `
        <div class="btn-group" style="margin-top:16px;">
            <button class="btn btn-primary" id="btn-start-study" onclick="startStudy()">Start Practice</button>
            <button class="btn btn-outline" onclick="setPage('concepts')">Change Concept</button>
            <button class="btn btn-outline" onclick="setPage('dashboard')">Dashboard</button>
        </div>
    `;

    el.innerHTML = html;

    questions.forEach((q, index) => {
        const container = document.getElementById(`choices-${index}`);
        if (container) {
            let choices;
            try {
                choices = typeof q.choices === "string" ? JSON.parse(q.choices) : q.choices;
                // Handle double-encoded: if still a string after first parse, parse again
                if (typeof choices === "string") choices = JSON.parse(choices);
            } catch (e) {
                choices = [];
            }
            if (!Array.isArray(choices)) choices = [];
            let choicesHtml = "";
            choices.forEach((choice, ci) => {
                const letter = String.fromCharCode(65 + ci);
                choicesHtml += `
                    <div class="answer-option" data-index="${index}" data-letter="${letter}" onclick="selectAnswer(${index}, '${letter}', this)">
                        <span class="answer-letter">${letter}</span>
                        <span>${escapeHtml(choice)}</span>
                    </div>
                `;
            });
            container.innerHTML = choicesHtml;
        }
    });
}

function startStudy() {
    currentPracticeQuestions.forEach((q, index) => {
        const el = document.getElementById(`practice-question-${index}`);
        if (el) el.style.display = "block";
    });
    const btn = document.getElementById("btn-start-study");
    if (btn) btn.style.display = "none";
    showStatus("Answer all 3 questions, then click Submit All Answers.", "info");

    const navGroup = document.querySelector(".btn-group");
    if (navGroup && !document.getElementById("btn-submit-study")) {
        const submitBtn = document.createElement("button");
        submitBtn.className = "btn btn-success";
        submitBtn.id = "btn-submit-study";
        submitBtn.textContent = "Submit All Answers";
        submitBtn.onclick = function() { submitStudyResults(); };
        navGroup.appendChild(submitBtn);
    }
}

function submitStudyResults() {
    const unanswered = [];
    currentPracticeQuestions.forEach((q, i) => {
        if (!currentAnswers[i]) unanswered.push(i + 1);
    });
    if (unanswered.length > 0) {
        showStatus(`Please answer all questions. Missing: ${unanswered.join(", ")}`, "warning");
        return;
    }

    const results = currentPracticeQuestions.map((q, i) => ({
        question_id: q.id,
        correct: currentAnswers[i] === q.correct_answer,
        concept: currentStudyData.concept.id,
        source: q.source
    }));

    const conceptId = currentStudyData.concept.id;
    const questions = currentPracticeQuestions;
    const answers = currentAnswers;

    API.recordResults(conceptId, results).then(recordResult => {
        if (recordResult.ok) {
            const summary = recordResult.data.summary;
            // Save to localStorage for client-side persistence across redeploys
            saveSessionToLocalStorage({
                concept: conceptId,
                concept_id: conceptId,
                study_date: summary.study_date || new Date().toISOString().replace("T", " ").substring(0, 19),
                questions_answered: results.length,
                correct: summary.correct,
                incorrect: summary.incorrect
            });
            showStudyResultsSummary(conceptId, questions, answers, summary);
        } else {
            showStatus("Failed to record results.", "danger");
        }
    });
}

function saveSessionToLocalStorage(sessionData) {
    try {
        const stored = JSON.parse(localStorage.getItem("acet_study_sessions") || "[]");
        stored.push(sessionData);
        localStorage.setItem("acet_study_sessions", JSON.stringify(stored));
    } catch (e) {
        console.warn("Could not save to localStorage", e);
    }
}


function showStudyResultsSummary(conceptId, questions, answers, summary) {
    const main = document.getElementById("main-content");
    let html = `
        <div class="concept-header">
            <h1>Study Complete</h1>
            <p>${summary.correct} of ${summary.total} correct (${Math.round(summary.accuracy * 100)}%)</p>
        </div>
    `;

    questions.forEach((q, i) => {
        const wasCorrect = answers[i] === q.correct_answer;
        const sourceClass = q.source === "template" ? "source-template" : q.source === "booklet" ? "source-booklet" : q.source === "curated" ? "source-curated" : "source-ai";
        const sourceLabel = q.source === "template" ? "Practice - Verified" : q.source === "booklet" ? "Original ACET" : q.source === "curated" ? "Practice - Curated" : "Practice - AI Draft";
        const instruction = getInstruction(q.concept, q.id);

        html += `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="source-label ${sourceClass}">${sourceLabel}</span>
                    <span class="${wasCorrect ? 'text-success' : 'text-danger'}">
                        ${wasCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                </div>
                ${instruction ? `<div style="margin:8px 0;font-size:12px;color:var(--accent-strong);">${escapeHtml(instruction)}</div>` : ''}
                <div style="margin-top:8px;">${escapeHtml(q.question_text)}</div>
                <div style="margin-top:4px;font-size:0.85rem;">
                    You answered: <strong>${escapeHtml(answers[i] || "N/A")}</strong>
                    ${!wasCorrect ? ` → Correct: <strong>${escapeHtml(q.correct_answer)}</strong>` : ''}
                </div>
            </div>
        `;
    });

    html += `
        <div class="section-label">What's Next</div>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="loadNextConcept()">Study Next Concept</button>
            <button class="btn btn-outline" onclick="setPage('concepts')">View All Concepts</button>
            <button class="btn btn-outline" onclick="setPage('dashboard')">Dashboard</button>
        </div>
    `;

    main.innerHTML = html;
    showStatus(`Study complete! ${summary.correct}/${summary.total} correct.`, "success");
}

// ─── FULL MOCK TEST ──────────────────────────────────────────

function parseMockChoices(q) {
    let choices;
    try {
        choices = typeof q.choices === "string" ? JSON.parse(q.choices) : q.choices;
        if (typeof choices === "string") choices = JSON.parse(choices);
    } catch (e) {
        choices = [];
    }
    return Array.isArray(choices) ? choices : [];
}

async function renderMock(el) {
    el.innerHTML = '<div class="loading">Loading full mock test...</div>';
    const result = await API.mockQuestions();
    if (!result.ok || result.data.status !== "ok" || !result.data.questions.length) {
        el.innerHTML = `<div class="error-message">No mock questions available. Import mistakes first.</div>`;
        return;
    }
    currentMockQuestions = result.data.questions;
    currentMockAnswers = {};

    let html = `
        <div class="concept-header">
            <h1>Full Mock Test</h1>
            <p>${currentMockQuestions.length} original ACET questions • answer all, then submit</p>
        </div>
    `;
    currentMockQuestions.forEach((q, index) => {
        const choices = parseMockChoices(q);
        const instruction = getInstruction(q.concept, q.id);
        const keyWord = getKeyWord(q.id);
        const questionHtml = keyWord ? highlightKeyWord(q.question_text, keyWord) : escapeHtml(q.question_text);
        const cleanText = questionHtml.replace(/^\[.*?\]\s*/, '');
        const hasFigure = FIGURE_QUESTIONS.has(q.id);
        const figureUrl = hasFigure ? `/static/img/${q.id}.png` : null;
        let choicesHtml = "";
        choices.forEach((choice, ci) => {
            const letter = String.fromCharCode(65 + ci);
            choicesHtml += `
                <div class="answer-option" data-index="${index}" data-letter="${letter}" onclick="selectMockAnswer(${index}, '${letter}', this)">
                    <span class="answer-letter">${letter}</span>
                    <span>${escapeHtml(choice)}</span>
                </div>
            `;
        });
        html += `
            <div class="card" id="mock-question-${index}">
                <div style="margin-bottom:8px;">
                    <span class="source-label source-booklet">Original ACET</span>
                    <span style="font-size:0.8rem;color:var(--ink-subtle);"> Question ${index + 1} of ${currentMockQuestions.length} • ${escapeHtml(q.section || "")}</span>
                </div>
                ${instruction ? `<div style="margin-bottom:10px;padding:10px 14px;background:var(--accent-wash);border:1px solid rgba(80,70,229,0.15);border-radius:var(--radius-sm);font-size:13px;color:var(--accent-strong);font-weight:500;">${escapeHtml(instruction)}</div>` : ''}
                ${hasFigure ? `<div style="margin-bottom:12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);overflow:hidden;"><img src="${figureUrl}" alt="Question figure" style="width:100%;display:block;"></div>` : ''}
                <div style="margin-bottom:12px;"><strong>${cleanText}</strong></div>
                <div>${choicesHtml}</div>
            </div>
        `;
    });
    html += `
        <div class="btn-group" style="margin-top:16px;">
            <button class="btn btn-success" onclick="submitMock()">Submit Mock Test</button>
            <button class="btn btn-outline" onclick="setPage('dashboard')">Dashboard</button>
        </div>
    `;
    el.innerHTML = html;
    showStatus(`Mock loaded: ${currentMockQuestions.length} questions. No feedback until you submit.`, "info");
}

window.selectMockAnswer = function(questionIndex, letter, element) {
    currentMockAnswers[questionIndex] = letter;
    const optionElements = element.parentElement.querySelectorAll(".answer-option");
    optionElements.forEach(opt => opt.classList.remove("selected"));
    element.classList.add("selected");
};

window.submitMock = async function() {
    const unanswered = [];
    currentMockQuestions.forEach((q, i) => {
        if (!currentMockAnswers[i]) unanswered.push(i + 1);
    });
    if (unanswered.length > 0) {
        const shown = unanswered.slice(0, 20).join(", ") + (unanswered.length > 20 ? ` (+${unanswered.length - 20} more)` : "");
        showStatus(`Please answer all questions. Missing: ${shown}`, "warning");
        return;
    }
    const answers = {};
    currentMockQuestions.forEach((q, i) => { answers[q.id] = currentMockAnswers[i]; });
    showStatus("Grading mock test...", "info");
    const result = await API.gradeMock(answers);
    if (!result.ok || result.data.status !== "ok") {
        showStatus("Failed to grade mock test.", "danger");
        return;
    }
    const data = result.data;
    // Mirror per-concept results to localStorage (server already recorded sessions)
    try {
        const byConcept = {};
        (data.per_question || []).forEach(p => {
            const b = byConcept[p.concept] = byConcept[p.concept] || { answered: 0, correct: 0 };
            b.answered += 1;
            if (p.correct) b.correct += 1;
        });
        Object.entries(byConcept).forEach(([concept, b]) => {
            saveSessionToLocalStorage({
                concept,
                concept_id: concept,
                study_date: new Date().toISOString().replace("T", " ").substring(0, 19),
                questions_answered: b.answered,
                correct: b.correct,
                incorrect: b.answered - b.correct
            });
        });
    } catch (e) {
        console.warn("Could not save mock to localStorage", e);
    }
    renderMockResults(data);
};

function renderMockResults(data) {
    const main = document.getElementById("main-content");
    const pct = Math.round(data.accuracy * 100);
    let html = `
        <div class="concept-header">
            <h1>Mock Complete: ${data.correct} / ${data.total} (${pct}%)</h1>
            <p>Per-section breakdown below, then full answer review</p>
        </div>
        <div class="card">
            <h3>Score by Section</h3>
            ${Object.entries(data.sections || {}).map(([section, s]) =>
                `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);">
                    <span>${escapeHtml(section)}</span>
                    <strong>${s.correct} / ${s.answered}</strong>
                </div>`
            ).join("")}
        </div>
        <div class="section-label">Answer Review</div>
    `;
    const byId = {};
    currentMockQuestions.forEach(q => { byId[q.id] = q; });
    (data.per_question || []).forEach((p, i) => {
        const q = byId[p.question_id] || {};
        html += `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="source-label source-booklet">Q${i + 1} • ${escapeHtml(p.section || "")}</span>
                    <span class="${p.correct ? 'text-success' : 'text-danger'}">${p.correct ? '✓ Correct' : '✗ Incorrect'}</span>
                </div>
                <div style="margin-top:8px;">${escapeHtml(q.question_text || p.question_id)}</div>
                <div style="margin-top:4px;font-size:0.85rem;">
                    You answered: <strong>${escapeHtml(p.chosen_answer)}</strong>
                    ${!p.correct ? ` → Correct: <strong>${escapeHtml(String(p.correct_answer))}</strong>` : ''}
                </div>
            </div>
        `;
    });
    html += `
        <div class="btn-group" style="margin-top:16px;">
            <button class="btn btn-primary" onclick="setPage('mock')">Retake Mock</button>
            <button class="btn btn-outline" onclick="setPage('dashboard')">Dashboard</button>
        </div>
    `;
    main.innerHTML = html;
    showStatus(`Mock complete! ${data.correct}/${data.total} correct (${pct}%).`, "success");
};

// ─── CONCEPTS ────────────────────────────────────────────────

async function renderConcepts(el) {
    el.innerHTML = '<div class="loading">Loading concepts...</div>';
    const result = await API.concepts();
    if (!result.ok) {
        const detail = result.data && (result.data.error || result.data.message)
            ? escapeHtml(result.data.error || result.data.message)
            : `HTTP status ${result.status}`;
        el.innerHTML = `<div class="error-message">Failed to load concepts. (${detail}) Make sure the server is running, then refresh the page.</div>`;
        return;
    }
    const { concepts, stats } = result.data;

    let html = `
        <div class="concept-header">
            <h1>Concepts</h1>
            <p>${concepts.length} concepts tracked</p>
        </div>
    `;

    concepts.forEach(c => {
        const stat = stats.find(s => s.concept_id === c.id) || {};
        const accuracy = stat.accuracy !== null ? Math.round(stat.accuracy * 100) + "%" : "Not practiced";
        html += `
            <div class="card">
                <h3>${escapeHtml(c.name)}</h3>
                <div style="font-size:0.85rem;color:var(--text-light);margin-bottom:8px;">
                    Mistakes: ${stat.total_mistakes || 0} &bull; Accuracy: ${accuracy} &bull; Practice: ${stat.total_practice || 0}
                </div>
                <button class="btn btn-sm btn-primary" onclick="studyConcept('${c.id}')">Study This Concept</button>
            </div>
        `;
    });

    el.innerHTML = html;
}

// ─── IMPORT ──────────────────────────────────────────────────

function renderImport(el) {
    el.innerHTML = `
        <div class="concept-header">
            <h1>Import Data</h1>
            <p>Import your ACET mistakes</p>
        </div>
        <div class="card">
            <h2>Import Mistakes</h2>
            <div class="form-group">
                <label for="import-data">Paste your mistakes.json here</label>
                <textarea id="import-data" placeholder='{"demo": false, "mistakes": [...]}'></textarea>
            </div>
            <button class="btn btn-primary" onclick="doImport()">Import Mistakes</button>
        </div>
        <div class="card">
            <h2>Import Curated Questions</h2>
            <div class="form-group">
                <label for="curated-data">Paste curated_questions.json here</label>
                <textarea id="curated-data" placeholder='{"questions": [...]}'></textarea>
            </div>
            <button class="btn btn-primary" onclick="doImportCurated()">Import Questions</button>
        </div>
        <div class="card">
            <h2>Demo Data</h2>
            <p>Use demo data to test the system. Replace with your real ACET mistakes later.</p>
            <button class="btn btn-outline" onclick="loadDemo()">Load Demo Data</button>
        </div>
        <div class="card">
            <h2>Study Progress & Backup</h2>
            <p>Your study history is automatically preserved locally in this browser. You can also download a backup file or transfer your progress to another device.</p>
            <div class="btn-group" style="margin-top:12px;gap:8px;display:flex;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="exportProgress()">📥 Export Backup (JSON)</button>
                <label class="btn btn-outline" style="cursor:pointer;margin-bottom:0;display:inline-flex;align-items:center;">
                    📤 Restore Backup (JSON)
                    <input type="file" id="restore-progress-file" accept=".json" style="display:none;" onchange="restoreProgressFile(event)">
                </label>
                <button class="btn btn-outline" style="color:var(--text-danger, #ef4444);" onclick="resetLocalProgress()">Reset Progress</button>
            </div>
            <div id="backup-status" style="margin-top:10px;"></div>
        </div>
        <div id="import-result" style="margin-top:16px;"></div>
    `;
}

// ─── PUBLIC FUNCTIONS (called by onclick) ──────────────────

window.setPage = setPage;
window.startStudy = startStudy;
window.submitStudyResults = submitStudyResults;
window.studyConcept = async function(conceptId) {
    currentConceptId = conceptId;
    currentStudyData = null;
    currentPracticeQuestions = [];
    currentAnswers = {};
    setPage("study", true);
};

window.doImport = async function() {
    const textarea = document.getElementById("import-data");
    const resultEl = document.getElementById("import-result");
    if (!textarea || !textarea.value.trim()) {
        resultEl.innerHTML = '<div class="error-message">Please paste JSON data first.</div>';
        return;
    }
    try {
        const data = JSON.parse(textarea.value);
        const result = await API.importData(data);
        if (result.ok && result.data.success) {
            resultEl.innerHTML = `<div class="success-message">Imported ${result.data.imported} mistakes across ${result.data.concepts} concepts!</div>`;
            showStatus(`Imported ${result.data.imported} mistakes`, "success");
        } else {
            resultEl.innerHTML = `<div class="error-message">Error: ${result.data.error || "Unknown error"}</div>`;
            if (result.data.details) {
                resultEl.innerHTML += `<pre style="margin-top:8px;font-size:0.8rem;">${escapeHtml(JSON.stringify(result.data.details, null, 2))}</pre>`;
            }
        }
    } catch (e) {
        resultEl.innerHTML = `<div class="error-message">Invalid JSON: ${e.message}</div>`;
    }
};

window.doImportCurated = async function() {
    const textarea = document.getElementById("curated-data");
    const resultEl = document.getElementById("import-result");
    if (!textarea || !textarea.value.trim()) {
        resultEl.innerHTML = '<div class="error-message">Please paste JSON data first.</div>';
        return;
    }
    try {
        const data = JSON.parse(textarea.value);
        const result = await API.importCurated(data);
        if (result.ok && result.data.success) {
            resultEl.innerHTML = `<div class="success-message">Imported ${result.data.imported} curated questions!</div>`;
        } else {
            resultEl.innerHTML = `<div class="error-message">Error: ${result.data.error || "Unknown error"}</div>`;
        }
    } catch (e) {
        resultEl.innerHTML = `<div class="error-message">Invalid JSON: ${e.message}</div>`;
    }
};

window.loadDemo = async function() {
    const resultEl = document.getElementById("import-result");
    try {
        const result = await API.loadDemo();
        if (result.ok && result.data.success) {
            resultEl.innerHTML = `<div class="success-message">Demo data loaded! ${result.data.imported} mistakes imported.</div>`;
            showStatus("Demo data loaded", "success");
            // Refresh dashboard
            const conceptsResult = await API.concepts();
            if (conceptsResult.ok && conceptsResult.data.stats.length > 0) {
                setPage("dashboard");
            }
        } else {
            const detail = result.data && (result.data.error || result.data.message)
                ? result.data.error || result.data.message
                : `HTTP status ${result.status}`;
            resultEl.innerHTML = `<div class="error-message">Error: ${escapeHtml(detail)}</div>`;
        }
    } catch (e) {
        resultEl.innerHTML = `<div class="error-message">Error: ${escapeHtml(e.message)} (is the server running?)</div>`;
    }
};

window.exportProgress = async function() {
    try {
        const result = await API.exportProgress();
        const localSessions = JSON.parse(localStorage.getItem("acet_study_sessions") || "[]");
        const exportData = {
            export_date: new Date().toISOString(),
            app: "ACET Adaptive Study System",
            server_sessions: result.ok ? result.data.sessions : [],
            local_sessions: localSessions,
            stats: result.ok ? result.data.stats : []
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `acet_study_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus("Study progress backup exported successfully!", "success");
    } catch (e) {
        showStatus("Export failed: " + e.message, "danger");
    }
};

window.restoreProgressFile = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const sessions = data.local_sessions || data.sessions || (Array.isArray(data) ? data : []);
            if (!Array.isArray(sessions) || sessions.length === 0) {
                alert("No valid study sessions found in the selected backup file.");
                return;
            }
            localStorage.setItem("acet_study_sessions", JSON.stringify(sessions));
            const syncRes = await API.syncProgress(sessions);
            if (syncRes.ok) {
                alert(`Successfully restored ${syncRes.data.restored_sessions || sessions.length} study sessions!`);
                setPage("dashboard");
            } else {
                alert("Progress saved locally, but server sync reported: " + (syncRes.data?.message || "unknown error"));
                setPage("dashboard");
            }
        } catch (err) {
            alert("Error parsing backup file: " + err.message);
        }
    };
    reader.readAsText(file);
};

window.resetLocalProgress = async function() {
    if (!confirm("Are you sure you want to reset your study progress? This clears your test history so you can start fresh.")) {
        return;
    }
    localStorage.removeItem("acet_study_sessions");
    await API.resetProgress();
    showStatus("Study progress reset successfully.", "info");
    setPage("dashboard");
};

window.loadNextConcept = async function() {
    const result = await API.studyRecommend();
    if (result.ok && result.data.status === "ok") {
        currentStudyData = result.data;
        currentPracticeQuestions = result.data.practice_questions || [];
        currentAnswers = {};
        setPage("study");
    } else {
        setPage("dashboard");
    }
};

// Called from onclick in HTML
window.selectAnswer = function(questionIndex, letter, element) {
    const q = currentPracticeQuestions[questionIndex];
    if (!q || currentAnswers[questionIndex]) return;

    currentAnswers[questionIndex] = letter;

    const optionElements = element.parentElement.querySelectorAll(".answer-option");
    optionElements.forEach(opt => opt.style.pointerEvents = "none");

    element.classList.add("selected");

    const isCorrect = letter === q.correct_answer;
    const feedbackEl = document.getElementById(`feedback-${questionIndex}`);
    if (feedbackEl) {
        feedbackEl.style.display = "block";
        if (isCorrect) {
            element.classList.add("correct");
            feedbackEl.innerHTML = '<span class="text-success text-info">Correct!</span>';
        } else {
            element.classList.add("incorrect");
            optionElements.forEach(opt => {
                const letterSpan = opt.querySelector(".answer-letter");
                if (letterSpan && letterSpan.textContent === q.correct_answer) {
                    opt.classList.add("correct");
                }
            });
            feedbackEl.innerHTML = `<span class="text-danger">Incorrect. Correct answer: ${escapeHtml(q.correct_answer)}</span>`;
        }
    }

    showStatus(isCorrect ? "Correct!" : `Incorrect. Correct answer: ${q.correct_answer}`, isCorrect ? "success" : "danger");
};

// Instructions based on concept type
const CONCEPT_INSTRUCTIONS = {
    // Language Proficiency
    "lp_vocabulary_antonyms": "Find the word most nearly OPPOSITE in meaning to the underlined word.",
    "lp_vocabulary_synonyms": "Find the word most nearly ALIKE in meaning to the underlined word.",
    "lp_error_identification": "One part of the sentence below is underlined. Identify the part that is grammatically incorrect.",
    "lp_sentence_completion": "Choose the word that best completes the sentence.",
    "lp_improving_sentences": "Choose the best way to rewrite the underlined part of the sentence.",
    "lp_improving_paragraphs": "Read the paragraph and choose the best answer for the question.",
    "lp_paragraph_arrangement": "Arrange the sentences to form a coherent paragraph.",
    // Verbal Analogy
    "analogy_antonyms": "Complete the analogy. The second pair has an opposite relationship.",
    "analogy_synonyms": "Complete the analogy. The second pair has a similar relationship.",
    "analogy_categories": "Complete the analogy. The second word belongs to the same category as the first.",
    "analogy_professions": "Complete the analogy. The second professional works with the body part named.",
    "analogy_pairs_opposites": "Complete the analogy. The second pair are opposites.",
    "analogy_function": "Complete the analogy. The second word serves the same function.",
    "analogy_action_object": "Complete the analogy. The second word is the object of the action.",
    "analogy_source_product": "Complete the analogy. The second word is produced by the first.",
    "analogy_problem_solution": "Complete the analogy. The second word is a solution to the problem named.",
    "analogy_word_partnerships": "Complete the analogy. The words form a common partnership.",
    "analogy_capital_country": "Complete the analogy. The second word is the capital of the country.",
    "analogy_definition_match": "Complete the analogy. The second word matches the definition of the first.",
    // Reading Comprehension
    "rc_comparing_viewpoints": "Read the passage(s) carefully. Choose the best answer based on the text.",
    "rc_inferring_purpose": "Read the passage carefully. Infer the author's purpose or intent.",
    "rc_factual_recall": "Read the passage carefully. Choose the answer that is stated in the text.",
    "rc_cause_effect": "Read the passage carefully. Identify the cause-and-effect relationship.",
    "rc_detail_recall": "Read the passage carefully. Choose the answer that matches a specific detail.",
    "rc_authors_purpose": "Read the passage carefully. Determine why the author wrote this.",
    "rc_argument_analysis": "Read the passage carefully. Analyze the argument presented.",
    "rc_comparing_passages": "Read both passages carefully. Compare the information or viewpoints.",
    // Numerical Ability
    "weighted_average": "Solve the problem. Show your work.",
    "probability": "Calculate the probability. Express your answer clearly.",
    "speed_distance_time": "Use the formula: Distance = Speed × Time. Solve for the unknown.",
    "mixture_problems": "Set up an equation based on the mixture components. Solve for the unknown.",
    "compound_interest": "Use the compound interest formula: A = P(1 + r/n)^(nt).",
    "set_theory": "Apply set theory principles. Draw a Venn diagram if helpful.",
    "probability_dice": "Count the favorable outcomes and total outcomes. Calculate the probability.",
    "work_problems": "Use the work formula: Rate × Time = Work. Combine rates for multiple workers.",
    "percentage_increase": "Calculate the percentage increase using: (New - Old) / Old × 100%.",
    "successive_discounts": "Apply discounts one after another. Each discount applies to the new price.",
    "systems_of_equations": "Set up and solve the system of equations.",
    "speed_boat_current": "Use: Upstream speed = Boat speed - Current speed. Downstream = Boat + Current.",
    "proportional_reasoning": "Set up a proportion and solve for the unknown.",
    "combinatorics": "Count the arrangements or combinations. Consider order if applicable.",
    "probability_coins": "List all possible outcomes. Count favorable outcomes.",
    // Mathematics
    "percentages": "Set up the percentage equation and solve.",
    "ratios": "Set up the ratio and solve for the unknown.",
    "fractions": "Find a common denominator if needed. Simplify your answer.",
    "averages": "Use: Average = Sum of values / Number of values.",
    "basic_algebra": "Isolate the variable. Show your steps.",
    "linear_equations": "Solve for the variable. Check your answer.",
    "quadratic_equations": "Factor or use the quadratic formula: x = (-b ± √(b²-4ac)) / 2a.",
    "exponent_rules": "Apply the exponent rules: a^m × a^n = a^(m+n), (a^m)^n = a^(mn).",
    "surds_radicals": "Simplify the radical. Rationalize the denominator if needed.",
    "sequences_series": "Identify the pattern. Use the appropriate formula.",
    "functions_graphs": "Analyze the function. Consider domain, range, and key features.",
    "function_graphs": "Analyze the graph. Identify key features like intercepts and slopes.",
    "composite_functions": "Substitute the inner function into the outer function.",
    "circle_geometry": "Apply circle theorems. Use πr² for area, 2πr for circumference.",
    "circle_area": "Use A = πr². Identify the radius from the given information.",
    "circle_equation_line": "Use the circle equation: (x-h)² + (y-k)² = r².",
    "circle_in_square": "Relate the circle's diameter to the square's side length.",
    "pythagorean_theorem": "Use a² + b² = c². Identify the hypotenuse.",
    "trapezoid_area": "Use A = ½(a+b)h where a and b are the parallel sides.",
    "quadrilateral_area": "Break the shape into simpler shapes or use the appropriate formula.",
    "rhombus_diagonals": "Use A = ½d₁d₂ where d₁ and d₂ are the diagonals.",
    "polygon_interior_angles": "Use: Sum of interior angles = (n-2) × 180°.",
    "standard_deviation": "Calculate the mean, then find the square root of the average squared differences.",
    "inverse_proportion": "Use: x₁y₁ = x₂y₂. As one increases, the other decreases.",
    "cube_diagonal": "Use the space diagonal formula: d = s√3.",
    "average_speed": "Use: Average speed = Total distance / Total time.",
    "perpendicular_slope": "The perpendicular slope is the negative reciprocal: m₂ = -1/m₁.",
    "algebraic_fractions": "Simplify by factoring. Cancel common terms.",
    "algebraic_manipulation": "Expand, factor, or rearrange as needed.",
    "domain_expression": "Find values that make the expression undefined (division by zero, negative square roots).",
    "equations_infinite_solutions": "For infinite solutions, the equation must be an identity.",
    "basic_arithmetic": "Perform the calculation step by step.",
    "number_theory": "Apply number theory principles (divisibility, primes, etc.).",
};

// Key words from original ACET questions (maps question_id to the underlined word)
const QUESTION_KEY_WORDS = {
    "LA-Q33": "applauded", "LA-Q34": "phlegmatic", "LA-Q35": "proletarian",
    "LA-Q37": "eminent", "LA-Q38": "redoubtable", "LA-Q39": "profligate",
    "LA-Q21": "acquiesce", "LA-Q23": "perfunctory", "LA-Q24": "ambivalent",
    "LA-Q29": "disseminate", "LA-Q30": "pragmatic",
};

// Questions that reference figures/diagrams — show the PDF page image
const FIGURE_QUESTIONS = new Set(["MA-Q98", "MA-Q100", "MA-Q111"]);

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function getInstruction(conceptId, questionId) {
    if (CONCEPT_INSTRUCTIONS[conceptId]) return CONCEPT_INSTRUCTIONS[conceptId];
    // Fallback: infer from concept name
    if (conceptId && conceptId.includes("antonym")) return CONCEPT_INSTRUCTIONS["lp_vocabulary_antonyms"];
    if (conceptId && conceptId.includes("synonym")) return CONCEPT_INSTRUCTIONS["lp_vocabulary_synonyms"];
    if (conceptId && conceptId.includes("error")) return CONCEPT_INSTRUCTIONS["lp_error_identification"];
    if (conceptId && conceptId.includes("complet")) return CONCEPT_INSTRUCTIONS["lp_sentence_completion"];
    if (conceptId && conceptId.includes("improv")) return CONCEPT_INSTRUCTIONS["lp_improving_sentences"];
    return "";
}

function getKeyWord(questionId) {
    if (!questionId) return null;
    // Try exact match first, then strip BOOKLET- prefix
    if (QUESTION_KEY_WORDS[questionId]) return QUESTION_KEY_WORDS[questionId];
    const stripped = questionId.replace(/^BOOKLET-/, "");
    return QUESTION_KEY_WORDS[stripped] || null;
}

function highlightKeyWord(sentence, keyWord) {
    if (!keyWord || !sentence) return escapeHtml(sentence);
    // Case-insensitive replace the key word with underlined version
    const escaped = escapeHtml(sentence);
    const regex = new RegExp(`\\b(${keyWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, "i");
    return escaped.replace(regex, '<u style="text-decoration-color:var(--accent);text-underline-offset:3px;font-weight:600;">$1</u>');
}
