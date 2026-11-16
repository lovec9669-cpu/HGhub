const IMG_KEY = new TextEncoder().encode("f5d965df75336270");
const IMG_IV = new TextEncoder().encode("97b60394abc2fbe1");
const ALLOWED_HOSTS = ["huangguoai.com", "huangguoai.ai"];

function isAllowedHost(host: string) {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some((domain) => normalized === domain || normalized.endsWith("." + domain));
}

function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 6 && new TextDecoder().decode(bytes.slice(0, 4)) === "GIF8") return "image/gif";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function fail(res: any, status: number, message: string) {
  res.status(status).setHeader("Content-Type", "text/plain; charset=utf-8").setHeader("Cache-Control", "no-store").end(message);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return fail(res, 405, "Method not allowed");
  }

  const raw = typeof req.query?.url === "string" ? req.query.url : "";
  if (!raw || raw.length > 2048) return fail(res, 400, "Invalid image URL");

  let target: URL;
  try { target = new URL(raw); } catch { return fail(res, 400, "Invalid image URL"); }
  if (target.protocol !== "https:" || target.username || target.password || !isAllowedHost(target.hostname)) {
    return fail(res, 403, "Image host is not allowed");
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "error",
      headers: { Accept: "image/*", Referer: "https://huangguoai.com/" },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return fail(res, 502, "Image source unavailable");

    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > 5 * 1024 * 1024) return fail(res, 413, "Image is too large");
    const encrypted = new Uint8Array(await upstream.arrayBuffer());
    if (!encrypted.length || encrypted.length > 5 * 1024 * 1024) return fail(res, 413, "Image is too large");

    let plain = encrypted;
    let mime = imageMime(plain);
    if (!mime) {
      if (encrypted.length % 16 !== 0) return fail(res, 502, "Invalid encrypted image");
      const key = await crypto.subtle.importKey("raw", IMG_KEY, { name: "AES-CBC" }, false, ["decrypt"]);
      try {
        plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: IMG_IV }, key, encrypted));
      } catch {
        return fail(res, 502, "Image decryption failed");
      }
      mime = imageMime(plain);
    }
    if (!mime) return fail(res, 502, "Unsupported image format");

    res.status(200);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(plain.byteLength));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.end(Buffer.from(plain));
  } catch {
    return fail(res, 502, "Unable to retrieve image");
  }
}
