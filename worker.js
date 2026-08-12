function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function unauthorized() {
  return json({ ok: false, message: "Unauthorized" }, 401);
}

function isAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  const received = request.headers.get("x-admin-token");
  return Boolean(expected && received && received === expected);
}

async function ensureAdminSchema(db) {
  const info = await db.prepare("PRAGMA table_info(rules)").all();
  const cols = new Set((info.results || []).map(row => row.name));

  const additions = [
    ["keywords", "TEXT DEFAULT ''"],
    ["details", "TEXT DEFAULT ''"],
    ["details_collapsed", "INTEGER DEFAULT 1"],
    ["change_note", "TEXT DEFAULT ''"],
    ["new_until", "TEXT DEFAULT NULL"],
    ["retired_at", "TEXT DEFAULT NULL"]
  ];

  for (const [name, definition] of additions) {
    if (!cols.has(name)) {
      await db.prepare(`ALTER TABLE rules ADD COLUMN ${name} ${definition}`).run();
    }
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rule_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT DEFAULT '',
      content TEXT NOT NULL,
      details TEXT DEFAULT '',
      display_type TEXT DEFAULT 'normal',
      is_published INTEGER DEFAULT 1,
      change_note TEXT DEFAULT '',
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'rule',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      rule_id INTEGER,
      rule_slug TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function cleanString(value, max = 100000) {
  return String(value ?? "").slice(0, max);
}

function normalizeRuleInput(body) {
  const title = cleanString(body.title, 200).trim();
  const category = cleanString(body.category, 100).trim();
  const content = cleanString(body.content, 100000).trim();

  if (!title || !category || !content) {
    return { error: "title, category and content are required" };
  }

  const allowedTypes = new Set(["normal", "note", "caution", "important", "prohibited"]);
  const displayType = allowedTypes.has(body.display_type) ? body.display_type : "normal";

  return {
    value: {
      title,
      category,
      summary: cleanString(body.summary, 500).trim(),
      content,
      details: cleanString(body.details, 100000).trim(),
      details_collapsed: body.details_collapsed ? 1 : 0,
      keywords: cleanString(body.keywords, 1000).trim(),
      display_type: displayType,
      is_published: body.is_published ? 1 : 0,
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      change_note: cleanString(body.change_note, 1000).trim()
    }
  };
}

function makeSlug(title) {
  const base = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || `rule-${Date.now()}`;
}

function datePlusFiveDaysISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 5);
  return d.toISOString();
}

async function uniqueSlug(db, requested, title, exceptId = null) {
  let base = cleanString(requested, 100).trim() || makeSlug(title);
  base = base.replace(/[^a-zA-Z0-9\u3040-\u30ff\u3400-\u9fff\-_]/g, "-");
  if (!base) base = `rule-${Date.now()}`;

  let candidate = base;
  let n = 2;

  while (true) {
    const sql = exceptId
      ? "SELECT id FROM rules WHERE slug = ? AND id != ? LIMIT 1"
      : "SELECT id FROM rules WHERE slug = ? LIMIT 1";
    const stmt = exceptId
      ? db.prepare(sql).bind(candidate, exceptId)
      : db.prepare(sql).bind(candidate);

    const found = await stmt.first();
    if (!found) return candidate;
    candidate = `${base}-${n++}`;
  }
}

async function saveHistory(db, rule, note = "") {
  if (!rule) return;
  await db.prepare(`
    INSERT INTO rule_history
    (rule_id, title, category, summary, content, details, display_type, is_published, change_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    rule.id,
    rule.title,
    rule.category,
    rule.summary || "",
    rule.content,
    rule.details || "",
    rule.display_type || "normal",
    rule.is_published ?? 1,
    note || rule.change_note || ""
  ).run();
}

async function addUpdate(db, { type = "rule", title, description = "", ruleId = null, ruleSlug = null }) {
  await db.prepare(`
    INSERT INTO updates (type, title, description, rule_id, rule_slug)
    VALUES (?, ?, ?, ?, ?)
  `).bind(type, title, description, ruleId, ruleSlug).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: result?.ok === 1 });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 500);
      }
    }

    // Public rule list
    if (url.pathname === "/api/rules" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT
            id, slug, category, title, summary, content, display_type,
            is_published, sort_order, created_at, updated_at
          FROM rules
          WHERE is_published = 1
          ORDER BY sort_order ASC, id ASC
        `).all();

        return json({ ok: true, rules: result.results || [] });
      } catch (error) {
        return json({ ok: false, rules: [], error: String(error?.message || error) }, 500);
      }
    }

    // Public update list
    if (url.pathname === "/api/updates" && request.method === "GET") {
      try {
        await ensureAdminSchema(env.DB);
        const result = await env.DB.prepare(`
          SELECT id, type, title, description, rule_id, rule_slug, created_at
          FROM updates
          ORDER BY id DESC
          LIMIT 100
        `).all();
        return json({ ok: true, updates: result.results || [] });
      } catch (error) {
        return json({ ok: false, updates: [], error: String(error?.message || error) }, 500);
      }
    }

    // Admin login check
    if (url.pathname === "/api/admin/check" && request.method === "GET") {
      if (!isAdmin(request, env)) return unauthorized();
      try {
        await ensureAdminSchema(env.DB);
        return json({ ok: true });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 500);
      }
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!isAdmin(request, env)) return unauthorized();

      try {
        await ensureAdminSchema(env.DB);
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 500);
      }

      // List all rules for admin
      if (url.pathname === "/api/admin/rules" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT
            id, slug, category, title, summary, content, details,
            details_collapsed, keywords, display_type, is_published,
            sort_order, change_note, new_until, retired_at,
            created_at, updated_at
          FROM rules
          ORDER BY sort_order ASC, id ASC
        `).all();

        return json({ ok: true, rules: result.results || [] });
      }

      // Create rule
      if (url.pathname === "/api/admin/rules" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const normalized = normalizeRuleInput(body);
        if (normalized.error) return json({ ok: false, message: normalized.error }, 400);

        const rule = normalized.value;
        const slug = await uniqueSlug(env.DB, body.slug, rule.title);

        const result = await env.DB.prepare(`
          INSERT INTO rules
          (slug, category, title, summary, content, display_type, is_published,
           sort_order, keywords, details, details_collapsed, change_note, new_until,
           created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          slug, rule.category, rule.title, rule.summary, rule.content,
          rule.display_type, rule.is_published, rule.sort_order, rule.keywords,
          rule.details, rule.details_collapsed, rule.change_note, datePlusFiveDaysISO()
        ).run();

        const id = result.meta?.last_row_id;
        await addUpdate(env.DB, {
          type: "rule",
          title: `新規ルール：${rule.title}`,
          description: rule.change_note || rule.summary,
          ruleId: id,
          ruleSlug: slug
        });

        return json({ ok: true, id, slug }, 201);
      }

      // Update or retire rule
      const ruleMatch = url.pathname.match(/^\/api\/admin\/rules\/(\d+)$/);
      if (ruleMatch && request.method === "PUT") {
        const id = Number(ruleMatch[1]);
        const existing = await env.DB.prepare("SELECT * FROM rules WHERE id = ?").bind(id).first();
        if (!existing) return json({ ok: false, message: "Rule not found" }, 404);

        const body = await request.json().catch(() => ({}));
        const normalized = normalizeRuleInput(body);
        if (normalized.error) return json({ ok: false, message: normalized.error }, 400);

        const rule = normalized.value;
        const slug = await uniqueSlug(env.DB, body.slug || existing.slug, rule.title, id);

        await saveHistory(env.DB, existing, rule.change_note);

        const contentChanged =
          existing.title !== rule.title ||
          existing.category !== rule.category ||
          (existing.summary || "") !== rule.summary ||
          existing.content !== rule.content ||
          (existing.details || "") !== rule.details ||
          (existing.display_type || "normal") !== rule.display_type;

        const newUntil = contentChanged ? datePlusFiveDaysISO() : existing.new_until;

        await env.DB.prepare(`
          UPDATE rules
          SET slug = ?, category = ?, title = ?, summary = ?, content = ?,
              display_type = ?, is_published = ?, sort_order = ?, keywords = ?,
              details = ?, details_collapsed = ?, change_note = ?, new_until = ?,
              retired_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          slug, rule.category, rule.title, rule.summary, rule.content,
          rule.display_type, rule.is_published, rule.sort_order, rule.keywords,
          rule.details, rule.details_collapsed, rule.change_note, newUntil, id
        ).run();

        if (contentChanged || rule.change_note) {
          await addUpdate(env.DB, {
            type: "rule",
            title: `ルール更新：${rule.title}`,
            description: rule.change_note || "内容を更新しました。",
            ruleId: id,
            ruleSlug: slug
          });
        }

        return json({ ok: true, id, slug });
      }

      if (ruleMatch && request.method === "DELETE") {
        const id = Number(ruleMatch[1]);
        const existing = await env.DB.prepare("SELECT * FROM rules WHERE id = ?").bind(id).first();
        if (!existing) return json({ ok: false, message: "Rule not found" }, 404);

        await saveHistory(env.DB, existing, "廃止");
        await env.DB.prepare(`
          UPDATE rules
          SET is_published = 0, retired_at = CURRENT_TIMESTAMP,
              change_note = '廃止', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(id).run();

        await addUpdate(env.DB, {
          type: "rule",
          title: `ルール廃止：${existing.title}`,
          description: "このルールは廃止されました。",
          ruleId: id,
          ruleSlug: existing.slug
        });

        return json({ ok: true });
      }

      // History
      const historyMatch = url.pathname.match(/^\/api\/admin\/history\/(\d+)$/);
      if (historyMatch && request.method === "GET") {
        const id = Number(historyMatch[1]);
        const result = await env.DB.prepare(`
          SELECT *
          FROM rule_history
          WHERE rule_id = ?
          ORDER BY id DESC
          LIMIT 50
        `).bind(id).all();

        return json({ ok: true, history: result.results || [] });
      }

      // Updates admin list + manual add
      if (url.pathname === "/api/admin/updates" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT *
          FROM updates
          ORDER BY id DESC
          LIMIT 200
        `).all();
        return json({ ok: true, updates: result.results || [] });
      }

      if (url.pathname === "/api/admin/updates" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const title = cleanString(body.title, 200).trim();
        if (!title) return json({ ok: false, message: "title is required" }, 400);

        await addUpdate(env.DB, {
          type: cleanString(body.type, 50).trim() || "update",
          title,
          description: cleanString(body.description, 2000).trim()
        });
        return json({ ok: true }, 201);
      }

      return json({ ok: false, message: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
