function json(obj, status = 200) {
  return new Response(typeof obj === "string" ? obj : JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function isValidJSON(s) {
  try { JSON.parse(s); return true; } catch (e) { return false; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Admin — full state, read and overwrite. This route (and this one
    // alone, alongside /admin.html) is what Cloudflare Access should be
    // configured to protect. Nothing here checks auth itself: Access sits
    // in front of it at Cloudflare's edge before the request ever reaches
    // this code.
    if (url.pathname === "/api/state") {
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT data FROM app_state WHERE id = 1").first();
        return json(row ? row.data : "null");
      }
      if (request.method === "POST") {
        const body = await request.text();
        if (!isValidJSON(body)) return json({ error: "invalid json" }, 400);
        await env.DB.prepare(
          `INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind(body).run();
        return json({ ok: true });
      }
      return new Response("Method not allowed", { status: 405 });
    }

    // Public — just enough for a student to find their name and see what's
    // on offer. Never the schedule, the hours ledger, or anyone else's
    // individual reply.
    if (url.pathname === "/api/round" && request.method === "GET") {
      const row = await env.DB.prepare("SELECT data FROM app_state WHERE id = 1").first();
      const state = row ? JSON.parse(row.data) : null;
      if (!state) return json({ weekNo: 1, offered: [], students: [] });
      return json({
        weekNo: state.weekNo,
        offered: state.offered || [],
        students: (state.students || []).map((s) => ({ id: s.id, name: s.name })),
      });
    }

    // Public — a student submitting their own availability. This can only
    // ever touch that one student's entry in `replies`; it cannot see or
    // change anything else in the saved state (the schedule, the hours
    // ledger, or any other student's reply).
    if (url.pathname === "/api/reply" && request.method === "POST") {
      let body;
      try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: "invalid json" }, 400); }
      const { studentId, status, avail } = body || {};
      if (!studentId || !["in", "skip", "none"].includes(status) || !Array.isArray(avail)) {
        return json({ error: "invalid reply" }, 400);
      }
      const row = await env.DB.prepare("SELECT data FROM app_state WHERE id = 1").first();
      const state = row ? JSON.parse(row.data) : {};
      state.replies = state.replies || {};
      state.replies[studentId] = { status, avail };
      const data = JSON.stringify(state);
      await env.DB.prepare(
        `INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).bind(data).run();
      return json({ ok: true });
    }

    // Everything else — index.html (students), admin.html (you) — served
    // straight from static assets.
    return env.ASSETS.fetch(request);
  },
};
