/* =========================================================
   YM Campus GO － 校園建設遊戲：3D 等角（isometric）建築圖示
   以 SVG 繪製，不需要任何圖片檔。只供遊戲使用，與導覽頁無關。
   用法：YMBuildingArt.svg("classroom", { plate: true })
   ========================================================= */
(function () {
  "use strict";

  var C = 0.866;
  var S = 0.5;
  var OX = 60;
  var OY = 34;
  var VIEWBOX = "16 2 88 80";
  var LINE = ' stroke="#1d2f3a" stroke-width="0.55" stroke-linejoin="round"';

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var rgb = [n >> 16, (n >> 8) & 255, n & 255];
    var t = amt < 0 ? 0 : 255;
    var f = Math.abs(amt);
    rgb = rgb.map(function (c) { return Math.round(c + (t - c) * f); });
    return "#" + ((1 << 24) | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]).toString(16).slice(1);
  }
  function pt(x, y, z) {
    return (OX + (x - y) * C).toFixed(1) + "," + (OY + (x + y) * S - z).toFixed(1);
  }
  function xy(x, y, z) {
    return [OX + (x - y) * C, OY + (x + y) * S - z];
  }
  function poly(pts, fill, extra) {
    return '<polygon points="' + pts.map(function (q) { return pt(q[0], q[1], q[2]); }).join(" ") +
      '" fill="' + fill + '"' + (extra === undefined ? LINE : extra) + "/>";
  }

  /* 立方體：右面（x = x+w）、左面（y = y+d）、頂面 */
  function box(x, y, z, w, d, h, col, topCol) {
    return (
      poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], shade(col, -0.28)) +
      poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], shade(col, -0.06)) +
      poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], topCol || shade(col, 0.3))
    );
  }
  /* 左面窗戶格 */
  function winsL(x, yFace, z, w, h, cols, rows, col) {
    var out = "";
    var gx = w / cols;
    var gz = h / rows;
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var a = x + gx * i + gx * 0.22;
        var b = z + gz * j + gz * 0.28;
        out += poly([[a, yFace, b], [a + gx * 0.56, yFace, b], [a + gx * 0.56, yFace, b + gz * 0.5], [a, yFace, b + gz * 0.5]], col, "");
      }
    }
    return out;
  }
  /* 右面窗戶格 */
  function winsR(xFace, y, z, d, h, cols, rows, col) {
    var out = "";
    var gy = d / cols;
    var gz = h / rows;
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var a = y + gy * i + gy * 0.22;
        var b = z + gz * j + gz * 0.28;
        out += poly([[xFace, a, b], [xFace, a + gy * 0.56, b], [xFace, a + gy * 0.56, b + gz * 0.5], [xFace, a, b + gz * 0.5]], col, "");
      }
    }
    return out;
  }
  function shadow(x, y, w, d) {
    return poly([[x + 2, y + 2, 0], [x + w + 4, y + 2, 0], [x + w + 4, y + d + 4, 0], [x + 2, y + d + 4, 0]], "#0b1e2a", ' opacity="0.22"');
  }
  function plate(col) {
    return poly([[-2, -2, 0], [42, -2, 0], [42, 42, 0], [-2, 42, 0]], col || "#dfe8e3", ' stroke="#b7c6bf" stroke-width="0.6"') +
      poly([[42, -2, 0], [42, 42, 0], [42, 42, -2.5], [42, -2, -2.5]], shade(col || "#dfe8e3", -0.3), "") +
      poly([[-2, 42, 0], [42, 42, 0], [42, 42, -2.5], [-2, 42, -2.5]], shade(col || "#dfe8e3", -0.15), "");
  }
  function tree(x, y, r, col) {
    var base = xy(x, y, 0);
    var top = xy(x, y, r * 1.6);
    return (
      '<ellipse cx="' + (base[0] + 1).toFixed(1) + '" cy="' + (base[1] + 0.5).toFixed(1) + '" rx="' + (r * 0.9).toFixed(1) + '" ry="' + (r * 0.45).toFixed(1) + '" fill="#0b1e2a" opacity="0.2"/>' +
      '<rect x="' + (base[0] - 0.7).toFixed(1) + '" y="' + (top[1]).toFixed(1) + '" width="1.4" height="' + (base[1] - top[1]).toFixed(1) + '" fill="#7a5532"/>' +
      '<circle cx="' + top[0].toFixed(1) + '" cy="' + top[1].toFixed(1) + '" r="' + r + '" fill="' + (col || "#4fa35a") + '" stroke="#1d2f3a" stroke-width="0.5"/>' +
      '<circle cx="' + (top[0] - r * 0.3).toFixed(1) + '" cy="' + (top[1] - r * 0.3).toFixed(1) + '" r="' + (r * 0.45).toFixed(1) + '" fill="#ffffff" opacity="0.25"/>'
    );
  }

  /* ---------------- 各種建築造型 ---------------- */
  var BUILDERS = {
    // 新教學大樓：四層磚紅教學樓＋屋頂水塔＋入口
    classroom: function () {
      return shadow(2, 10, 36, 20) +
        box(2, 10, 0, 36, 20, 26, "#e39a62", "#f3d1ad") +
        winsL(2, 30.05, 3, 36, 23, 6, 4, "#2f5f80") +
        winsR(38.05, 10, 3, 20, 23, 3, 4, "#2a5470") +
        poly([[17, 30.1, 0], [23, 30.1, 0], [23, 30.1, 6], [17, 30.1, 6]], "#f6c84c") +
        box(26, 13, 26, 6, 6, 5, "#9aa7ae") +
        box(6, 13, 26, 9, 5, 2, "#c9d2d6");
    },
    // 智慧圖書館：米白主體、玻璃帶狀立面、玻璃金字塔天窗
    library: function () {
      return shadow(4, 4, 32, 32) +
        box(4, 4, 0, 32, 32, 16, "#efe2c8", "#f8f1e2") +
        poly([[6, 36.05, 4], [34, 36.05, 4], [34, 36.05, 12], [6, 36.05, 12]], "#7fc4df") +
        poly([[36.05, 6, 4], [36.05, 34, 4], [36.05, 34, 12], [36.05, 6, 12]], "#5ea8c6") +
        poly([[12, 36.1, 4], [12.6, 36.1, 4], [12.6, 36.1, 12], [12, 36.1, 12]], "#e9f6fb", "") +
        poly([[24, 36.1, 4], [24.6, 36.1, 4], [24.6, 36.1, 12], [24, 36.1, 12]], "#e9f6fb", "") +
        poly([[10, 30, 16], [30, 30, 16], [20, 20, 28]], "#9fdcf0") +
        poly([[30, 10, 16], [30, 30, 16], [20, 20, 28]], "#6cb9d6") +
        poly([[17, 36.1, 0], [23, 36.1, 0], [23, 36.1, 4], [17, 36.1, 4]], "#8a5a3c");
    },
    // 科學實驗樓：薄荷綠主體、屋頂排氣塔與天文觀測圓頂
    lab: function () {
      var dome = xy(13, 15, 22);
      return shadow(5, 6, 30, 26) +
        box(5, 6, 0, 30, 26, 22, "#a9dcc4", "#dff3e9") +
        winsL(5, 32.05, 3, 30, 18, 5, 3, "#2f6a74") +
        winsR(35.05, 6, 3, 26, 18, 4, 3, "#285b63") +
        box(25, 10, 22, 5, 5, 9, "#b8c2c7") +
        box(26, 19, 22, 3, 3, 13, "#d0d6da") +
        '<path d="M' + (dome[0] - 7).toFixed(1) + "," + dome[1].toFixed(1) + " a7,7 0 0 1 14,0 z" + '" fill="#e8eef2"' + LINE + "/>" +
        '<rect x="' + (dome[0] - 1).toFixed(1) + '" y="' + (dome[1] - 7).toFixed(1) + '" width="2" height="7" fill="#2f4858"/>' +
        poly([[18, 32.1, 0], [23, 32.1, 0], [23, 32.1, 5], [18, 32.1, 5]], "#f6c84c");
    },
    // 多功能體育館：紅磚牆＋銀色拱形屋頂
    gym: function () {
      var x = 2, y = 5, w = 36, d = 30, H = 12, A = 10, N = 12;
      var out = shadow(x, y, w, d) + box(x, y, 0, w, d, H, "#d46f5f", "#d46f5f");
      out += winsL(x, y + d + 0.05, 2, w, 9, 6, 1, "#f7e2b5");
      for (var i = 0; i < N; i++) {
        var t0 = i / N, t1 = (i + 1) / N;
        var z0 = H + A * Math.sin(Math.PI * t0), z1 = H + A * Math.sin(Math.PI * t1);
        var light = 0.15 + 0.4 * t0;
        out += poly([[x, y + d * t0, z0], [x + w, y + d * t0, z0], [x + w, y + d * t1, z1], [x, y + d * t1, z1]], shade("#9fb0bb", light), ' stroke="#1d2f3a" stroke-width="0.3"');
      }
      var end = [[x + w, y, H]];
      for (var k = 0; k <= N; k++) end.push([x + w, y + d * (k / N), H + A * Math.sin(Math.PI * (k / N))]);
      end.push([x + w, y + d, H]);
      out += poly(end, "#b54f42");
      out += poly([[x + w + 0.05, y + 11, 0], [x + w + 0.05, y + 19, 0], [x + w + 0.05, y + 19, 7], [x + w + 0.05, y + 11, 7]], "#f6c84c");
      return out;
    },
    // 學生餐廳：奶油色建築、紅白條紋遮陽棚、戶外陽傘座位
    cafeteria: function () {
      var out = shadow(6, 4, 30, 22) +
        box(6, 4, 0, 30, 22, 12, "#f3dcae", "#e98b5c") +
        winsL(6, 26.05, 1, 30, 7, 4, 1, "#4c86a6") +
        winsR(36.05, 4, 2, 22, 8, 3, 1, "#3f7290");
      for (var i = 0; i < 6; i++) {
        var a = 6 + i * 5;
        out += poly([[a, 26, 10], [a + 5, 26, 10], [a + 5, 30, 7.5], [a, 30, 7.5]], i % 2 ? "#ffffff" : "#e2483f", ' stroke="#1d2f3a" stroke-width="0.3"');
      }
      [[12, 35], [24, 35], [34, 33]].forEach(function (q) {
        var top = xy(q[0], q[1], 7);
        var base = xy(q[0], q[1], 0);
        out += '<rect x="' + (base[0] - 0.4).toFixed(1) + '" y="' + top[1].toFixed(1) + '" width="0.8" height="' + (base[1] - top[1]).toFixed(1) + '" fill="#555"/>' +
          '<ellipse cx="' + top[0].toFixed(1) + '" cy="' + top[1].toFixed(1) + '" rx="4.5" ry="2.2" fill="#17a49b" stroke="#1d2f3a" stroke-width="0.4"/>';
      });
      return out;
    },
    // 行政服務中心：白色建築、立柱門廊、灰藍斜屋頂、旗桿
    office: function () {
      var flagBase = xy(20, 2, 0);
      var flagTop = xy(20, 2, 34);
      var out = shadow(4, 8, 32, 24) +
        box(4, 8, 0, 32, 24, 18, "#f2efe7", "#f2efe7") +
        winsR(36.05, 8, 3, 24, 13, 4, 2, "#3f6f8f");
      for (var i = 0; i < 6; i++) {
        var a = 6 + i * 5.4;
        out += poly([[a, 32.05, 0], [a + 1.6, 32.05, 0], [a + 1.6, 32.05, 14], [a, 32.05, 14]], "#ffffff", ' stroke="#9aa5ab" stroke-width="0.3"');
        if (i < 5) out += poly([[a + 2.4, 32.05, 3], [a + 4.4, 32.05, 3], [a + 4.4, 32.05, 11], [a + 2.4, 32.05, 11]], "#3f6f8f", "");
      }
      out += poly([[4, 8, 18], [36, 8, 18], [36, 20, 26], [4, 20, 26]], "#7f97a8");
      out += poly([[4, 20, 26], [36, 20, 26], [36, 32, 18], [4, 32, 18]], "#5d7486");
      out += poly([[36, 8, 18], [36, 32, 18], [36, 20, 26]], "#e4e0d6");
      out += '<line x1="' + flagBase[0].toFixed(1) + '" y1="' + flagBase[1].toFixed(1) + '" x2="' + flagTop[0].toFixed(1) + '" y2="' + flagTop[1].toFixed(1) + '" stroke="#5b6870" stroke-width="0.8"/>' +
        '<path d="M' + flagTop[0].toFixed(1) + "," + flagTop[1].toFixed(1) + " l8,1.5 l-8,3.5 z" + '" fill="#ef5a58"/>';
      return out;
    },
    // 綠地公園：草坪、步道、水池、樹木與長椅
    park: function () {
      var pond = xy(28, 12, 0);
      return poly([[0, 0, 0], [40, 0, 0], [40, 40, 0], [0, 40, 0]], "#93cf7c") +
        poly([[40, 0, 0], [40, 40, 0], [40, 40, -2], [40, 0, -2]], "#5f9a4c", "") +
        poly([[0, 40, 0], [40, 40, 0], [40, 40, -2], [0, 40, -2]], "#74b05f", "") +
        poly([[17, 0, 0], [23, 0, 0], [23, 40, 0], [17, 40, 0]], "#ecd9a8", "") +
        poly([[0, 22, 0], [40, 22, 0], [40, 27, 0], [0, 27, 0]], "#ecd9a8", "") +
        '<ellipse cx="' + pond[0].toFixed(1) + '" cy="' + pond[1].toFixed(1) + '" rx="9" ry="4.2" fill="#6ec3e6" stroke="#3b8fb3" stroke-width="0.6"/>' +
        box(28, 30, 0, 7, 2, 2, "#a8743f") +
        tree(6, 6, 4.5) + tree(8, 15, 3.8, "#5cb565") + tree(6, 34, 4.2) + tree(32, 36, 3.6, "#5cb565") + tree(36, 24, 3.2, "#3f9150");
    },
    // 太陽能車棚：支柱＋傾斜太陽能板＋停放的車輛
    solar: function () {
      var out = shadow(4, 6, 32, 26) +
        box(8, 14, 0, 8, 4, 3, "#ef5a58") + box(22, 14, 0, 8, 4, 3, "#f6c84c");
      [[5, 7, 15], [35, 7, 15], [5, 31, 9], [35, 31, 9]].forEach(function (q) {
        out += box(q[0], q[1], 0, 1, 1, q[2], "#8b979e");
      });
      out += poly([[3, 5, 16], [37, 5, 16], [37, 33, 10], [3, 33, 10]], "#2c5a96");
      for (var i = 1; i < 6; i++) {
        var xx = 3 + (34 / 6) * i;
        out += poly([[xx, 5, 16], [xx + 0.3, 5, 16], [xx + 0.3, 33, 10], [xx, 33, 10]], "#9cc3ef", "");
      }
      out += poly([[3, 19, 13], [37, 19, 13], [37, 19.4, 12.9], [3, 19.4, 12.9]], "#9cc3ef", "");
      out += poly([[37, 5, 16], [37, 33, 10], [37, 33, 9], [37, 5, 15]], "#1d3d66");
      return out;
    },
  };

  var CATEGORY_KIND = {
    "普通教室": "classroom",
    "專科教室": "lab",
    "行政服務": "office",
    "運動場館": "gym",
    "生活服務": "cafeteria",
  };

  /* 以 <img> + data URI 輸出：比直接嵌入 SVG 更穩定（地圖重繪時不會消失），且同一種建築只產生一次 */
  var cache = {};
  function svg(kind, opts) {
    if (!BUILDERS[kind]) kind = "classroom";
    var withPlate = !!(opts && opts.plate && kind !== "park");
    var key = kind + (withPlate ? ":plate" : "");
    if (!cache[key]) {
      var markup = '<svg viewBox="' + VIEWBOX + '" xmlns="http://www.w3.org/2000/svg">' +
        (withPlate ? plate() : "") + BUILDERS[kind]() + "</svg>";
      cache[key] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    }
    return '<img class="b-iso" alt="" draggable="false" src="' + cache[key] + '" />';
  }

  window.YMBuildingArt = Object.freeze({
    svg: svg,
    kindForCategory: function (category) { return CATEGORY_KIND[category] || "classroom"; },
  });
})();
