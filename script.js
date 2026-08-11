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
const ruleCards = [...document.querySelectorAll(".rule-card")];
const noResults = document.getElementById("noResults");

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;

  ruleCards.forEach(card => {
    const text = `${card.textContent} ${card.dataset.keywords || ""}`.toLowerCase();
    const match = !query || text.includes(query);
    card.style.display = match ? "" : "none";
    if (match) visible++;
  });

  if (noResults) {
    noResults.style.display = visible ? "none" : "block";
  }
});
