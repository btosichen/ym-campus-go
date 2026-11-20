/* =========================================================
   YM Campus GO － 校園建設遊戲
   ---------------------------------------------------------
   資料分離原則：
   1. originalCampusData：從導覽頁原有建築資料 P「複製」出來後
      深層凍結（Object.freeze），為唯讀資料，遊戲無法修改。
      導覽頁仍然直接使用原本的 P，本檔案完全不寫入 P。
   2. gameCampusData：每次開新遊戲／恢復原始校園時，從
      originalCampusData 深層複製出全新的物件，玩家所有操作
      只會修改這份副本。
   3. 遊戲進度只存在獨立的 localStorage key：
      ym-campus-go-builder-state
      讀取存檔時只會還原 gameCampusData，絕不覆蓋原始資料。
   ========================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "ym-campus-go-builder-state";
  var SCHEMA_VERSION = 1;
  var HISTORY_LIMIT = 100;
  var RESET_MESSAGE =
    "確定要放棄目前的規劃，將遊戲地圖恢復成原始校園配置嗎？這不會影響校園導覽地圖。";

  /* 屋齡 50 年以上建築（「行政大樓」在導覽資料中名稱為「行政樓」） */
  var OLD_BUILDINGS = ["行政樓", "藝采樓", "立志樓", "勤學樓", "向陽樓", "知行館", "台元館"];

  /* 各建築在俯視圖上的大致範圍：[中心X%, 中心Y%, 寬%, 高%]
     只在遊戲中用來顯示「拆除後的整地範圍」，不影響導覽頁。 */
  var FOOTPRINTS = {
    "行政樓": [63, 49, 12.5, 12],
    "向陽樓": [65.5, 24, 16.5, 14],
    "知行館": [49.5, 46, 12, 17],
    "立志樓": [49, 21, 30, 16],
    "勤學樓": [76.5, 36, 17, 13],
    "悅聞樓": [56, 10.5, 17.5, 10],
    "求真樓": [68, 13.5, 8, 9],
    "藝采樓": [79, 56, 15.5, 13],
    "活動中心": [55, 74, 19, 30],
    "台元館": [45.5, 33, 14.5, 13],
    "漾泉館": [42, 13.5, 11, 8],
    "操場": [28, 55, 35, 62],
  };

  var CATEGORY_COLORS = {
    "行政服務": "#7fb7c9",
    "普通教室": "#d9a066",
    "專科教室": "#9cc47a",
    "運動場館": "#e07a6a",
    "生活服務": "#b99ad6",
  };

  /* 建築選單 */
  var CATALOG = [
    { key: "classroom", name: "新教學大樓", icon: "🏫", category: "普通教室", w: 12, h: 10, facilities: ["普通教室", "討論空間"] },
    { key: "library", name: "智慧圖書館", icon: "📚", category: "專科教室", w: 11, h: 10, facilities: ["閱覽室", "自學區"] },
    { key: "lab", name: "科學實驗樓", icon: "🔬", category: "專科教室", w: 11, h: 9, facilities: ["物理實驗室", "化學實驗室", "生物實驗室"] },
    { key: "gym", name: "多功能體育館", icon: "🏀", category: "運動場館", w: 14, h: 12, facilities: ["室內球場", "韻律教室"] },
    { key: "cafeteria", name: "學生餐廳", icon: "🍱", category: "生活服務", w: 10, h: 8, facilities: ["用餐區", "廚房"] },
    { key: "office", name: "行政服務中心", icon: "🏛️", category: "行政服務", w: 10, h: 9, facilities: ["行政辦公室", "服務櫃台"] },
    { key: "park", name: "綠地公園", icon: "🌳", category: "生活服務", w: 10, h: 9, color: "#6fbf73", facilities: ["草地", "休憩座椅"] },
    { key: "solar", name: "太陽能車棚", icon: "☀️", category: "生活服務", w: 9, h: 6, color: "#5d7fa8", facilities: ["太陽能板", "自行車停車"] },
  ];

  var MISSIONS = [
    { text: "移動任一棟建築", need: 1, get: function (s) { return s.moved; } },
    { text: "新增 3 棟新建築", need: 3, get: function (s) { return s.added; } },
    { text: "拆除一棟 50 年以上建築", need: 1, get: function (s) { return s.demolishedOld; } },
    { text: "在空地上完成重建", need: 1, get: function (s) { return s.rebuilt; } },
    { text: "完成 3 棟老建築的更新（拆除後重建）", need: 3, get: function (s) { return s.renewedOld; } },
  ];

  /* ---------------- 工具函式 ---------------- */
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function deepFreeze(obj) {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
    });
    return Object.freeze(obj);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }
  function round1(n) {
    return Math.round(n * 10) / 10;
  }
  function $(id) {
    return document.getElementById(id);
  }

  /* ---------------- 唯讀原始資料 ---------------- */
  // 讀取導覽頁的原有資料 P（只讀，不修改），轉成結構化物件後深層凍結。
  var sourceRows = typeof P !== "undefined" && Array.isArray(P) ? P : [];
  var originalCampusData = deepFreeze({
    version: SCHEMA_VERSION,
    buildings: sourceRows.map(function (row, i) {
      var fp = FOOTPRINTS[row[0]] || [row[3], row[4], 10, 10];
      return {
        id: "o" + i,
        origId: "o" + i,
        source: "original",
        name: row[0],
        en: row[1],
        category: row[2],
        x: row[3],
        y: row[4],
        origX: row[3],
        origY: row[4],
        dx: round1(fp[0] - row[3]),
        dy: round1(fp[1] - row[4]),
        w: fp[2],
        h: fp[3],
        icon: "",
        facilities: String(row[5]).split("、"),
        age50: OLD_BUILDINGS.indexOf(row[0]) !== -1,
      };
    }),
  });

  function createFreshGame() {
    // 每次都從唯讀原始資料建立「全新的深層副本」
    return {
      version: SCHEMA_VERSION,
      nextId: 1,
      buildings: deepClone(originalCampusData.buildings),
      lots: [],
      stats: { added: 0, demolished: 0, demolishedOld: 0, moved: 0, rebuilt: 0, renewedOld: 0 },
      log: [],
    };
  }

  function isValidGame(d) {
    if (!d || typeof d !== "object" || d.version !== SCHEMA_VERSION) return false;
    if (!Array.isArray(d.buildings) || !Array.isArray(d.lots) || !d.stats || !Array.isArray(d.log)) return false;
    var okB = d.buildings.every(function (b) {
      return b && typeof b.id === "string" && typeof b.name === "string" &&
        isFinite(b.x) && isFinite(b.y) && isFinite(b.w) && isFinite(b.h);
    });
    var okL = d.lots.every(function (l) {
      return l && typeof l.id === "string" && isFinite(l.x) && isFinite(l.y);
    });
    return okB && okL;
  }

  function loadGame() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      return isValidGame(saved && saved.data) ? saved.data : null;
    } catch (e) {
      return null;
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), data: gameCampusData }),
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------- 遊戲狀態 ---------------- */
  var gameCampusData = null;
  var undoStack = [];
  var redoStack = [];
  var ui = {
    tool: "select", // select | add | move | demolish
    pending: null, // 建築選單中選擇的 catalog key
    selected: null, // { kind: "building" | "lot", id }
    showAge: false,
  };
  var els = {};
  var initialized = false;

  function findBuilding(id) {
    for (var i = 0; i < gameCampusData.buildings.length; i++) {
      if (gameCampusData.buildings[i].id === id) return gameCampusData.buildings[i];
    }
    return null;
  }
  function findLot(id) {
    for (var i = 0; i < gameCampusData.lots.length; i++) {
      if (gameCampusData.lots[i].id === id) return gameCampusData.lots[i];
    }
    return null;
  }
  function catalogItem(key) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].key === key) return CATALOG[i];
    return null;
  }
  function art(kind, withPlate) {
    if (!window.YMBuildingArt) return "🏢";
    return window.YMBuildingArt.svg(kind, { plate: !!withPlate });
  }
  function artFor(b, withPlate) {
    var kind = b.kind && catalogItem(b.kind) ? b.kind
      : window.YMBuildingArt ? window.YMBuildingArt.kindForCategory(b.category) : "classroom";
    return art(kind, withPlate);
  }
  function isMoved(b) {
    return b.source === "original" && (b.x !== b.origX || b.y !== b.origY);
  }
  function hasSprite(b) {
    return b.source !== "original" || isMoved(b);
  }
  function uniqueName(base) {
    var names = gameCampusData.buildings.map(function (b) { return b.name; });
    if (names.indexOf(base) === -1) return base;
    for (var n = 2; ; n++) if (names.indexOf(base + " " + n) === -1) return base + " " + n;
  }
  function newId(prefix) {
    return prefix + gameCampusData.nextId++;
  }
  function addLog(text) {
    gameCampusData.log.unshift(text);
    if (gameCampusData.log.length > 30) gameCampusData.log.length = 30;
  }

  /* 所有會改變遊戲地圖的動作都透過 commit，支援復原／重做並自動儲存 */
  function commit(mutator) {
    var before = JSON.stringify(gameCampusData);
    mutator(gameCampusData);
    undoStack.push(before);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    persist();
    render();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(gameCampusData));
    gameCampusData = JSON.parse(undoStack.pop());
    persist();
    render();
    say("已復原上一步。");
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(gameCampusData));
    gameCampusData = JSON.parse(redoStack.pop());
    persist();
    render();
    say("已重做。");
  }

  /* ---------------- 遊戲動作 ---------------- */
  function demolish(id) {
    var b = findBuilding(id);
    if (!b) return;
    // 只有「原圖上的建築（原位）」或「蓋在空地上的重建建築」拆除後才會留下空地；
    // 玩家自行新增、或已遷移的建築，拆掉後底下就是原本地面，不另外產生空地圖示。
    var leavesLot = b.source === "rebuilt" || (b.source === "original" && !isMoved(b));
    ui.selected = null;
    commit(function (d) {
      var idx = d.buildings.indexOf(findBuilding(id));
      var target = d.buildings[idx];
      d.buildings.splice(idx, 1);
      if (leavesLot) {
        d.lots.push({
          id: newId("l"),
          x: round1(target.x + target.dx),
          y: round1(target.y + target.dy),
          w: target.w,
          h: target.h,
          former: target.name,
          age50: !!target.age50,
        });
      }
      d.stats.demolished++;
      if (target.age50) d.stats.demolishedOld++;
      addLog("拆除「" + target.name + "」" + (leavesLot ? "，留下一塊空地" : ""));
    });
    say(leavesLot
      ? "已拆除「" + b.name + "」。點選空地可以重建，或按「復原」取消。"
      : "已拆除「" + b.name + "」。");
  }

  function clearLots(lotId) {
    var count = lotId ? (findLot(lotId) ? 1 : 0) : gameCampusData.lots.length;
    if (!count) {
      say("目前地圖上沒有空地圖示。");
      return;
    }
    ui.selected = null;
    commit(function (d) {
      d.lots = lotId ? d.lots.filter(function (l) { return l.id !== lotId; }) : [];
      addLog(lotId ? "清除 1 塊空地圖示" : "清除全部 " + count + " 塊空地圖示");
    });
    say("已清除 " + count + " 塊空地圖示（可按「復原」取回）。整地後的地面仍會保留。");
  }

  function moveBuilding(id, x, y) {
    var b = findBuilding(id);
    if (!b || (b.x === x && b.y === y)) return;
    commit(function (d) {
      var t = findBuilding(id);
      var leavingOriginalSite = t.source === "original" && !isMoved(t);
      if (leavingOriginalSite) {
        // 原有建築第一次遷出時，原址成為可重建的空地
        d.lots.push({
          id: newId("l"),
          x: round1(t.origX + t.dx),
          y: round1(t.origY + t.dy),
          w: t.w,
          h: t.h,
          former: t.name + "舊址",
          age50: false,
        });
      }
      t.x = x;
      t.y = y;
      d.stats.moved++;
      addLog("移動「" + t.name + "」");
    });
    say("已移動「" + b.name + "」。");
  }

  function placeNew(key, x, y) {
    var item = catalogItem(key);
    if (!item) return;
    var name;
    commit(function (d) {
      name = uniqueName(item.name);
      var id = newId("n");
      d.buildings.push({
        id: id, origId: null, source: "new", kind: item.key, name: name, en: "New Building",
        category: item.category, x: x, y: y, origX: x, origY: y, dx: 0, dy: 0,
        w: item.w, h: item.h, icon: item.icon, color: item.color || null,
        facilities: item.facilities.slice(), age50: false,
      });
      d.stats.added++;
      addLog("新增「" + name + "」");
      ui.selected = { kind: "building", id: id };
    });
    say("已新增「" + name + "」。");
  }

  function rebuild(lotId, key) {
    var lot = findLot(lotId);
    var item = catalogItem(key);
    if (!lot || !item) return;
    var name;
    commit(function (d) {
      var l = findLot(lotId);
      d.lots.splice(d.lots.indexOf(l), 1);
      name = uniqueName(item.name);
      var id = newId("n");
      d.buildings.push({
        id: id, origId: null, source: "rebuilt", kind: item.key, name: name, en: "Rebuilt",
        category: item.category, x: l.x, y: l.y, origX: l.x, origY: l.y, dx: 0, dy: 0,
        w: l.w, h: l.h, icon: item.icon, color: item.color || null,
        facilities: item.facilities.slice(), age50: false, replaces: l.former,
      });
      d.stats.rebuilt++;
      if (l.age50) d.stats.renewedOld++;
      addLog("在「" + l.former + "」空地重建「" + name + "」");
      ui.selected = { kind: "building", id: id };
    });
    ui.pending = null;
    say("已在空地完成重建：「" + name + "」。");
  }

  /* 網頁內建確認視窗：不使用 window.confirm()，
     因為部分瀏覽器（App 內建瀏覽器、預覽視窗）會封鎖它並直接回傳「取消」。 */
  function confirmDialog(message, okText, onOk) {
    var old = document.getElementById("bConfirm");
    if (old) old.remove();
    var lastFocus = document.activeElement;
    var wrap = document.createElement("div");
    wrap.id = "bConfirm";
    wrap.className = "b-modal";
    wrap.innerHTML =
      '<div class="b-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="bConfirmTitle" aria-describedby="bConfirmMsg">' +
      '<h3 id="bConfirmTitle">恢復原始校園</h3>' +
      '<p id="bConfirmMsg">' + esc(message) + "</p>" +
      '<div class="b-modal-actions">' +
      '<button type="button" class="b-btn" data-m="cancel">取消</button>' +
      '<button type="button" class="b-btn b-reset" data-m="ok">' + esc(okText) + "</button>" +
      "</div></div>";
    function close(ok) {
      document.removeEventListener("keydown", onKey, true);
      wrap.remove();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      if (ok) onOk();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Tab") {
        // 鍵盤焦點留在視窗內
        var btns = wrap.querySelectorAll("button");
        var first = btns[0], last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) return close(false);
      var b = e.target.closest("[data-m]");
      if (b) close(b.getAttribute("data-m") === "ok");
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-m="cancel"]').focus();
  }

  function resetGame() {
    confirmDialog(RESET_MESSAGE, "確定恢復", doReset);
  }

  function doReset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    gameCampusData = createFreshGame();
    undoStack = [];
    redoStack = [];
    ui.selected = null;
    ui.pending = null;
    ui.tool = "select";
    persist();
    render();
    say("遊戲地圖已恢復成原始校園配置，校園導覽地圖不受影響。");
  }

  function manualSave() {
    if (persist()) {
      var t = new Date();
      say("遊戲進度已儲存（" + t.getHours() + ":" + String(t.getMinutes()).padStart(2, "0") + "）。");
    } else {
      say("無法儲存：瀏覽器不允許使用本機儲存空間。");
    }
  }

  /* ---------------- 畫面 ---------------- */
  function say(msg) {
    if (els.status) els.status.textContent = msg;
  }

  function coverPatches() {
    // 原圖中的建築若已被拆除或遷出，用整地圖塊覆蓋其原始位置
    return originalCampusData.buildings.filter(function (o) {
      return !gameCampusData.buildings.some(function (b) {
        return b.origId === o.id && !isMoved(b);
      });
    });
  }

  function renderMap() {
    var html = "";
    coverPatches().forEach(function (o) {
      html += '<div class="b-patch" style="left:' + (o.x + o.dx) + "%;top:" + (o.y + o.dy) +
        "%;width:" + o.w + "%;height:" + o.h + '%"></div>';
    });
    gameCampusData.lots.forEach(function (l) {
      var sel = ui.selected && ui.selected.kind === "lot" && ui.selected.id === l.id;
      html += '<button type="button" class="b-lot' + (sel ? " b-sel" : "") + '" data-lot="' + esc(l.id) +
        '" aria-label="空地，原' + esc(l.former) + '，點選後可重建" style="left:' + l.x + "%;top:" + l.y +
        "%;width:" + l.w + "%;height:" + l.h + '%"><span>🚧 空地</span></button>';
    });
    gameCampusData.buildings.forEach(function (b) {
      if (!hasSprite(b)) return;
      var sel = ui.selected && ui.selected.kind === "building" && ui.selected.id === b.id;
      // 3D 等角建築：寬度依建築範圍，高度依圖示比例自動計算
      html += '<div class="b-sprite b-art' + (sel ? " b-sel" : "") + '" data-id="' + esc(b.id) + '" style="left:' +
        (b.x + b.dx) + "%;top:" + (b.y + b.dy) + "%;width:" + clamp(round1(b.w * 1.4), 14, 24) + '%">' +
        artFor(b) + "</div>";
    });
    gameCampusData.buildings.forEach(function (b) {
      var sel = ui.selected && ui.selected.kind === "building" && ui.selected.id === b.id;
      var old = ui.showAge && b.age50;
      // 與導覽地圖相同的白色標籤樣式（共用 .pin）
      html += '<button type="button" aria-label="選取' + esc(b.name) + '" data-id="' + esc(b.id) +
        '" data-label="' + esc(b.name) + '" class="pin' + (sel ? " on" : "") + (old ? " b-old" : "") +
        '" style="left:' + b.x + "%;top:" + b.y + '%"></button>';
    });
    els.layer.innerHTML = html;
    els.map.className = "map b-map b-tool-" + ui.tool;
  }

  function renderToolbar() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-tool") === ui.tool));
    });
    els.undo.disabled = !undoStack.length;
    els.redo.disabled = !redoStack.length;
    els.clearLots.disabled = !gameCampusData.lots.length;
    els.age.classList.toggle("b-on", ui.showAge);
    els.age.setAttribute("aria-pressed", String(ui.showAge));
  }

  function renderStats() {
    var d = gameCampusData;
    var oldStanding = d.buildings.filter(function (b) { return b.age50; }).length;
    els.stats.innerHTML =
      "<div><b>" + d.buildings.length + "</b>建築</div>" +
      "<div><b>" + d.lots.length + "</b>空地</div>" +
      "<div><b>" + oldStanding + "</b>50年以上</div>" +
      "<div><b>" + d.stats.added + "</b>新增</div>" +
      "<div><b>" + d.stats.demolished + "</b>拆除</div>" +
      "<div><b>" + d.stats.rebuilt + "</b>重建</div>";
  }

  function renderSelection() {
    var s = ui.selected;
    var html = "";
    if (s && s.kind === "building" && findBuilding(s.id)) {
      var b = findBuilding(s.id);
      var origin = b.source === "original" ? (isMoved(b) ? "原有建築（已遷移）" : "原有建築")
        : b.source === "rebuilt" ? "重建建築（原" + esc(b.replaces || "空地") + "）" : "新建建築";
      if (hasSprite(b)) html += '<div class="b-sel-art">' + artFor(b, true) + "</div>";
      html += "<h3>" + esc(b.name) + "</h3>";
      html += '<p><span class="b-badge">' + esc(b.category) + "</span> " +
        '<span class="b-badge">' + origin + "</span>" +
        (b.age50 ? ' <span class="b-badge b-old">屋齡 50 年以上</span>' : "") + "</p>";
      if (b.age50) html += "<p>此建築已使用超過 50 年，列入建議更新清單。是否拆除由你決定。</p>";
      html += '<div class="facilities">' + b.facilities.map(function (f) {
        return "<span>" + esc(f) + "</span>";
      }).join("") + "</div>";
      html += '<div class="b-actions">' +
        '<button type="button" class="b-btn" data-act="tool-move">✥ 移動這棟</button>' +
        '<button type="button" class="b-btn b-danger" data-act="demolish" data-id="' + esc(b.id) + '">🧨 拆除</button>' +
        "</div>";
    } else if (s && s.kind === "lot" && findLot(s.id)) {
      var l = findLot(s.id);
      html += "<h3>🚧 空地（原" + esc(l.former) + "）</h3>";
      html += "<p>請從下方「建築選單」點選要重建的建築，就會蓋在這塊空地上。</p>";
      html += '<div class="b-actions"><button type="button" class="b-btn" data-act="clear-lot" data-lot-id="' +
        esc(l.id) + '">🧹 清除這塊空地</button></div>';
    } else {
      ui.selected = null;
      html += "<h3>目前選取</h3><p>點選地圖上的建築或空地查看資訊。</p>";
    }
    els.selection.innerHTML = html;
  }

  function renderCatalog() {
    var lotSelected = ui.selected && ui.selected.kind === "lot";
    els.catalogHint.textContent = lotSelected
      ? "點選建築，在選取的空地上重建。"
      : "點選建築後，再點地圖上的位置放置。";
    els.catalog.innerHTML = CATALOG.map(function (c) {
      var on = !lotSelected && ui.tool === "add" && ui.pending === c.key;
      return '<button type="button" data-cat="' + c.key + '" aria-pressed="' + on + '" aria-label="' +
        esc(c.name) + '"><span class="b-cat-art">' + art(c.key, true) + '</span><span class="b-cat-name">' +
        esc(c.name) + "</span></button>";
    }).join("");
  }

  function renderRenewal() {
    var d = gameCampusData;
    var rows = originalCampusData.buildings.filter(function (o) { return o.age50; }).map(function (o) {
      var b = null;
      d.buildings.forEach(function (x) { if (x.origId === o.id) b = x; });
      var label = o.name === "行政樓" ? "行政大樓（行政樓）" : o.name;
      if (b) {
        return '<li><span>' + esc(label) + ' <span class="b-badge b-old">50+</span></span>' +
          '<button type="button" data-locate="' + esc(b.id) + '">查看</button></li>';
      }
      var renewed = d.buildings.some(function (x) { return x.replaces === o.name; });
      return "<li><span>" + esc(label) + "</span>" + (renewed
        ? '<span class="b-badge b-done">已更新</span>'
        : '<span class="b-badge b-gone">已拆除・待重建</span>') + "</li>";
    });
    els.renewal.innerHTML = rows.join("");
  }

  function renderMissions() {
    var s = gameCampusData.stats;
    els.missions.innerHTML = MISSIONS.map(function (m) {
      var v = Math.min(m.need, m.get(s) || 0);
      var done = v >= m.need;
      return "<li><span>" + (done ? "✅ " : "⬜ ") + esc(m.text) + "</span>" +
        '<span class="b-badge' + (done ? " b-done" : "") + '">' + v + "/" + m.need + "</span></li>";
    }).join("");
  }

  function renderLog() {
    els.log.innerHTML = gameCampusData.log.length
      ? gameCampusData.log.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("")
      : "<li>尚無變更，地圖與原始校園相同。</li>";
  }

  function render() {
    if (!initialized) return;
    renderMap();
    renderToolbar();
    renderStats();
    renderSelection();
    renderCatalog();
    renderRenewal();
    renderMissions();
    renderLog();
  }

  /* ---------------- 互動 ---------------- */
  function setTool(tool) {
    ui.tool = tool;
    if (tool !== "add") ui.pending = null;
    var tips = {
      select: "選取：點選建築或空地查看資訊。",
      add: "新增：先在建築選單選擇建築，再點地圖放置。",
      move: "移動：按住建築標籤拖曳到新位置。",
      demolish: "拆除：點選要拆除的建築（可按復原取消）。",
    };
    say(tips[tool]);
    render();
  }

  function pointToPercent(evt) {
    var r = els.map.getBoundingClientRect();
    return {
      x: round1(clamp(((evt.clientX - r.left) / r.width) * 100, 2, 98)),
      y: round1(clamp(((evt.clientY - r.top) / r.height) * 100, 2, 98)),
    };
  }

  function activateBuilding(id) {
    if (ui.tool === "demolish") {
      demolish(id);
      return;
    }
    ui.selected = { kind: "building", id: id };
    render();
  }

  function activateLot(id) {
    ui.selected = { kind: "lot", id: id };
    if (ui.tool === "add" && ui.pending) {
      rebuild(id, ui.pending);
      return;
    }
    if (ui.tool !== "select") ui.tool = "select";
    render();
    say("已選取空地，請從建築選單選擇要重建的建築。");
  }

  var drag = null;
  var suppressClickUntil = 0;

  function onPointerDown(e) {
    var target = e.target.closest("[data-id]");
    if (!target || !els.layer.contains(target) || e.button > 0) return;
    var b = findBuilding(target.getAttribute("data-id"));
    if (!b) return;
    var p = pointToPercent(e);
    drag = {
      id: b.id, startX: e.clientX, startY: e.clientY,
      offX: b.x - p.x, offY: b.y - p.y, moved: false, x: b.x, y: b.y, el: target,
    };
    if (ui.tool === "move") {
      try { target.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
  }

  function onPointerMove(e) {
    if (!drag || ui.tool !== "move") return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    var p = pointToPercent(e);
    drag.x = round1(clamp(p.x + drag.offX, 2, 98));
    drag.y = round1(clamp(p.y + drag.offY, 2, 98));
    var b = findBuilding(drag.id);
    Array.prototype.forEach.call(els.layer.querySelectorAll('[data-id="' + drag.id + '"]'), function (el) {
      if (el.classList.contains("pin")) {
        el.style.left = drag.x + "%";
        el.style.top = drag.y + "%";
        el.classList.add("b-dragging");
      } else {
        el.style.left = drag.x + b.dx + "%";
        el.style.top = drag.y + b.dy + "%";
      }
    });
  }

  function onPointerUp(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    // 這次指標操作已處理，忽略隨後瀏覽器補發的 click，避免誤觸放置／取消選取
    suppressClickUntil = Date.now() + 500;
    if (d.moved) {
      ui.selected = { kind: "building", id: d.id };
      moveBuilding(d.id, d.x, d.y);
      render();
    } else if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) {
      activateBuilding(d.id);
    }
  }

  function onMapClick(e) {
    if (e.detail !== 0 && Date.now() < suppressClickUntil) return;
    var lot = e.target.closest("[data-lot]");
    if (lot) {
      activateLot(lot.getAttribute("data-lot"));
      return;
    }
    var bEl = e.target.closest("[data-id]");
    if (bEl) {
      // 滑鼠／觸控點擊已由 pointer 事件處理；鍵盤（Enter/空白鍵）觸發時 detail 為 0
      if (e.detail === 0) activateBuilding(bEl.getAttribute("data-id"));
      return;
    }
    if (ui.tool === "add") {
      if (!ui.pending) {
        say("請先在建築選單選擇要新增的建築。");
        return;
      }
      var p = pointToPercent(e);
      placeNew(ui.pending, p.x, p.y);
    } else if (ui.selected) {
      ui.selected = null;
      render();
    }
  }

  function bindEvents() {
    els.map.addEventListener("pointerdown", onPointerDown);
    els.map.addEventListener("pointermove", onPointerMove);
    els.map.addEventListener("pointerup", onPointerUp);
    els.map.addEventListener("pointercancel", function () {
      drag = null;
      render();
    });
    els.map.addEventListener("click", onMapClick);

    $("bToolbar").addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-tool")) setTool(t.getAttribute("data-tool"));
      else if (t.id === "bUndo") undo();
      else if (t.id === "bRedo") redo();
      else if (t.id === "bSave") manualSave();
      else if (t.id === "bClearLots") clearLots(null);
      else if (t.id === "bReset") resetGame();
      else if (t.id === "bAge") {
        ui.showAge = !ui.showAge;
        say(ui.showAge ? "已顯示屋齡圖層：黃色標籤為 50 年以上建築。" : "已隱藏屋齡圖層。");
        render();
      } else if (t.id === "bBack") setMode("guide", true);
    });

    els.panel.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-cat")) {
        var key = t.getAttribute("data-cat");
        if (ui.selected && ui.selected.kind === "lot" && findLot(ui.selected.id)) {
          rebuild(ui.selected.id, key);
        } else {
          ui.tool = "add";
          ui.pending = key;
          render();
          say("已選擇「" + catalogItem(key).name + "」，請點地圖上的位置放置。");
        }
      } else if (t.getAttribute("data-act") === "demolish") {
        demolish(t.getAttribute("data-id"));
      } else if (t.getAttribute("data-act") === "clear-lot") {
        clearLots(t.getAttribute("data-lot-id"));
      } else if (t.getAttribute("data-act") === "tool-move") {
        setTool("move");
      } else if (t.hasAttribute("data-locate")) {
        ui.selected = { kind: "building", id: t.getAttribute("data-locate") };
        render();
        els.map.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    document.addEventListener("keydown", function (e) {
      if (els.root.hidden) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }
    });
  }

  function initBuilder() {
    if (initialized) return;
    els = {
      root: $("builderMode"),
      map: $("bMap"),
      layer: $("bLayer"),
      panel: $("bPanel"),
      status: $("bStatus"),
      stats: $("bStats"),
      selection: $("bSelection"),
      catalog: $("bCatalog"),
      catalogHint: $("bCatalogHint"),
      renewal: $("bRenewal"),
      missions: $("bMissions"),
      log: $("bLog"),
      undo: $("bUndo"),
      redo: $("bRedo"),
      clearLots: $("bClearLots"),
      age: $("bAge"),
    };
    var saved = loadGame();
    gameCampusData = saved || createFreshGame();
    initialized = true;
    bindEvents();
    render();
    say(saved ? "已載入上次儲存的遊戲進度。" : "這是一份與校園導覽相同的地圖副本，開始規劃你的校園吧！");
  }

  /* ---------------- 模式切換（不重新導向、不重新載入） ---------------- */
  function setMode(mode, updateHash) {
    var game = mode === "builder";
    $("guideMode").hidden = game;
    $("guideTasks").hidden = game;
    $("builderMode").hidden = !game;
    $("tabGuide").setAttribute("aria-selected", String(!game));
    $("tabBuilder").setAttribute("aria-selected", String(game));
    if (game) initBuilder();
    if (updateHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", game ? "#builder" : window.location.pathname + window.location.search);
    }
  }

  $("tabGuide").addEventListener("click", function () { setMode("guide", true); });
  $("tabBuilder").addEventListener("click", function () { setMode("builder", true); });
  setMode(window.location.hash === "#builder" ? "builder" : "guide", false);

  // 方便除錯檢查（唯讀）
  window.YMCampusBuilder = Object.freeze({
    STORAGE_KEY: STORAGE_KEY,
    originalCampusData: originalCampusData,
    getGameCampusData: function () { return gameCampusData ? deepClone(gameCampusData) : null; },
  });
})();
