import { useEffect, useMemo, useState } from "react";

type Tab = "home" | "search" | "category" | "profile";
type Drama = {
  id: number;
  title: string;
  cover?: string;
  description?: string;
  tags: string[];
  episode_count: number;
  total_episodes: number;
  is_finished?: boolean;
};

type FeedState = "loading" | "ready" | "empty" | "error";

function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  };
}

function getItems(payload: any): Drama[] {
  const candidates = Array.isArray(payload) ? payload : payload?.items ?? payload?.list ?? payload?.videos ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((item: any) => item && Number.isFinite(Number(item.id)) && typeof item.title === "string")
    .map((item: any) => ({
      id: Number(item.id),
      title: item.title,
      cover: typeof item.cover === "string" ? item.cover : undefined,
      description: typeof item.description === "string" ? item.description : "",
      tags: Array.isArray(item.tags) ? item.tags.filter((tag: unknown) => typeof tag === "string") : [],
      episode_count: Number(item.episode_count) || 0,
      total_episodes: Number(item.total_episodes) || Number(item.episode_count) || 0,
      is_finished: Boolean(item.is_finished),
    }));
}

export default function WebApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [connection, setConnection] = useState<"checking" | "connected" | "missing" | "error">("checking");
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [feedState, setFeedState] = useState<FeedState>("loading");
  const [feedError, setFeedError] = useState("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { url, key } = getSupabaseConfig();
      if (!url || !key) {
        if (active) setConnection("missing");
        return;
      }
      try {
        const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } });
        if (active) setConnection(response.ok ? "connected" : "error");
      } catch {
        if (active) setConnection("error");
      }
    };
    void check();
    return () => { active = false; };
  }, []);

  const loadFeed = async () => {
    setFeedState("loading");
    setFeedError("");
    try {
      const response = await fetch("/api/hghub?op=feed&page=1&size=24");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "內容服務暫時無法使用");
      const items = getItems(payload);
      setDramas(items);
      setFeedState(items.length ? "ready" : "empty");
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "讀取短劇資料失敗");
      setFeedState("error");
    }
  };

  useEffect(() => { void loadFeed(); }, []);

  const categories = useMemo(() => ["全部", ...Array.from(new Set(dramas.flatMap((item) => item.tags))).slice(0, 12)], [dramas]);

  const filtered = useMemo(() => dramas.filter((item) => {
    const matchesCategory = category === "全部" || item.tags.includes(category);
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || item.title.toLowerCase().includes(term) || item.tags.some((tag) => tag.toLowerCase().includes(term));
    return matchesCategory && matchesQuery;
  }), [dramas, category, query]);

  return (
    <div className="web-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setTab("home"); }}>
          <span className="brand-mark">HG</span><span>HGhub</span><small>WEB</small>
        </a>
        <div className={`connection connection-${connection}`} title="Supabase 連線狀態">
          <span className="connection-dot" />
          {connection === "checking" ? "檢查連線中" : connection === "connected" ? "資料庫已連線" : connection === "missing" ? "尚未設定資料庫" : "資料庫連線異常"}
        </div>
      </header>

      <main className="main-content">
        <section className="welcome">
          <p className="eyebrow">HGhub · WEB VERSION</p>
          <h1>探索你的下一部短劇</h1>
          <p>瀏覽短劇目錄，搜尋作品並依分類探索。</p>
          <button className="primary-button" onClick={() => setTab("search")}>開始探索 <span>→</span></button>
        </section>

        <nav className="tabs" aria-label="主要導覽">
          {(["home", "search", "category", "profile"] as Tab[]).map((item) => (
            <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>
              {{ home: "首頁", search: "搜尋", category: "分類", profile: "我的" }[item]}
            </button>
          ))}
        </nav>

        {tab !== "profile" && (
          <section className="section">
            <div className="section-heading">
              <div><p className="eyebrow">{tab === "search" ? "SEARCH" : tab === "category" ? "CATEGORIES" : "DISCOVER"}</p><h2>{tab === "search" ? "搜尋短劇" : tab === "category" ? "依分類探索" : "短劇推薦"}</h2></div>
              <span className="muted">{feedState === "ready" ? `${dramas.length} 部作品` : "即時內容"}</span>
            </div>

            {tab === "search" && <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="輸入劇名或分類" /></label>}
            {tab === "category" && <div className="category-list">{categories.map((item) => <button key={item} className={category === item ? "category-chip selected" : "category-chip"} onClick={() => setCategory(item)}>{item}</button>)}</div>}

            {feedState === "loading" && <p className="empty-state">正在載入短劇資料…</p>}
            {feedState === "error" && <div className="empty-state"><p>目前無法載入短劇資料：{feedError}</p><button className="primary-button" onClick={() => void loadFeed()}>重新載入</button></div>}
            {feedState === "empty" && <p className="empty-state">資料來源目前沒有回傳短劇項目。</p>}
            {feedState === "ready" && !filtered.length && <p className="empty-state">沒有符合條件的短劇。</p>}

            {tab === "home" && feedState === "ready" && <div className="feature-grid">
              {filtered.map((item, index) => <article className="drama-card" key={item.id}>
                <div className={`poster poster-${index % 4}`}>
                  {item.cover && <img src={item.cover} alt={item.title} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                  <span>{item.tags[0] || "短劇"}</span><strong>{String(item.id).padStart(2, "0")}</strong>
                </div>
                <div className="card-copy"><h3>{item.title}</h3><p>{item.episode_count || item.total_episodes || "集數未提供"} 集{item.is_finished ? " · 已完結" : ""}</p><span className="demo-label">HGhub CONTENT</span></div>
              </article>)}
            </div>}

            {(tab === "search" || tab === "category") && feedState === "ready" && <Results items={filtered} />}
          </section>
        )}

        {tab === "profile" && (
          <section className="section profile-panel">
            <p className="eyebrow">YOUR SPACE</p><h2>個人中心</h2>
            <p>會員登入、收藏清單與觀看紀錄將於後續階段接入。</p>
            <div className="profile-status"><span>資料庫連線</span><strong>{connection === "connected" ? "已連線" : connection === "checking" ? "檢查中" : "尚未完成"}</strong></div>
            <p className="fine-print">目前尚未啟用網頁版會員登入。</p>
          </section>
        )}
      </main>
      <footer><span>HGhub Web</span><span>網頁版建置中</span></footer>
    </div>
  );
}

function Results({ items }: { items: Drama[] }) {
  return <div className="result-list">{items.map((item) => <article className="result-row" key={item.id}>
    <div className="mini-poster">{String(item.id).padStart(2, "0")}</div>
    <div><h3>{item.title}</h3><p>{item.tags.join(" · ") || "短劇"} · {item.episode_count || item.total_episodes || "集數未提供"} 集</p></div>
    <span className="demo-label">HGhub</span>
  </article>)}</div>;
}
