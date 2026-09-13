export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/state") {
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT data FROM app_state WHERE id = 1").first();
        return new Response(row ? row.data : "null", {
          headers: { "content-type": "application/json" },
        });
      }

      if (request.method === "POST") {
        const body = await request.text();
        try {
          JSON.parse(body);
        } catch (e) {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        await env.DB.prepare(
          `INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind(body).run();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    // Anything that isn't /api/state — index.html and friends — is served
    // straight from the static assets bound below.
    return env.ASSETS.fetch(request);
  },
};
