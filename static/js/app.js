/**
 * App module - Application initialization and global state.
 */

import { API } from "./api.js";

document.addEventListener("DOMContentLoaded", async () => {
    const result = await API.init();
    if (result.ok) {
        const { is_demo, imported_count, question_sources, db_empty, question_count } = result.data;
        let status = `Server ready. ${imported_count} mistakes imported.`;
        if (db_empty) {
            status += " Database is empty — load demo data or import your mistakes.";
        } else {
            status += ` ${question_count} questions loaded.`;
        }
        showStatus(status, db_empty ? "warning" : "success");
    } else {
        showStatus("Server connection failed.", "danger");
    }

    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            window.setPage(btn.dataset.page);
        });
    });

    window.setPage("dashboard");
});

/**
 * Get a reference to the status text element.
 */
function showStatus(message, type = "info") {
    const el = document.getElementById("status-text");
    if (el) {
        el.textContent = message;
        el.className = `text-${type}`;
    }
}

// Expose showStatus globally (used by pages.js)
window.showStatus = showStatus;
