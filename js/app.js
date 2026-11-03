const STORAGE_KEY = "finpathState";

const defaultState = {
  user: null,
  assessments: [],
  latestPrediction: null,
  recommendations: []
};

function getState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...defaultState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[character]));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function showToast(message, type = "success") {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}"></i><span>${escapeHtml(message)}</span>`;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function showModal({ title, message, confirmLabel = "Continue", cancelLabel = "Close", onConfirm, danger = false }) {
  const existing = document.querySelector(".app-modal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.className = "app-modal";
  modal.innerHTML = `<div class="modal-backdrop" data-close-modal></div><section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><button class="modal-close" type="button" aria-label="Close" data-close-modal><i class="fa-solid fa-xmark"></i></button><div class="modal-icon ${danger ? "modal-icon-danger" : ""}"><i class="fa-solid ${danger ? "fa-right-from-bracket" : "fa-circle-info"}"></i></div><h2 id="modalTitle">${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="modal-actions"><button type="button" class="btn-outline" data-close-modal>${escapeHtml(cancelLabel)}</button><button type="button" class="btn-primary ${danger ? "btn-danger" : ""}" data-confirm-modal>${escapeHtml(confirmLabel)}</button></div></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close-modal]").forEach(element => element.addEventListener("click", close));
  modal.querySelector("[data-confirm-modal]").addEventListener("click", () => {
    if (onConfirm) onConfirm();
    close();
  });
  modal.querySelector(".modal-close").focus();
}

function setupNavigation() {
  const nav = document.querySelector(".nav-container");
  const links = document.querySelector(".nav-links");
  if (!nav || !links) return;
  const toggle = document.createElement("button");
  toggle.className = "mobile-menu-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open navigation");
  toggle.innerHTML = "<i class=\"fa-solid fa-bars\"></i>";
  nav.insertBefore(toggle, nav.querySelector("nav"));
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.innerHTML = `<i class="fa-solid ${open ? "fa-xmark" : "fa-bars"}"></i>`;
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  links.querySelectorAll("a").forEach(link => link.addEventListener("click", () => links.classList.remove("is-open")));
}

function setupLogout() {
  document.querySelectorAll("#logoutBtn").forEach(button => button.addEventListener("click", () => {
    showModal({
      title: "Sign out of FINPATH?",
      message: "Your saved assessment history will remain on this device, but you will return to the public landing page.",
      confirmLabel: "Sign out",
      danger: true,
      onConfirm: () => {
        const state = getState();
        state.user = null;
        saveState(state);
        window.location.href = "index.html";
      }
    });
  }));
}

function bindFormMessage(element, message, type = "error") {
  if (!element) return;
  element.textContent = message;
  element.className = `${type === "success" ? "success-message" : "error-message"} is-visible`;
}

function setupAuth() {
  const loginForm = document.querySelector("#loginForm");
  const registerForm = document.querySelector("#registerForm");
  if (registerForm) registerForm.addEventListener("submit", event => {
    event.preventDefault();
    const name = document.querySelector("#fullName").value.trim();
    const email = document.querySelector("#email").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    const confirm = document.querySelector("#confirmPassword").value;
    const message = document.querySelector("#authErrorMessage");
    if (password.length < 6) return bindFormMessage(message, "Use at least six characters for your password.");
    if (password !== confirm) return bindFormMessage(message, "The passwords do not match.");
    const state = getState();
    state.user = { name, email, role: "User" };
    saveState(state);
    bindFormMessage(message, "Account created. Taking you to your dashboard.", "success");
    window.setTimeout(() => window.location.href = "dashboard.html", 650);
  });
  if (loginForm) loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim().toLowerCase();
    const message = document.querySelector("#authErrorMessage");
    const state = getState();
    state.user = { name: email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()), email, role: "User" };
    saveState(state);
    bindFormMessage(message, "Signed in successfully. Loading your workspace.", "success");
    window.setTimeout(() => window.location.href = "dashboard.html", 650);
  });
}

function calculateAssessment(values) {
  const income = Number(values.monthlyIncome);
  const expenses = Number(values.monthlyExpenses);
  const savings = Number(values.savingsBalance);
  const loans = Number(values.existingLoans);
  const ratio = income ? (expenses + loans) / income : 1;
  let score = 78;
  score -= Math.min(38, Math.round(ratio * 34));
  score += Math.min(15, Math.round((savings / Math.max(income, 1)) * 12));
  if (values.employmentStatus === "unemployed") score -= 12;
  if (values.mobileMoneyUsage === "rarely") score -= 2;
  score = Math.max(18, Math.min(94, score));
  const level = score >= 68 ? "Low Risk" : score >= 45 ? "Moderate Risk" : "High Risk";
  const factors = [
    { label: "Income stability", value: values.employmentStatus === "unemployed" ? "Needs attention" : "Supportive" },
    { label: "Expense-to-income pressure", value: ratio <= 0.55 ? "Healthy" : ratio <= 0.8 ? "Watch closely" : "High pressure" },
    { label: "Savings buffer", value: savings >= income ? "Strong" : savings >= income * 0.25 ? "Developing" : "Limited" },
    { label: "Loan obligations", value: loans <= income * 0.25 ? "Manageable" : "Elevated" }
  ];
  return { score, level, confidence: Math.min(96, 72 + Math.round(score / 10)), factors, values };
}

function setupAssessment() {
  const form = document.querySelector("#assessmentForm");
  if (!form) return;
  form.addEventListener("reset", () => window.setTimeout(() => bindFormMessage(document.querySelector("#assessmentFormError"), ""), 0));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const result = calculateAssessment(values);
    const state = getState();
    state.assessments.unshift({ ...result, date: new Date().toISOString() });
    state.latestPrediction = result;
    state.recommendations = buildRecommendations(result);
    saveState(state);
    bindFormMessage(document.querySelector("#assessmentFormError"), "Assessment saved. Your results are ready.", "success");
    window.setTimeout(() => window.location.href = "prediction.html", 750);
  });
}

function buildRecommendations(result) {
  const recommendations = [];
  if (result.score < 68) recommendations.push({ icon: "fa-chart-pie", title: "Create a monthly spending plan", text: "Separate essential costs from flexible spending and review the plan at the end of each month." });
  if (result.score < 55) recommendations.push({ icon: "fa-arrow-trend-down", title: "Reduce repayment pressure", text: "Prioritise high-cost obligations and avoid taking on new debt until monthly cash flow improves." });
  recommendations.push({ icon: "fa-piggy-bank", title: "Build a practical savings buffer", text: "Set aside a consistent amount after income arrives, even when the first contribution is modest." });
  recommendations.push({ icon: "fa-shield-halved", title: "Review your position regularly", text: "Repeat the assessment after a meaningful change in income, expenses, savings, or loan commitments." });
  return recommendations;
}

function setupDashboard() {
  const state = getState();
  const name = document.querySelector("#userName");
  if (name) name.textContent = state.user?.name || "there";
  const latest = state.latestPrediction;
  const score = document.querySelector("#latestScore");
  if (score) score.textContent = latest ? `${latest.score}/100` : "--";
  const total = document.querySelector("#totalAssessments");
  if (total) total.textContent = state.assessments.length;
  const active = document.querySelector("#activeRecommendations");
  if (active) active.textContent = state.recommendations.length;
  const body = document.querySelector("#historyTableBody");
  if (body && state.assessments.length) body.innerHTML = state.assessments.slice(0, 6).map(item => `<tr><td>${new Date(item.date).toLocaleDateString("en-KE")}</td><td>${formatCurrency(item.values.monthlyIncome)}</td><td>${formatCurrency(item.values.monthlyExpenses)}</td><td><span class="risk-pill risk-${item.level.toLowerCase().split(" ")[0]}">${escapeHtml(item.level)}</span></td><td><a class="table-action" href="prediction.html">View result <i class="fa-solid fa-arrow-up-right-from-square"></i></a></td></tr>`).join("");
}

function setupPrediction() {
  const state = getState();
  const result = state.latestPrediction;
  const badge = document.querySelector("#riskBadge");
  const confidence = document.querySelector("#confidenceScore");
  const list = document.querySelector("#featureImportanceList");
  if (!result) return;
  if (badge) {
    badge.textContent = result.level;
    badge.className = `status-badge status-${result.level.toLowerCase().split(" ")[0]}`;
  }
  if (confidence) confidence.textContent = `${result.confidence}%`;
  if (list) list.innerHTML = result.factors.map(factor => `<li><span><strong>${escapeHtml(factor.label)}</strong><small>Model input</small></span><b>${escapeHtml(factor.value)}</b></li>`).join("");
}

function setupRecommendations() {
  const list = document.querySelector("#recommendationsList");
  if (!list) return;
  const recommendations = getState().recommendations;
  if (!recommendations.length) return;
  list.innerHTML = recommendations.map((item, index) => `<article class="card recommendation-card"><div class="recommendation-number">${String(index + 1).padStart(2, "0")}</div><div class="recommendation-icon"><i class="fa-solid ${item.icon}"></i></div><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.text)}</p></div></article>`).join("");
}

function drawChart(canvas, values, color) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const width = canvas.width = canvas.clientWidth * 2;
  const height = canvas.height = canvas.clientHeight * 2;
  context.scale(2, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  context.clearRect(0, 0, w, h);
  context.strokeStyle = "#e5eaf2";
  context.lineWidth = 1;
  for (let y = 18; y < h; y += (h - 36) / 4) { context.beginPath(); context.moveTo(0, y); context.lineTo(w, y); context.stroke(); }
  const max = Math.max(...values, 100);
  const step = w / Math.max(values.length - 1, 1);
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  values.forEach((value, index) => { const x = index * step; const y = h - 18 - (value / max) * (h - 36); index ? context.lineTo(x, y) : context.moveTo(x, y); });
  context.stroke();
  values.forEach((value, index) => { const x = index * step; const y = h - 18 - (value / max) * (h - 36); context.fillStyle = color; context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill(); });
}

function setupAnalytics() {
  const state = getState();
  const assessments = state.assessments.slice(0, 8).reverse();
  const scores = assessments.length ? assessments.map(item => item.score) : [42, 51, 48, 63, 71];
  const balances = assessments.length ? assessments.map(item => Math.max(10, 100 - Math.round((Number(item.values.monthlyExpenses) + Number(item.values.existingLoans)) / Math.max(Number(item.values.monthlyIncome), 1) * 100))) : [46, 52, 49, 61, 68];
  drawChart(document.querySelector("#riskScoreChart"), scores, "#16a394");
  drawChart(document.querySelector("#incomeExpenseChart"), balances, "#356ae6");
}

function setupProfile() {
  const form = document.querySelector("#profileForm");
  if (!form) return;
  const state = getState();
  const name = document.querySelector("#profileName");
  const email = document.querySelector("#profileEmail");
  if (name) name.value = state.user?.name || "";
  if (email) email.value = state.user?.email || "";
  form.addEventListener("submit", event => {
    event.preventDefault();
    const current = getState();
    current.user = { ...(current.user || {}), name: name.value.trim() };
    saveState(current);
    bindFormMessage(document.querySelector("#profileMessage"), "Your profile has been updated.", "success");
  });
}

function setupAdmin() {
  const state = getState();
  const users = document.querySelector("#adminTotalUsers");
  const assessments = document.querySelector("#adminTotalAssessments");
  const highRisk = document.querySelector("#adminHighRiskCount");
  if (users) users.textContent = state.user ? "1" : "0";
  if (assessments) assessments.textContent = state.assessments.length;
  if (highRisk) highRisk.textContent = state.assessments.filter(item => item.level === "High Risk").length;
  const body = document.querySelector("#adminTableBody");
  if (body && state.assessments.length) body.innerHTML = state.assessments.map((item, index) => `<tr><td>#${String(index + 1).padStart(3, "0")}</td><td>${escapeHtml(state.user?.email || "Local user")}</td><td>${new Date(item.date).toLocaleDateString("en-KE")}</td><td>${formatCurrency(item.values.monthlyIncome)}</td><td><span class="risk-pill risk-${item.level.toLowerCase().split(" ")[0]}">${escapeHtml(item.level)}</span></td></tr>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupLogout();
  setupAuth();
  setupAssessment();
  setupDashboard();
  setupPrediction();
  setupRecommendations();
  setupAnalytics();
  setupProfile();
  setupAdmin();
});
