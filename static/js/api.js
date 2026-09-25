/**
 * API module - All HTTP calls to the Flask backend.
 */

const API_BASE = "";

async function api(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const config = {
        headers: { "Content-Type": "application/json" },
        ...options
    };
    if (options.body && typeof options.body === "object") {
        config.body = JSON.stringify(options.body);
    }
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        return { ok: response.ok, data, status: response.status };
    } catch (err) {
        return { ok: false, data: { error: err.message }, status: 0 };
    }
}

export const API = {
    init: () => api("/api/init"),
    concepts: () => api("/api/concepts"),
    studyRecommend: () => api("/api/study/recommend"),
    studyConcept: (conceptId) => api(`/api/study/concept/${conceptId}`),
    checkAnswer: (questionId, answer) => api("/api/check", {
        method: "POST",
        body: { question_id: questionId, answer }
    }),
    recordResults: (conceptId, results) => api("/api/record", {
        method: "POST",
        body: { concept_id: conceptId, results }
    }),
    mistakes: () => api("/api/mistakes"),
    importData: (data) => api("/api/import", { method: "POST", body: data }),
    importCurated: (data) => api("/api/import-curated", { method: "POST", body: data }),
    loadDemo: () => api("/api/load-demo", { method: "POST" }),
    checkEmpty: () => api("/api/check-empty"),
    bookletQuestions: () => api("/api/booklet"),
    mockQuestions: () => api("/api/mock"),
    gradeMock: (answers) => api("/api/mock/grade", {
        method: "POST",
        body: { answers }
    }),
    questionSources: () => api("/api/question-sources"),
    syncProgress: (sessions) => api("/api/sync-progress", {
        method: "POST",
        body: { sessions }
    }),
    exportProgress: () => api("/api/export-progress"),
    resetProgress: () => api("/api/reset-progress", { method: "POST" })
};
