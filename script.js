const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle?.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

const searchInput = document.getElementById("ruleSearch");
const ruleGrid = document.getElementById("ruleGrid");
const noResults = document.getElementById("noResults");

let searchableCards = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createRuleCard(rule) {
  const card = document.createElement("a");
  card.className = "rule-card";
  card.href = `#rule-${rule.slug}`;
  card.dataset.keywords = [rule.category, rule.title, rule.summary, rule.content]
    .filter(Boolean).join(" ");

  card.innerHTML = `
    <span class="rule-icon" aria-hidden="true">📘</span>
    <strong>${escapeHtml(rule.title)}</strong>
    <span>${escapeHtml(rule.summary || rule.category || "ルール")}</span>
  `;

  return card;
}

function updateSearch() {
  const query = searchInput?.value.trim().toLowerCase() || "";
  let visible = 0;

  searchableCards.forEach(card => {
    const text = `${card.textContent} ${card.dataset.keywords || ""}`.toLowerCase();
    const match = !query || text.includes(query);
    card.style.display = match ? "" : "none";
    if (match) visible++;
  });

  if (noResults) noResults.style.display = visible ? "none" : "block";
}

async function loadRulesFromDatabase() {
  if (!ruleGrid) return;

  try {
    const response = await fetch("/api/rules", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || !data.ok || !Array.isArray(data.rules) || data.rules.length === 0) {
      throw new Error("DB rules not available");
    }

    ruleGrid.innerHTML = "";
    data.rules.forEach(rule => ruleGrid.appendChild(createRuleCard(rule)));

    searchableCards = [...ruleGrid.querySelectorAll(".rule-card")];
    updateSearch();
  } catch (error) {
    console.warn("DBルールを読み込めませんでした。", error);
    searchableCards = [...ruleGrid.querySelectorAll(".rule-card")];
    updateSearch();
  }
}

searchInput?.addEventListener("input", updateSearch);

searchableCards = [...document.querySelectorAll(".rule-card")];
updateSearch();
loadRulesFromDatabase();
