import { useEffect, useMemo, useState } from "react";

type Tab = "home" | "search" | "category" | "profile";

const demoItems = [
  { id: 1, title: "示範短劇：午後的約定", category: "愛情", episodes: 12, description: "網頁版介面展示資料，尚未連接影片來源。" },
  { id: 2, title: "示範短劇：城市另一端", category: "都市", episodes: 8, description: "此項目僅供測試搜尋、分類與卡片版面。" },
  { id: 3, title: "示範短劇：星光之下", category: "奇幻", episodes: 16, description: "正式內容需使用具備合法授權的資料來源。" },
  { id: 4, title: "示範短劇：家的方向", category: "家庭", episodes: 10, description: "目前不提供播放，避免連接未確認授權的串流。" },
];

const categories = ["全部", "愛情", "都市", "奇幻", "家庭"];

function getSupabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  };
}

export default function WebApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [connection, setConnection] = useState<"checking" | "connected" | "missing" | "error">("checking");

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { url, key } = getSupabaseConfig();
      if (!url || !key) {
        if (active) setConnection("missing");
        return;
      }
      try {
        const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
          headers: { apikey: key },
        });
        if (active) setConnection(response.ok ? "connected" : "error");
      } catch {
        if (active) setConnection("error");
      }
    };
    void check();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => demoItems.filter((item) => {
    const matchesCategory = category === "全部" || item.category === category;
    const matchesQuery = !query.trim() || item.title.includes(query.trim()) || item.category.includes(query.trim());
    return matchesCategory && matchesQuery;
  }), [category, query]);

  return (
    <div className="web-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setTab("home"); }}>
          <span className="brand-mark">HG</span>
          <span>HGhub</span>
          <small>WEB</small>
        </a>
        <div className={`connection connection-${connection}`} title="Supabase 連線狀態">
          <span className="connection-dot" />
          {connection === "checking" ? "檢查連線中" : connection === "connected" ? "資料庫已連線" : connection === "missing" ? "尚未設定資料庫" : "連線待檢查"}
        </div>
      </header>

      <main className="main-content">
        <section className="welcome">
          <p className="eyebrow">HGhub · WEB VERSION</p>
          <h1>探索你的下一部短劇</h1>
          <p>網頁版第一階段介面。會員與內容服務將分階段接入。</p>
          <button className="primary-button" onClick={() => setTab("search")}>開始探索 <span>→</span></button>
        </section>

        <nav className="tabs" aria-label="主要導覽">
          {(["home", "search", "category", "profile"] as Tab[]).map((item) => (
            <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>
              {{ home: "首頁", search: "搜尋", category: "分類", profile: "我的" }[item]}
            </button>
          ))}
        </nav>

        {tab === "home" && (
          <section className="section">
            <div className="section-heading"><div><p className="eyebrow">DISCOVER</p><h2>內容展示</h2></div><span className="muted">測試資料</span></div>
            <div className="feature-grid">
              {filtered.map((item, index) => <article className="drama-card" key={item.id}>
                <div className={`poster poster-${index % 4}`}><span>{item.category}</span><strong>{String(item.id).padStart(2, "0")}</strong></div>
                <div className="card-copy"><h3>{item.title}</h3><p>{item.episodes} 集 · {item.description}</p><span className="demo-label">DEMO CONTENT</span></div>
              </article>)}
            </div>
          </section>
        )}

        {tab === "search" && (
          <section className="section">
            <div className="section-heading"><div><p className="eyebrow">SEARCH</p><h2>搜尋短劇</h2></div></div>
            <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="輸入劇名或分類" /></label>
            <Results items={filtered} />
          </section>
        )}

        {tab === "category" && (
          <section className="section">
            <div className="section-heading"><div><p className="eyebrow">CATEGORIES</p><h2>依分類探索</h2></div></div>
            <div className="category-list">{categories.map((item) => <button key={item} className={category === item ? "category-chip selected" : "category-chip"} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <Results items={filtered} />
          </section>
        )}

        {tab === "profile" && (
          <section className="section profile-panel">
            <p className="eyebrow">YOUR SPACE</p><h2>個人中心</h2>
            <p>會員登入、收藏清單與觀看紀錄正在規劃接入 Supabase。</p>
            <div className="profile-status"><span>資料庫連線</span><strong>{connection === "connected" ? "已連線" : connection === "checking" ? "檢查中" : "尚未完成"}</strong></div>
            <p className="fine-print">目前尚未啟用會員登入，也不會儲存個人資料。</p>
          </section>
        )}
      </main>

      <footer><span>HGhub Web</span><span>網頁版建置中 · 僅展示測試資料</span></footer>
    </div>
  );
}

function Results({ items }: { items: typeof demoItems }) {
  if (!items.length) return <p className="empty-state">沒有符合條件的測試項目。</p>;
  return <div className="result-list">{items.map((item) => <article className="result-row" key={item.id}>
    <div className="mini-poster">{String(item.id).padStart(2, "0")}</div>
    <div><h3>{item.title}</h3><p>{item.category} · {item.episodes} 集</p></div>
    <span className="demo-label">DEMO</span>
  </article>)}</div>;
}
