const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const adminView = $("adminView");
const adminTokenInput = $("adminToken");
const loginButton = $("loginButton");
const loginMessage = $("loginMessage");
const ruleList = $("ruleList");
const adminSearch = $("adminSearch");
const ruleForm = $("ruleForm");

let token = localStorage.getItem("northcity_admin_token") || "";
let rules = [];
let currentId = null;
let dirty = false;

const fields = {
  id: $("ruleId"),
  category: $("category"),
  displayType: $("displayType"),
  title: $("title"),
  summary: $("summary"),
  content: $("content"),
  details: $("details"),
  detailsCollapsed: $("detailsCollapsed"),
  changeNote: $("changeNote"),
  isPublished: $("isPublished"),
  keywords: $("keywords"),
  sortOrder: $("sortOrder"),
  slug: $("slug")
};

function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("x-admin-token", token);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(path, { ...options, headers, cache: "no-store" });
}

function setDirty(value) {
  dirty = value;
  $("dirtyBadge").hidden = !dirty;
}

function selectedRule() {
  return rules.find(r => Number(r.id) === Number(currentId)) || null;
}

function renderRuleList() {
  const q = adminSearch.value.trim().toLowerCase();
  const shown = rules.filter(rule => {
    const text = [rule.title, rule.category, rule.summary, rule.keywords].join(" ").toLowerCase();
    return !q || text.includes(q);
  });

  ruleList.innerHTML = "";

  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.style.padding = "10px";
    empty.textContent = "該当するルールがありません。";
    ruleList.appendChild(empty);
    return;
  }

  shown.forEach(rule => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = Number(rule.id) === Number(currentId) ? "active" : "";
    button.innerHTML = `<strong>${escapeHtml(rule.title)}</strong><small>${escapeHtml(rule.category)}${rule.is_published ? "" : " ・ 下書き"}</small>`;
    button.addEventListener("click", () => {
      if (dirty && !confirm("未保存の変更があります。別のルールを開きますか？")) return;
      loadIntoForm(rule);
    });
    ruleList.appendChild(button);
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  currentId = null;
  ruleForm.reset();
  fields.detailsCollapsed.checked = true;
  fields.isPublished.checked = true;
  fields.sortOrder.value = 0;
  $("editorTitle").textContent = "新しいルール";
  $("historyButton").disabled = true;
  $("retireButton").disabled = true;
  setDirty(false);
  renderRuleList();
  updatePreview();
}

function loadIntoForm(rule) {
  currentId = Number(rule.id);
  fields.id.value = rule.id;
  fields.category.value = rule.category || "";
  fields.displayType.value = rule.display_type || "normal";
  fields.title.value = rule.title || "";
  fields.summary.value = rule.summary || "";
  fields.content.value = rule.content || "";
  fields.details.value = rule.details || "";
  fields.detailsCollapsed.checked = Boolean(rule.details_collapsed);
  fields.changeNote.value = "";
  fields.isPublished.checked = Boolean(rule.is_published);
  fields.keywords.value = rule.keywords || "";
  fields.sortOrder.value = rule.sort_order ?? 0;
  fields.slug.value = rule.slug || "";

  $("editorTitle").textContent = rule.title || "ルール編集";
  $("historyButton").disabled = false;
  $("retireButton").disabled = Boolean(rule.retired_at);
  setDirty(false);
  renderRuleList();
  updatePreview();
}

function formPayload() {
  return {
    category: fields.category.value,
    display_type: fields.displayType.value,
    title: fields.title.value,
    summary: fields.summary.value,
    content: fields.content.value,
    details: fields.details.value,
    details_collapsed: fields.detailsCollapsed.checked,
    change_note: fields.changeNote.value,
    is_published: fields.isPublished.checked,
    keywords: fields.keywords.value,
    sort_order: Number(fields.sortOrder.value || 0),
    slug: fields.slug.value
  };
}

function updatePreview() {
  const labels = {
    normal: "通常",
    note: "補足",
    caution: "注意",
    important: "重要",
    prohibited: "禁止"
  };
  $("previewType").textContent = labels[fields.displayType.value] || "通常";
  $("previewCategory").textContent = fields.category.value || "カテゴリ未選択";
  $("previewTitle").textContent = fields.title.value || "ルールの名前";
  $("previewContent").textContent = fields.content.value || "ここに本文のプレビューが表示されます。";

  const detailText = fields.details.value.trim();
  $("previewDetails").hidden = !detailText;
  $("previewDetailsText").textContent = detailText;
  $("previewDetails").open = detailText && !fields.detailsCollapsed.checked;
}

async function refreshRules(preferId = currentId) {
  const res = await api("/api/admin/rules");
  if (res.status === 401) throw new Error("unauthorized");
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || data.error || "load failed");
  rules = data.rules || [];
  renderRuleList();

  if (preferId) {
    const found = rules.find(r => Number(r.id) === Number(preferId));
    if (found) loadIntoForm(found);
  }
}

async function login() {
  token = adminTokenInput.value.trim();
  if (!token) {
    loginMessage.textContent = "管理パスワードを入力してください。";
    return;
  }

  loginButton.disabled = true;
  loginMessage.textContent = "確認中…";

  try {
    const res = await api("/api/admin/check");
    if (!res.ok) throw new Error("login failed");

    localStorage.setItem("northcity_admin_token", token);
    loginView.hidden = true;
    adminView.hidden = false;
    loginMessage.textContent = "";
    await refreshRules();
    resetForm();
  } catch {
    loginMessage.textContent = "管理パスワードが違うか、設定がまだ完了していません。";
  } finally {
    loginButton.disabled = false;
  }
}

loginButton.addEventListener("click", login);
adminTokenInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

$("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("northcity_admin_token");
  token = "";
  adminView.hidden = true;
  loginView.hidden = false;
  adminTokenInput.value = "";
});

$("newRuleButton").addEventListener("click", () => {
  if (dirty && !confirm("未保存の変更があります。新規作成に移動しますか？")) return;
  resetForm();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

adminSearch.addEventListener("input", renderRuleList);

Object.values(fields).forEach(field => {
  field.addEventListener("input", () => {
    setDirty(true);
    updatePreview();
  });
  field.addEventListener("change", () => {
    setDirty(true);
    updatePreview();
  });
});

ruleForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = formPayload();
  if (!payload.category || !payload.title.trim() || !payload.content.trim()) {
    alert("カテゴリ・ルールの名前・本文は必須です。");
    return;
  }

  const saveButton = ruleForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = "保存中…";

  try {
    const url = currentId ? `/api/admin/rules/${currentId}` : "/api/admin/rules";
    const method = currentId ? "PUT" : "POST";
    const res = await api(url, { method, body: JSON.stringify(payload) });
    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data.message || data.error || "save failed");

    currentId = data.id || currentId;
    setDirty(false);
    await refreshRules(currentId);
    alert("保存しました。");
  } catch (error) {
    alert(`保存できませんでした。\n${error.message}`);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "保存する";
  }
});

$("retireButton").addEventListener("click", async () => {
  const rule = selectedRule();
  if (!rule) return;
  if (!confirm(`「${rule.title}」を廃止しますか？\n住民向けの一覧からは非表示になります。`)) return;

  try {
    const res = await api(`/api/admin/rules/${rule.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || data.error || "retire failed");
    await refreshRules();
    resetForm();
    alert("廃止しました。");
  } catch (error) {
    alert(`廃止できませんでした。\n${error.message}`);
  }
});

$("historyButton").addEventListener("click", async () => {
  const rule = selectedRule();
  if (!rule) return;

  const list = $("historyList");
  list.innerHTML = '<p class="help">読み込み中…</p>';
  $("historyDialog").showModal();

  try {
    const res = await api(`/api/admin/history/${rule.id}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error("history failed");

    list.innerHTML = "";
    if (!data.history.length) {
      list.innerHTML = '<p class="help">まだ過去の変更履歴はありません。</p>';
      return;
    }

    data.history.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <strong>${escapeHtml(item.change_note || "変更前の内容")}</strong>
        <time>${escapeHtml(item.saved_at || "")}</time>
        <p>${escapeHtml(item.content || "")}</p>
      `;
      list.appendChild(div);
    });
  } catch {
    list.innerHTML = '<p class="help">変更履歴を読み込めませんでした。</p>';
  }
});

$("closeHistory").addEventListener("click", () => $("historyDialog").close());

window.addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

async function boot() {
  if (!token) return;
  adminTokenInput.value = token;

  try {
    const res = await api("/api/admin/check");
    if (!res.ok) throw new Error();
    loginView.hidden = true;
    adminView.hidden = false;
    await refreshRules();
    resetForm();
  } catch {
    localStorage.removeItem("northcity_admin_token");
    token = "";
  }
}

boot();
