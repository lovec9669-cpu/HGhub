const UPSTREAM = "https://huangguoai.com";
const ALLOWED_ORIGIN = new URL(UPSTREAM).origin;

type Query = { op?: string; page?: string; size?: string; category?: string; kind?: string; q?: string; id?: string };

function intParam(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const query = (req.query ?? {}) as Query;
  const page = intParam(query.page, 1, 1, 500);
  const size = intParam(query.size, 20, 1, 50);
  const op = String(query.op ?? "");

  let path: string;
  switch (op) {
    case "feed":
      path = `/api/videos?page=${page}&size=${size}`;
      break;
    case "category": {
      const category = String(query.category ?? "").trim();
      if (!category || category.length > 60 || !/^[\\p{L}\\p{N}_-]+$/u.test(category)) {
        return json(res, 400, { error: "Invalid category" });
      }
      path = `/api/videos/category/${encodeURIComponent(category)}?page=${page}&size=${size}`;
      break;
    }
    case "rank": {
      const kind = String(query.kind ?? "hot");
      if (!["hot", "recommend", "potential"].includes(kind)) {
        return json(res, 400, { error: "Invalid rank type" });
      }
      path = `/api/ranks/${kind}`;
      break;
    }
    case "search": {
      const term = String(query.q ?? "").trim();
      if (!term || term.length > 80) return json(res, 400, { error: "Search term is required (max 80 characters)" });
      path = `/api/search?q=${encodeURIComponent(term)}&page=${page}&size=${size}`;
      break;
    }
    case "video": {
      const id = String(query.id ?? "");
      if (!/^\\d{1,15}$/.test(id)) return json(res, 400, { error: "Invalid video id" });
      path = `/api/videos/${id}`;
      break;
    }
    default:
      return json(res, 400, { error: "Unsupported operation" });
  }

  const upstreamUrl = new URL("/api/edge/request", ALLOWED_ORIGIN);
  const envelope = {
    method: "GET",
    path,
    body: "",
    content_type: "",
  };

  try {
    const response = await fetch(upstreamUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Referer: `${ALLOWED_ORIGIN}/`,
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(15000),
    });

    if (response.status >= 300 && response.status < 400) {
      return json(res, 502, { error: "Upstream redirect was blocked" });
    }
    if (!response.ok) {
      return json(res, 502, { error: `Upstream returned HTTP ${response.status}` });
    }

    const payload: any = await response.json();
    if (payload == null) return json(res, 200, null);
    if (payload.status === 1) return json(res, 200, payload.data ?? null);
    return json(res, 502, { error: typeof payload.msg === "string" ? payload.msg : "Upstream API error" });
  } catch {
    return json(res, 502, { error: "Unable to reach the upstream content service" });
  }
}
