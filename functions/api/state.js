// Cloudflare Pages Function. Anything under /functions maps straight to a
// route: this file answers GET and POST at /api/state. No build step, no
// wrangler — Cloudflare deploys it automatically on every push, same as
// index.html itself.
//
// Storage is one row: the whole app state as a JSON blob. That's the right
// shape for a single-teacher tool with no per-student accounts yet — when
// student round-links are added later, that's the point to move to a proper
// multi-row schema (students / rounds / responses / lessons).

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT data FROM app_state WHERE id = 1").first();
  return new Response(row ? row.data : "null", {
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost({ env, request }) {
  const body = await request.text();

  // Reject anything that isn't valid JSON before it reaches the database.
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
