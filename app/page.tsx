"use client";

import { useMemo, useState } from "react";

type Place = {
  id: string;
  name: string;
  en: string;
  category: "行政服務" | "普通教室" | "專科教室" | "運動場館" | "生活服務";
  position: [number, number];
  facilities: string[];
  keywords: string[];
  route: string;
  minutes: number;
};

const places: Place[] = [
  { id: "gate", name: "校門口", en: "Main Gate", category: "生活服務", position: [69, 75], facilities: ["警衛室", "訪客報到", "校園導覽起點"], keywords: ["校門", "警衛", "報到", "入口"], route: "從校門口出發，依畫面箭頭前往目的地。", minutes: 0 },
  { id: "admin", name: "行政樓", en: "Administration Building", category: "行政服務", position: [65, 49], facilities: ["教務處", "總務處", "註冊與課務服務"], keywords: ["註冊", "課務", "教務", "行政", "成績"], route: "從校門進入後直行，穿過前庭即可抵達。", minutes: 2 },
  { id: "xiangyang", name: "向陽樓", en: "Xiangyang Building", category: "行政服務", position: [66, 27], facilities: ["學務處", "教官室", "健康中心", "軍訓教室", "健護教室", "高二教室"], keywords: ["請假", "生病", "健康", "護理師", "學務", "教官", "高二"], route: "從校門進入後往右前方，沿行政樓旁步道前行。", minutes: 3 },
  { id: "zhixing", name: "知行館", en: "Zhixing Hall", category: "行政服務", position: [50, 42], facilities: ["輔導室", "生涯諮詢", "團體輔導空間"], keywords: ["輔導", "諮商", "生涯", "心理"], route: "從校門直行至活動中心前，向左沿中庭步道前往。", minutes: 3 },
  { id: "lizhi", name: "立志樓", en: "Lizhi Building", category: "普通教室", position: [48, 19], facilities: ["國中部教室", "員生合作社", "普通教室"], keywords: ["國中", "合作社", "文具", "用品", "教室"], route: "從校門往校園中央前進，經行政樓後向左走。", minutes: 4 },
  { id: "qin", name: "勤學樓", en: "Qinxue Building", category: "普通教室", position: [74, 34], facilities: ["高中部教室", "班級教室"], keywords: ["高中", "高一", "高三", "班級", "教室"], route: "從校門進入後右轉，沿右側林蔭道前行。", minutes: 3 },
  { id: "yuewen", name: "悅聞樓", en: "Yuewen Building", category: "專科教室", position: [53, 8], facilities: ["圖書館", "國中部教師辦公室", "閱讀空間"], keywords: ["圖書館", "借書", "閱讀", "國中教師", "老師"], route: "從校門沿中央步道往北，經立志樓後繼續前行。", minutes: 5 },
  { id: "qiuzhen", name: "求真樓", en: "Qiuzhen Building", category: "專科教室", position: [73, 10], facilities: ["專科教室", "學習空間"], keywords: ["專科", "實驗", "教室"], route: "從校門右轉，沿右側道路前往校園北側。", minutes: 5 },
  { id: "art", name: "藝采樓", en: "Yicai Building", category: "專科教室", position: [79, 55], facilities: ["藝術教室", "表演與創作空間"], keywords: ["藝術", "美術", "音樂", "表演"], route: "從校門直行後向右，經行政樓前庭即可抵達。", minutes: 2 },
  { id: "activity", name: "活動中心", en: "Activity Center", category: "專科教室", position: [55, 66], facilities: ["陽明劇院", "演藝廳", "大型活動空間"], keywords: ["活動", "劇院", "演藝廳", "集合"], route: "從校門進入後向左前方走，活動中心就在前方。", minutes: 2 },
  { id: "taiyuan", name: "台元館", en: "Taiyuan Gymnasium", category: "運動場館", position: [49, 34], facilities: ["室內體育館", "球類活動空間"], keywords: ["體育", "室內", "球場", "集合"], route: "從校門走向活動中心，再沿操場內側步道前往。", minutes: 4 },
  { id: "pool", name: "漾泉館", en: "Yangquan Pool", category: "運動場館", position: [42, 9], facilities: ["溫水游泳池", "游泳課集合處"], keywords: ["游泳", "泳池", "游泳課"], route: "從校門往中央步道北行，穿過立志樓旁步道。", minutes: 5 },
  { id: "track", name: "操場", en: "Athletic Field", category: "運動場館", position: [27, 54], facilities: ["田徑場", "戶外集合區"], keywords: ["操場", "田徑", "跑步", "體育課"], route: "從校門向左前方前行，沿活動中心外側即可到達。", minutes: 3 },
];

const views = [
  { src: "/campus-overview.png", label: "俯視互動圖" },
  { src: "/campus-angle-1.png", label: "空間總覽" },
  { src: "/campus-angle-2.png", label: "斜視圖 A" },
  { src: "/campus-angle-3.png", label: "斜視圖 B" },
];

const tasks = [
  ["辦理註冊、課務問題", "admin"], ["請假、生活管理", "xiangyang"], ["身體不舒服", "xiangyang"],
  ["尋求輔導協助", "zhixing"], ["借閱書籍", "yuewen"], ["購買文具、用品", "lizhi"],
  ["參加大型活動", "activity"], ["游泳課", "pool"],
] as const;

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const [view, setView] = useState(0);
  const [filter, setFilter] = useState("全部");
  const [showRoute, setShowRoute] = useState(false);
  const [mode, setMode] = useState("新生");

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    return places.filter((place) => (filter === "全部" || place.category === filter) && (!text || [place.name, place.en, ...place.facilities, ...place.keywords].join(" ").toLowerCase().includes(text)));
  }, [query, filter]);
  const choose = (place: Place) => { setSelected(place); setShowRoute(false); };

  return (
    <main>
      <section className="hero">
        <div className="brand"><span>YM</span> CAMPUS GO</div>
        <div className="hero-copy"><p className="eyebrow">臺北市立陽明高中｜智慧校園導覽</p><h1>一掃就懂，<br />一點就到。</h1><p>手機優先的校園地圖，陪你找到每一個重要地點。</p></div>
        <div className="mode-switch" aria-label="使用者模式">{["新生", "高中部", "家長"].map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
      </section>

      <section className="explore" aria-label="校園地圖導覽">
        <div className="search-wrap"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋處室、教室或地點，例如：健康中心" aria-label="搜尋校園地點" />{query && <button className="clear" onClick={() => setQuery("")}>清除</button>}</div>
        <div className="chips">{["全部", "行政服務", "普通教室", "專科教室", "運動場館", "生活服務"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <div className="map-shell">
          <img src={views[view].src} alt={`${views[view].label}校園地圖`} className="campus-map" />
          {view === 0 && results.map((place) => <button key={place.id} className={`map-pin ${selected?.id === place.id ? "focus" : ""}`} style={{ left: `${place.position[0]}%`, top: `${place.position[1]}%` }} onClick={() => choose(place)} aria-label={`查看${place.name}`}><i></i><span>{place.name}</span></button>)}
          {showRoute && selected && view === 0 && <><div className="route-line" style={{ width: `${Math.hypot(selected.position[0] - 69, selected.position[1] - 75)}%`, left: "69%", top: "75%", transform: `rotate(${Math.atan2(selected.position[1] - 75, selected.position[0] - 69) * 180 / Math.PI}deg)` }}></div><div className="route-bubble">校門出發 · 約 {selected.minutes} 分鐘</div></>}
          <div className="view-controls">{views.map((item, index) => <button key={item.label} onClick={() => setView(index)} className={view === index ? "current" : ""}>{index + 1}<span>{item.label}</span></button>)}</div>
          {view === 0 && <div className="map-hint">點選建築標記開始導覽</div>}
        </div>
      </section>

      <section className="quick-section"><div className="section-heading"><p className="eyebrow">常用目的地</p><h2>你想去哪裡？</h2></div><div className="quick-grid">{tasks.map(([label, id]) => { const place = places.find((p) => p.id === id)!; return <button key={label} onClick={() => choose(place)}><span className="mini-dot"></span>{label}<small>{place.name}</small></button>; })}</div></section>

      <section className="legend"><p>地圖圖例</p>{["行政服務", "普通教室", "專科教室", "運動場館", "生活服務"].map((item) => <span key={item} className={`legend-${item}`}>{item}</span>)}</section>

      {selected && <div className="sheet-backdrop" onClick={() => setSelected(null)}><aside className="info-sheet" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)} aria-label="關閉">×</button><div className={`place-icon icon-${selected.category}`}>⌖</div><p className="eyebrow">{selected.category} · {selected.en}</p><h2>{selected.name}</h2><div className="facilities">{selected.facilities.map((item) => <span key={item}>{item}</span>)}</div><div className="route-copy"><b>從校門出發</b><p>{selected.route}</p><small>步行約 {selected.minutes} 分鐘</small></div><button className="route-button" onClick={() => { setShowRoute(true); setView(0); }}>✦ 顯示校門導航路線</button></aside></div>}
    </main>
  );
}
