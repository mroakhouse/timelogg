import { getStore } from "@netlify/blobs";

export default async function handler(req, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Verify Netlify Identity JWT
  const user = context.clientContext?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const userId = user.sub;
  const store = getStore({ name: "timelogg", consistency: "strong" });
  const key = `user_${userId}`;

  try {
    if (req.method === "GET") {
      const raw = await store.get(key);
      if (!raw) {
        return new Response(JSON.stringify({ timelogg: {}, lookup: [] }), {
          status: 200,
          headers,
        });
      }
      return new Response(raw, { status: 200, headers });
    }

    if (req.method === "POST") {
      const body = await req.text();
      await store.set(key, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}

export const config = { path: "/api/blobs" };
