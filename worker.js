function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // DB接続確認用
    if (url.pathname === "/api/health" && request.method === "GET") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();

        return json({
          ok: result?.ok === 1,
          message: "North City DB connection is working."
        });
      } catch (error) {
        return json({
          ok: false,
          message: "DB connection failed.",
          error: String(error?.message || error)
        }, 500);
      }
    }

    // ルール一覧取得用
    // ※ rules テーブルは次の手順で作成します。
    if (url.pathname === "/api/rules" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT
            id,
            slug,
            category,
            title,
            summary,
            content,
            display_type,
            is_published,
            sort_order,
            created_at,
            updated_at
          FROM rules
          WHERE is_published = 1
          ORDER BY sort_order ASC, id ASC
        `).all();

        return json({
          ok: true,
          rules: result.results || []
        });
      } catch (error) {
        return json({
          ok: false,
          rules: [],
          message: "rules table is not ready yet.",
          error: String(error?.message || error)
        }, 503);
      }
    }

    // API以外は今まで通り既存サイトを表示
    return env.ASSETS.fetch(request);
  }
};
