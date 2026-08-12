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

const categoryMeta = {
  "初心者向け": { icon: "🌱", description: "初めての方向け" },
  "基本ルール": { icon: "🏙️", description: "すべての住民" },
  "RPルール": { icon: "🎭", description: "RP・メタ関連" },
  "禁止行為": { icon: "🚫", description: "禁止・システム悪用" },
  "犯罪ルール": { icon: "🔫", description: "犯罪・人質・逃走" },
  "ギャング・抗争": { icon: "👥", description: "組織・抗争" },
  "罪状・罰則": { icon: "⚖️", description: "罪状・罰金" },
  "白市民": { icon: "🤍", description: "白市民向け" },
  "店舗・会社": { icon: "🏪", description: "営業・開業" },
  "警察": { icon: "👮", description: "Police" },
  "EMS": { icon: "🚑", description: "救急・医療" },
  "メカニック": { icon: "🔧", description: "修理・整備" },
  "運営チーム規約": { icon: "⚙️", description: "運営について" },
  "更新情報": { icon: "📢", description: "変更・アップデート" }
};

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
  const meta = categoryMeta[rule.category] || {
    icon: "📘",
    description: rule.summary || "ルール"
  };

  const card = document.createElement("a");
  card.className = "rule-card";
  card.href = `#rule-${rule.slug}`;
  card.dataset.keywords = [
    rule.category,
    rule.title,
    rule.summary,
    rule.content
  ].filter(Boolean).join(" ");

  card.innerHTML = `
    <span class="rule-icon" aria-hidden="true">${meta.icon}</span>
    <strong>${escapeHtml(rule.title)}</strong>
    <span>${escapeHtml(rule.summary || meta.description)}</span>
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

  if (noResults) {
    noResults.style.display = visible ? "none" : "block";
  }
}

async function loadRulesFromDatabase() {
  if (!ruleGrid) return;

  const originalHtml = ruleGrid.innerHTML;

  try {
    const response = await fetch("/api/rules", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.ok || !Array.isArray(data.rules)) {
      throw new Error("Invalid rules response");
    }

    if (data.rules.length === 0) {
      searchableCards = [...ruleGrid.querySelectorAll(".rule-card")];
      updateSearch();
      return;
    }

    ruleGrid.innerHTML = "";

    data.rules.forEach(rule => {
      ruleGrid.appendChild(createRuleCard(rule));
    });

    searchableCards = [...ruleGrid.querySelectorAll(".rule-card")];
    updateSearch();
  } catch (error) {
    console.warn("DBルールの読み込みに失敗したため、既存表示を使用します。", error);
    ruleGrid.innerHTML = originalHtml;
    searchableCards = [...ruleGrid.querySelectorAll(".rule-card")];
    updateSearch();
  }
}

searchInput?.addEventListener("input", updateSearch);

searchableCards = [...document.querySelectorAll(".rule-card")];
updateSearch();
loadRulesFromDatabase();
