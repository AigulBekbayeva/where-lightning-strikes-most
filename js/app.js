/* Where Lightning Strikes Most — интерактивная карта.
   Данные: data/grid/*.bin (готовит scripts/prepare_data.py) и data/hotspots.json. */
(() => {
  "use strict";


  // ---------------------------------------------------------------- тексты (ru / en)
  const I18N = {
    ru: {
      locale: "ru-RU",
      layers: {
        frd: ["Молнии", "вспышек/км²/год"], tcwv: ["Водяной пар", "мм"], cape: ["Неустойчивость (CAPE)", "Дж/кг"],
        precip: ["Осадки", "мм/год"], elev: ["Рельеф суши", "м"], koppen: ["Зоны Кёппена", ""],
      },
      koppen: {
        1: { code: "Af", name: "Тропический влажный" }, 2: { code: "Am", name: "Тропический муссонный" },
        3: { code: "Aw", name: "Тропическая саванна" }, 4: { code: "BW", name: "Пустыня" },
        5: { code: "BS", name: "Степь, полупустыня" }, 6: { code: "C", name: "Умеренный" },
        7: { code: "D", name: "Континентальный" }, 8: { code: "E", name: "Полярный, высокогорный" },
      },
      ocean: "океан",
      zoneStr: kk => `${kk.code}, ${kk.name.toLowerCase()}`,
      coord: (lat, lon, f) => `${f(Math.abs(lat), 2)}° ${lat >= 0 ? "с. ш." : "ю. ш."}, ${f(Math.abs(lon), 2)}° ${lon >= 0 ? "в. д." : "з. д."}`,
      legendAria: (d, a, b) => `${d.name}, ${d.unit}: от ${a} до ${b}`,
      noGrid: "Слои сетки не загружены",
      ro: { frd: "Молнии", tcwv: "Водяной пар, мм", cape: "CAPE, Дж/кг", precip: "Осадки, мм/год", elev: "Высота, м", koppen: "Зона" },
      popupCell: (c, f, fa) => `Ячейка карты 0.5°: <b>${fa(c.frd)}</b> вспышек/км²/год, водяной пар ${f(c.tcwv, 0)} мм, CAPE ${f(c.cape, 0)} Дж/кг, ${Number.isFinite(c.elev) ? "высота " + f(c.elev, 0) + " м" : "над водой"}; зона ${c.koppen}.`,
      popupLis: "вспышек/км²/год (LIS, 0.1°)",
      showTable: "Показать таблицей",
      flashUnit: "вспышек/км²/год",
      meanDensity: "Средняя плотность",
      zone: "Зона",
      land: "Суша", oceanS: "Океан", latitude: "Широта",
      latTick: v => (v === 0 ? "0°" : `${Math.abs(v)}° ${v > 0 ? "с" : "ю"}`),
      bins: {
        tcwv: ["водяного пара", "Водяной пар, мм", "Водяной пар"],
        cape: ["неустойчивости (CAPE)", "CAPE, Дж/кг", "CAPE"],
        precip: ["осадков", "Осадки, мм/год", "Осадки"],
        elev: ["высоты рельефа", "Высота, м", "Высота"],
      },
      binnedCap: l => `Средняя плотность молний в зависимости от ${l}, 60° ю. ш. – 60° с. ш.`,
      landSea: (l, o, r) => `Между 35° ю. ш. и 35° с. ш. над сушей в среднем ${l} вспышки на км² в год, над океаном — ${o}, то есть примерно в ${r} раз меньше.`,
      generated: (d, m) => `Слои собраны ${d}; молнии ${m.period.lightning}, ERA5 ${m.period.era5}.`,
      sfx: "",
    },
    en: {
      locale: "en-US",
      layers: {
        frd: ["Lightning", "flashes/km²/yr"], tcwv: ["Water vapor", "mm"], cape: ["Instability (CAPE)", "J/kg"],
        precip: ["Precipitation", "mm/yr"], elev: ["Land elevation", "m"], koppen: ["Köppen climate zones", ""],
      },
      koppen: {
        1: { code: "Af", name: "Tropical rainforest" }, 2: { code: "Am", name: "Tropical monsoon" },
        3: { code: "Aw", name: "Tropical savanna" }, 4: { code: "BW", name: "Desert" },
        5: { code: "BS", name: "Steppe, semi-arid" }, 6: { code: "C", name: "Temperate" },
        7: { code: "D", name: "Continental" }, 8: { code: "E", name: "Polar and alpine" },
      },
      ocean: "ocean",
      zoneStr: kk => `${kk.code}, ${kk.name.toLowerCase()}`,
      coord: (lat, lon, f) => `${f(Math.abs(lat), 2)}° ${lat >= 0 ? "N" : "S"}, ${f(Math.abs(lon), 2)}° ${lon >= 0 ? "E" : "W"}`,
      legendAria: (d, a, b) => `${d.name}, ${d.unit}: ${a} to ${b}`,
      noGrid: "Grid layers are not loaded",
      ro: { frd: "Lightning", tcwv: "Water vapor, mm", cape: "CAPE, J/kg", precip: "Precipitation, mm/yr", elev: "Elevation, m", koppen: "Zone" },
      popupCell: (c, f, fa) => `Map cell (0.5°): <b>${fa(c.frd)}</b> flashes/km²/yr, water vapor ${f(c.tcwv, 0)} mm, CAPE ${f(c.cape, 0)} J/kg, ${Number.isFinite(c.elev) ? "elevation " + f(c.elev, 0) + " m" : "over water"}; zone ${c.koppen}.`,
      popupLis: "flashes/km²/yr (LIS, 0.1°)",
      showTable: "Show as table",
      flashUnit: "flashes/km²/yr",
      meanDensity: "Mean density",
      zone: "Zone",
      land: "Land", oceanS: "Ocean", latitude: "Latitude",
      latTick: v => (v === 0 ? "0°" : `${Math.abs(v)}° ${v > 0 ? "N" : "S"}`),
      bins: {
        tcwv: ["water vapor", "Water vapor, mm", "Water vapor"],
        cape: ["instability (CAPE)", "CAPE, J/kg", "CAPE"],
        precip: ["precipitation", "Precipitation, mm/yr", "Precipitation"],
        elev: ["elevation", "Elevation, m", "Elevation"],
      },
      binnedCap: l => `Mean lightning density by ${l}, 60° S – 60° N`,
      landSea: (l, o, r) => `Between 35° S and 35° N, land averages ${l} flashes per km² per year and the ocean ${o} — roughly ${r} times fewer.`,
      generated: (d, m) => `Layers built ${d}; lightning ${m.period.lightning}, ERA5 ${m.period.era5}.`,
      sfx: "_en",
    },
  };
  const T = I18N[(document.documentElement.lang || "ru").startsWith("en") ? "en" : "ru"];
  // поле горячей точки на языке страницы (place / place_en и т. п.)
  const hs = (h, f) => h[f + T.sfx] || h[f];

  const MERC_LAT = 85.0511287798;
  const NLAT = 360, NLON = 720, STEP = 0.5;

  // ---------------------------------------------------------------- палитры
  const RAMPS = {
    frd:    ["#1E1450", "#4B2AA8", "#8B3FC8", "#D2509E", "#F2865A", "#FBC864", "#FFF6C2"],
    tcwv:   ["#0E2440", "#164E80", "#2384B8", "#4FB4D6", "#9ADCE8", "#E2F7F8"],
    cape:   ["#26160E", "#6B2A10", "#B24A16", "#E27A2C", "#F8B266", "#FFE6B8"],
    precip: ["#14261C", "#1E5136", "#2F7F50", "#58AE6F", "#9BD69A", "#E2F6CF"],
    elev:   ["#2B3527", "#556147", "#8A8559", "#B49C70", "#D6C3A2", "#F6EEE2"],
  };
  const KOPPEN_COLORS = {
    1: "#1E40C0", 2: "#2F80E6", 3: "#71B8F2", 4: "#D63A2C",
    5: "#EEA22A", 6: "#3DAA58", 7: "#8C4FC4", 8: "#B9BEC9",
  };
  const KOPPEN_FALLBACK = T.koppen;

  const log10 = Math.log10;
  const LAYERS = {
    frd: {
      
      t: v => (v < 0.1 ? NaN : log10(v / 0.1) / log10(150 / 0.1)),
      ticks: [0.1, 1, 10, 50, 150], tickT: v => log10(v / 0.1) / log10(150 / 0.1),
      alpha: t => Math.min(1, 0.25 + t * 3),
    },
    tcwv: { t: v => v / 60, ticks: [0, 15, 30, 45, 60] },
    cape: { t: v => Math.sqrt(Math.max(v, 0) / 3000), ticks: [0, 250, 1000, 2000, 3000], sqrt: 3000 },
    precip: { t: v => Math.sqrt(Math.max(v, 0) / 5000), ticks: [0, 500, 1500, 3000, 5000], sqrt: 5000 },
    elev: { t: v => Math.sqrt(Math.max(v, 0) / 5000), ticks: [0, 300, 1000, 2500, 5000], sqrt: 5000, landOnly: true },
    koppen: { categorical: true },
  };
  for (const [k, [name, unit]] of Object.entries(T.layers)) Object.assign(LAYERS[k], { name, unit });
  LAYERS.tcwv.tickT = v => v / 60;
  for (const k of ["cape", "precip", "elev"]) LAYERS[k].tickT = v => Math.sqrt(v / LAYERS[k].sqrt);

  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function makeRamp(stops) {
    const rgb = stops.map(hexToRgb), n = rgb.length - 1;
    const lut = new Uint8ClampedArray(256 * 3);
    for (let k = 0; k < 256; k++) {
      const x = (k / 255) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
      for (let c = 0; c < 3; c++) lut[k * 3 + c] = rgb[i][c] + (rgb[i + 1][c] - rgb[i][c]) * f;
    }
    return t => { const k = Math.round(Math.max(0, Math.min(1, t)) * 255) * 3; return [lut[k], lut[k + 1], lut[k + 2]]; };
  }
  for (const [k, stops] of Object.entries(RAMPS)) LAYERS[k].color = makeRamp(stops);

  // ---------------------------------------------------------------- состояние
  const state = {
    layer: "frd", grid: null, meta: null, hotspots: [], koppen: KOPPEN_FALLBACK,
    contour: true, thr: 20, opacity: 0.85, binVar: "tcwv",
  };
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString(T.locale, { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");
  const fmtAuto = v => (!Number.isFinite(v) ? "—" : v >= 100 ? fmt(v, 0) : v >= 10 ? fmt(v, 1) : fmt(v, 2));

  const readHash = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const h0 = readHash();
  if (h0.layer && LAYERS[h0.layer]) state.layer = h0.layer;

  // ---------------------------------------------------------------- карта
  const map = L.map("map", {
    center: [h0.lat ? +h0.lat : 8, h0.lon ? +h0.lon : 15],
    zoom: h0.z ? +h0.z : 2, minZoom: 2, maxZoom: 9,
    maxBounds: [[-88, -220], [88, 220]], maxBoundsViscosity: 0.8, worldCopyJump: false,
    zoomSnap: 0.5,
  });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd", noWrap: true,
  }).addTo(map);
  map.createPane("labels-pane").style.zIndex = 450;
  map.getPane("labels-pane").classList.add("labels-pane");
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd", pane: "labels-pane", noWrap: true, opacity: 0.75,
  }).addTo(map);

  const BOUNDS = [[-MERC_LAT, -180], [MERC_LAT, 180]];
  const blank = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  const baseOverlay = L.imageOverlay(blank, BOUNDS, { className: "grid-overlay", opacity: state.opacity, interactive: false }).addTo(map);
  const contourOverlay = L.imageOverlay(blank, BOUNDS, { className: "grid-overlay", interactive: false }).addTo(map);
  const hotspotLayer = L.layerGroup().addTo(map);

  const persistView = () => {
    const c = map.getCenter();
    const p = new URLSearchParams({ layer: state.layer, lat: c.lat.toFixed(2), lon: c.lng.toFixed(2), z: map.getZoom() });
    history.replaceState(null, "", "#" + p);
    const ll = $("lang-link");
    if (ll) ll.href = ll.getAttribute("href").split("#")[0] + "#" + p;
  };
  map.on("moveend", persistView);

  // ---------------------------------------------------------------- сетка
  const cellIndex = (lat, lon) => {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const i = Math.floor((90 - lat) / STEP), j = Math.floor((lon + 180) / STEP);
    if (i < 0 || i >= NLAT || j < 0 || j >= NLON) return -1;
    return i * NLON + j;
  };
  const cellLat = i => 89.75 - i * STEP;

  async function loadGrid() {
    const meta = await fetch("data/grid/meta.json", { cache: "no-cache" }).then(r => {
      if (!r.ok) throw new Error("no meta");
      return r.json();
    });
    const grid = {};
    await Promise.all(Object.entries(meta.layers).map(async ([key, L_]) => {
      const buf = await fetch("data/grid/" + L_.file).then(r => { if (!r.ok) throw new Error(L_.file); return r.arrayBuffer(); });
      const u16 = new Uint16Array(buf), out = new Float32Array(u16.length);
      for (let k = 0; k < u16.length; k++) out[k] = u16[k] === 65535 ? NaN : L_.offset + u16[k] * L_.scale;
      grid[key] = out;
    }));
    return { meta, grid };
  }

  // equirect (720×360) → Web Mercator, пиксель-в-пиксель по ближайшей ячейке
  function mercRows(H) {
    const rows = new Float64Array(H);
    for (let y = 0; y < H; y++) {
      const n = Math.PI * (1 - (2 * (y + 0.5)) / H);
      rows[y] = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
    }
    return rows;
  }

  let urlBase = null, urlContour = null;
  function toOverlay(canvas, overlay, prevUrl, done) {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      overlay.setUrl(url);
      if (prevUrl) setTimeout(() => URL.revokeObjectURL(prevUrl), 1500);
      done(url);
    });
  }

  function renderBase() {
    const g = state.grid, Ldef = LAYERS[state.layer];
    if (!g) return;
    const data = g[state.layer], land = g.land;
    const W = 720, H = 720, lats = mercRows(H);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(W, H), px = img.data;
    const kc = {};
    for (const k in KOPPEN_COLORS) kc[k] = hexToRgb(KOPPEN_COLORS[k]);
    for (let y = 0; y < H; y++) {
      const i = Math.min(NLAT - 1, Math.floor((90 - lats[y]) / STEP));
      for (let x = 0; x < W; x++) {
        const idx = i * NLON + x, o = (y * W + x) * 4;
        const v = data[idx];
        if (!Number.isFinite(v)) continue;
        if (Ldef.categorical) {
          const c = kc[Math.round(v)];
          if (!c) continue;
          px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
          continue;
        }
        if (Ldef.landOnly && !(land[idx] >= 0.5)) continue;
        const t = Ldef.t(v);
        if (!Number.isFinite(t)) continue;
        const c = Ldef.color(t);
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
        px[o + 3] = Ldef.alpha ? 255 * Ldef.alpha(t) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    toOverlay(cv, baseOverlay, urlBase, u => (urlBase = u));
  }

  function renderContour() {
    const g = state.grid;
    if (!g || !state.contour) { contourOverlay.setUrl(blank); return; }
    const frd = g.frd, thr = state.thr, S = 3;
    const W = NLON * S, H = NLON * S, lats = mercRows(H);
    const above = new Uint8Array(NLAT * NLON);
    for (let k = 0; k < above.length; k++) above[k] = frd[k] >= thr ? 1 : 0;
    const at = (i, j) => (i < 0 || i >= NLAT ? 0 : above[i * NLON + ((j + NLON) % NLON)]);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(W, H), px = img.data;
    const ew = 1 / S; // ширина линии — 1 пиксель по горизонтали
    for (let y = 0; y < H; y++) {
      const fy = (90 - lats[y]) / STEP, i = Math.floor(fy), sy = fy - i;
      if (i < 0 || i >= NLAT) continue;
      const dl = y + 1 < H ? lats[y] - lats[y + 1] : lats[y - 1] - lats[y];
      const cpp = Math.max(ew, (dl / STEP) * 1.05);
      for (let x = 0; x < W; x++) {
        const j = Math.floor(x / S), sx = (x % S) / S;
        if (!above[i * NLON + j]) continue;
        const edge = (sx < ew && !at(i, j - 1)) || (sx >= 1 - ew && !at(i, j + 1)) ||
                     (sy < cpp && !at(i - 1, j)) || (sy >= 1 - cpp && !at(i + 1, j));
        if (!edge) continue;
        const o = (y * W + x) * 4;
        px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    toOverlay(cv, contourOverlay, urlContour, u => (urlContour = u));
  }

  // ---------------------------------------------------------------- легенда и слои
  function buildLayerList() {
    const box = $("layer-list");
    box.innerHTML = "";
    for (const [key, d] of Object.entries(LAYERS)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "layer-btn"; b.setAttribute("role", "radio");
      b.dataset.key = key;
      b.innerHTML = `<span class="dot"></span><span>${d.name}</span><span class="unit">${d.unit}</span>`;
      b.disabled = !state.grid;
      b.addEventListener("click", () => setLayer(key));
      box.appendChild(b);
    }
    syncLayerList();
  }
  function syncLayerList() {
    for (const b of $("layer-list").children) {
      const on = b.dataset.key === state.layer;
      b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1;
    }
  }
  $("layer-list").addEventListener("keydown", e => {
    if (!state.grid || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const keys = Object.keys(LAYERS), i = keys.indexOf(state.layer);
    const n = keys[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length];
    setLayer(n); $("layer-list").querySelector(`[data-key="${n}"]`).focus(); e.preventDefault();
  });

  function setLayer(key) {
    state.layer = key;
    syncLayerList(); renderLegend(); renderBase(); persistView();
  }

  function renderLegend() {
    const box = $("legend"), d = LAYERS[state.layer];
    box.innerHTML = "";
    if (!state.grid) return;
    if (d.categorical) {
      const cats = document.createElement("div"); cats.className = "cats";
      for (const [k, c] of Object.entries(KOPPEN_COLORS)) {
        const kk = state.koppen[k] || KOPPEN_FALLBACK[k];
        cats.insertAdjacentHTML("beforeend", `<div><span class="sw" style="background:${c}"></span><span><b>${kk.code}</b> ${kk.name}</span></div>`);
      }
      box.appendChild(cats);
      return;
    }
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 1;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(256, 1);
    for (let x = 0; x < 256; x++) {
      const c = d.color(x / 255);
      img.data.set([c[0], c[1], c[2], 255], x * 4);
    }
    ctx.putImageData(img, 0, 0);
    cv.setAttribute("aria-hidden", "true");
    box.appendChild(cv);
    const ticks = document.createElement("div"); ticks.className = "ticks";
    for (const v of d.ticks) {
      const s = document.createElement("span");
      s.style.left = (d.tickT(v) * 100).toFixed(1) + "%";
      s.textContent = fmt(v, v > 0 && v < 1 ? 1 : 0);
      ticks.appendChild(s);
    }
    box.appendChild(ticks);
    box.setAttribute("aria-label", T.legendAria(d, d.ticks[0], d.ticks[d.ticks.length - 1]));
  }

  // ---------------------------------------------------------------- значения под курсором
  function cellValues(lat, lon) {
    const g = state.grid, idx = cellIndex(lat, lon);
    if (!g || idx < 0) return null;
    const v = k => (g[k] ? g[k][idx] : NaN);
    const kz = Math.round(v("koppen"));
    const kk = state.koppen[kz] || KOPPEN_FALLBACK[kz];
    return {
      frd: v("frd"), tcwv: v("tcwv"), cape: v("cape"), precip: v("precip"),
      elev: v("land") >= 0.5 ? v("elev") : NaN, land: v("land"),
      koppen: kk ? T.zoneStr(kk) : T.ocean,
    };
  }
  const coordStr = (lat, lon) => T.coord(lat, lon, fmt);

  function showReadout(latlng) {
    const box = $("readout");
    const lon = ((((latlng.lng + 180) % 360) + 360) % 360) - 180;
    const c = cellValues(latlng.lat, lon);
    if (!c) {
      box.innerHTML = `<div class="coord">${coordStr(latlng.lat, lon)}</div><p class="hint">${T.noGrid}</p>`;
      return;
    }
    const hl = k => (k === state.layer ? ' class="hl"' : "");
    box.innerHTML = `<div class="coord">${coordStr(latlng.lat, lon)}</div><dl>
      <dt>${T.ro.frd}</dt><dd${hl("frd")}>${fmtAuto(c.frd)}</dd>
      <dt>${T.ro.tcwv}</dt><dd${hl("tcwv")}>${fmt(c.tcwv, 0)}</dd>
      <dt>${T.ro.cape}</dt><dd${hl("cape")}>${fmt(c.cape, 0)}</dd>
      <dt>${T.ro.precip}</dt><dd${hl("precip")}>${fmt(c.precip, 0)}</dd>
      <dt>${T.ro.elev}</dt><dd${hl("elev")}>${Number.isFinite(c.elev) ? fmt(c.elev, 0) : T.ocean}</dd>
      <dt>${T.ro.koppen}</dt><dd${hl("koppen")}>${c.koppen}</dd></dl>`;
  }
  map.on("mousemove", e => showReadout(e.latlng));
  map.on("click", e => showReadout(e.latlng));

  // ---------------------------------------------------------------- горячие точки
  function drawHotspots() {
    hotspotLayer.clearLayers();
    const sorted = [...state.hotspots].sort((a, b) => b.rank - a.rank);
    for (const h of sorted) {
      let m;
      if (h.rank <= 10) {
        m = L.marker([h.lat, h.lon], {
          icon: L.divIcon({ className: "", html: `<div class="hs-rank">${h.rank}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
          title: `${h.rank}. ${hs(h, "place")}`, keyboard: true,
        });
      } else {
        m = L.circleMarker([h.lat, h.lon], {
          radius: 4 + (h.frd - 50) / 25, color: "#0D1220", weight: 1.5,
          fillColor: "#FFF3B0", fillOpacity: 0.9,
        });
      }
      m.bindPopup(() => hotspotPopup(h));
      m.addTo(hotspotLayer);
      h._marker = m;
    }
  }
  function hotspotPopup(h) {
    const c = cellValues(h.lat, h.lon);
    let extra = "";
    if (c) {
      extra = `<p>${T.popupCell(c, fmt, fmtAuto)}</p>`;
    }
    return `<h3>${h.rank}. ${hs(h, "place")}</h3>
      <p>${hs(h, "country")}, ${hs(h, "continent")}</p>
      <p><b>${fmt(h.frd, 2)}</b> ${T.popupLis}</p>${extra}
      <p style="color:#6A7287">${coordStr(h.lat, h.lon)}</p>`;
  }
  function buildTop10() {
    const ol = $("top10");
    ol.innerHTML = "";
    for (const h of state.hotspots.filter(h => h.rank <= 10).sort((a, b) => a.rank - b.rank)) {
      const li = document.createElement("li");
      li.innerHTML = `<button type="button"><span class="rk">${h.rank}</span><span class="pl">${hs(h, "place")} <small>${hs(h, "country")}</small></span><span class="v">${fmt(h.frd, 1)}</span></button>`;
      li.firstChild.addEventListener("click", () => {
        if (!map.hasLayer(hotspotLayer)) { $("hotspots-on").checked = true; hotspotLayer.addTo(map); }
        map.flyTo([h.lat, h.lon], 7, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.2 });
        map.once("moveend", () => h._marker && h._marker.openPopup());
        if (matchMedia("(max-width: 820px)").matches) window.scrollTo({ top: 0 });
      });
      ol.appendChild(li);
    }
  }

  // ---------------------------------------------------------------- статистика
  function weightedMean(pred, val) {
    // среднее с весом cos(широты) — ячейки у полюсов меньше по площади
    const g = state.grid; let s = 0, w = 0;
    for (let i = 0; i < NLAT; i++) {
      const cw = Math.cos((cellLat(i) * Math.PI) / 180);
      for (let j = 0; j < NLON; j++) {
        const k = i * NLON + j;
        if (!pred(k, i)) continue;
        const v = val(k);
        if (!Number.isFinite(v)) continue;
        s += v * cw; w += cw;
      }
    }
    return w ? s / w : NaN;
  }

  function zonalSeries() {
    const g = state.grid, out = { land: [], ocean: [] };
    for (let b = -60; b < 60; b += 2) {
      const sums = { land: [0, 0], ocean: [0, 0] };
      for (let i = 0; i < NLAT; i++) {
        const la = cellLat(i);
        if (la < b || la >= b + 2) continue;
        for (let j = 0; j < NLON; j++) {
          const k = i * NLON + j, f = g.frd[k];
          if (!Number.isFinite(f)) continue;
          const s = sums[g.land[k] >= 0.5 ? "land" : "ocean"]; s[0] += f; s[1]++;
        }
      }
      for (const key of ["land", "ocean"]) if (sums[key][1] > 10) out[key].push([b + 1, sums[key][0] / sums[key][1]]);
    }
    return out;
  }

  const BIN_VARS = {
    tcwv: { step: 2.5, max: 65 },
    cape: { step: 100, max: 3000 },
    precip: { step: 200, max: 5000 },
    elev: { step: 200, max: 5000, landOnly: true },
  };
  for (const [k, [label, axis, btn]] of Object.entries(T.bins)) Object.assign(BIN_VARS[k], { label, axis, btn });
  function binnedSeries(key) {
    const g = state.grid, spec = BIN_VARS[key], nb = Math.ceil(spec.max / spec.step);
    const acc = { land: Array.from({ length: nb }, () => [0, 0, 0]), ocean: Array.from({ length: nb }, () => [0, 0, 0]) };
    for (let i = 0; i < NLAT; i++) {
      const la = cellLat(i);
      if (Math.abs(la) > 60) continue;
      const cw = Math.cos((la * Math.PI) / 180);
      for (let j = 0; j < NLON; j++) {
        const k = i * NLON + j, x = g[key][k], f = g.frd[k];
        if (!Number.isFinite(x) || !Number.isFinite(f) || x < 0) continue;
        const isLand = g.land[k] >= 0.5;
        if (spec.landOnly && !isLand) continue;
        const b = Math.floor(x / spec.step);
        if (b >= nb) continue;
        const a = acc[isLand ? "land" : "ocean"][b];
        a[0] += f * cw; a[1] += cw; a[2]++;
      }
    }
    const conv = arr => arr.map((a, b) => (a[2] >= 30 ? [(b + 0.5) * spec.step, a[0] / a[1]] : null)).filter(Boolean);
    return { land: conv(acc.land), ocean: spec.landOnly ? [] : conv(acc.ocean) };
  }

  function koppenBars() {
    const g = state.grid, rows = [];
    for (const k of Object.keys(KOPPEN_COLORS)) {
      const kk = +k;
      const mean = weightedMean(idx => Math.round(g.koppen[idx]) === kk && g.land[idx] >= 0.5, idx => g.frd[idx]);
      if (Number.isFinite(mean)) rows.push({ k: kk, mean });
    }
    return rows;
  }

  // ---------------------------------------------------------------- графики (SVG)
  const SVG = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(SVG, tag);
    for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const tip = $("tip");
  const showTip = (html, x, y) => {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, x + 14) + "px";
    tip.style.top = Math.max(8, y - r.height - 10) + "px";
  };
  const hideTip = () => (tip.hidden = true);

  function niceTicks(max, n = 4) {
    const raw = max / n, mag = 10 ** Math.floor(log10(raw)), f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = []; for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }

  function clearFigure(fig) {
    fig.querySelectorAll(":scope > :not(figcaption)").forEach(n => n.remove());
  }

  function tableFor(fig, head, rows) {
    const d = document.createElement("details");
    d.innerHTML = `<summary>${T.showTable}</summary><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    fig.appendChild(d);
  }

  function lineChart(fig, { series, xLabel, xFmt, xTicks, yUnit = T.flashUnit }) {
    clearFigure(fig);
    const live = series.filter(s => s.points.length);
    if (!live.length) return;
    if (live.length > 1) {
      const chips = document.createElement("div"); chips.className = "chips";
      chips.innerHTML = live.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join("");
      fig.appendChild(chips);
    }
    const W = 360, H = 210, m = { l: 34, r: 46, t: 8, b: 30 };
    const xs = live.flatMap(s => s.points.map(p => p[0]));
    const x0 = xTicks ? xTicks[0] : Math.min(...xs), x1 = xTicks ? xTicks[xTicks.length - 1] : Math.max(...xs);
    const yMax = Math.max(...live.flatMap(s => s.points.map(p => p[1]))) * 1.08;
    const yT = niceTicks(yMax);
    const X = v => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
    const Y = v => H - m.b - (v / yT[yT.length - 1]) * (H - m.t - m.b);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": fig.querySelector("figcaption").textContent });
    const grid = el("g", { class: "grid" }, svg), ax = el("g", { class: "axis" }, svg);
    for (const t of yT) {
      if (t > 0) el("line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid);
      el("text", { x: m.l - 5, y: Y(t) + 3, "text-anchor": "end" }, ax).textContent = fmt(t, t < 1 && t > 0 ? 1 : 0);
    }
    el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0) }, svg);
    for (const t of xTicks || niceTicks(x1)) {
      el("text", { x: X(t), y: H - m.b + 14, "text-anchor": "middle" }, ax).textContent = xFmt ? xFmt(t) : fmt(t);
    }
    el("text", { x: (m.l + W - m.r) / 2, y: H - 2, "text-anchor": "middle" }, ax).textContent = xLabel;
    for (const s of live) {
      el("path", { class: "series", stroke: s.color, d: s.points.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("") }, svg);
      const last = s.points.reduce((a, p) => (p[1] > a[1] ? p : a));
      if (live.length > 1) {
        const lb = el("text", { class: "label", x: Math.min(W - m.r + 4, X(last[0]) + 6), y: Y(last[1]) - 6 }, svg);
        lb.textContent = s.name;
      }
    }
    // перекрестие
    const xh = el("line", { class: "xhair", y1: m.t, y2: H - m.b, visibility: "hidden" }, svg);
    const dots = live.map(s => el("circle", { r: 4, fill: s.color, stroke: "var(--paper)", "stroke-width": 2, visibility: "hidden" }, svg));
    const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" }, svg);
    const move = ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const xv = x0 + ((p.x - m.l) / (W - m.l - m.r)) * (x1 - x0);
      let rows = [], xNear = null;
      live.forEach((s, si) => {
        const q = s.points.reduce((a, b) => (Math.abs(b[0] - xv) < Math.abs(a[0] - xv) ? b : a));
        xNear = xNear ?? q[0];
        dots[si].setAttribute("cx", X(q[0])); dots[si].setAttribute("cy", Y(q[1])); dots[si].setAttribute("visibility", "visible");
        rows.push(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:6px"></span>${s.name}: <b>${fmtAuto(q[1])}</b>`);
      });
      xh.setAttribute("x1", X(xNear)); xh.setAttribute("x2", X(xNear)); xh.setAttribute("visibility", "visible");
      showTip(`<div>${xLabel}: ${xFmt ? xFmt(xNear) : fmt(xNear)}</div>${rows.join("<br>")}<div style="opacity:.7">${yUnit}</div>`, ev.clientX, ev.clientY);
    };
    const leave = () => { xh.setAttribute("visibility", "hidden"); dots.forEach(d => d.setAttribute("visibility", "hidden")); hideTip(); };
    hit.addEventListener("pointermove", move); hit.addEventListener("pointerleave", leave);
    fig.appendChild(svg);
    const allX = [...new Set(live.flatMap(s => s.points.map(p => p[0])))].sort((a, b) => a - b);
    tableFor(fig, [xLabel, ...live.map(s => s.name)], allX.map(x => [xFmt ? xFmt(x) : fmt(x), ...live.map(s => {
      const p = s.points.find(q => q[0] === x); return p ? fmtAuto(p[1]) : "—";
    })]));
  }

  function barChart(fig, rows) {
    clearFigure(fig);
    if (!rows.length) return;
    const rowH = 26, m = { l: 150, r: 44, t: 4, b: 6 }, W = 360, H = m.t + m.b + rows.length * rowH;
    const max = Math.max(...rows.map(r => r.mean));
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": fig.querySelector("figcaption").textContent });
    const X = v => (v / max) * (W - m.l - m.r);
    rows.sort((a, b) => b.mean - a.mean).forEach((r, i) => {
      const kk = state.koppen[r.k] || KOPPEN_FALLBACK[r.k];
      const y = m.t + i * rowH, bh = 14, by = y + (rowH - bh) / 2, w = Math.max(2, X(r.mean));
      const lab = el("text", { class: "label", x: m.l - 8, y: by + 11, "text-anchor": "end" }, svg);
      lab.innerHTML = `<tspan font-weight="600">${kk.code}</tspan> ${kk.name}`;
      // полоса: скруглённый конец, прямой край у оси
      el("path", { fill: KOPPEN_COLORS[r.k], d: `M${m.l},${by}h${w - 4}a4,4 0 0 1 4,4v${bh - 8}a4,4 0 0 1 -4,4h${-(w - 4)}z` }, svg);
      el("text", { class: "label", x: m.l + w + 6, y: by + 11 }, svg).textContent = fmtAuto(r.mean);
      const hit = el("rect", { x: 0, y, width: W, height: rowH, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", ev => showTip(`<b>${kk.code}</b> ${kk.name}<br>${T.meanDensity}: <b>${fmtAuto(r.mean)}</b> ${T.flashUnit}`, ev.clientX, ev.clientY));
      hit.addEventListener("pointerleave", hideTip);
    });
    el("line", { class: "zero", x1: m.l, x2: m.l, y1: 0, y2: H }, svg);
    fig.appendChild(svg);
    tableFor(fig, [T.zone, T.flashUnit], rows.map(r => {
      const kk = state.koppen[r.k] || KOPPEN_FALLBACK[r.k]; return [`${kk.code} ${kk.name}`, fmtAuto(r.mean)];
    }));
  }

  function chartColors() {
    const cs = getComputedStyle(document.documentElement);
    return { land: cs.getPropertyValue("--land").trim(), ocean: cs.getPropertyValue("--ocean").trim() };
  }

  function renderCharts() {
    const c = chartColors();
    const z = zonalSeries();
    lineChart($("chart-zonal"), {
      series: [{ name: T.land, color: c.land, points: z.land }, { name: T.oceanS, color: c.ocean, points: z.ocean }],
      xLabel: T.latitude, xTicks: [-60, -30, 0, 30, 60],
      xFmt: T.latTick,
    });
    renderBinned();
    barChart($("chart-koppen"), koppenBars());
  }
  function renderBinned() {
    const c = chartColors(), spec = BIN_VARS[state.binVar], b = binnedSeries(state.binVar);
    $("binned-cap").textContent = T.binnedCap(spec.label);
    lineChart($("chart-binned"), {
      series: [{ name: T.land, color: c.land, points: b.land }, { name: T.oceanS, color: c.ocean, points: b.ocean }],
      xLabel: spec.axis, xTicks: niceTicks(spec.max),
    });
  }
  function buildBinSwitch() {
    const box = $("bin-var");
    for (const [k, s] of Object.entries(BIN_VARS)) {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "radio"); b.dataset.key = k;
      b.textContent = s.btn;
      b.addEventListener("click", () => {
        state.binVar = k;
        for (const x of box.children) x.setAttribute("aria-checked", x.dataset.key === k);
        renderBinned();
      });
      box.appendChild(b);
    }
    for (const x of box.children) x.setAttribute("aria-checked", x.dataset.key === state.binVar);
  }

  function writeStats() {
    const g = state.grid;
    const tropical = (k, i) => Math.abs(cellLat(i)) <= 35;
    const land = weightedMean((k, i) => tropical(k, i) && g.land[k] >= 0.5, k => g.frd[k]);
    const ocean = weightedMean((k, i) => tropical(k, i) && g.land[k] < 0.5, k => g.frd[k]);
    if (Number.isFinite(land) && ocean > 0) {
      $("stat-landsea").textContent = T.landSea(fmtAuto(land), fmtAuto(ocean), fmt(land / ocean, 0));
    }
    if (state.meta.generated) {
      $("generated").textContent = T.generated(new Date(state.meta.generated).toLocaleDateString(T.locale), state.meta);
    }
  }

  // ---------------------------------------------------------------- элементы управления
  const contourOn = $("contour-on"), thrIn = $("contour-thr"), thrOut = $("contour-val");
  let thrTimer;
  contourOn.addEventListener("change", () => { state.contour = contourOn.checked; thrIn.disabled = !state.contour; renderContour(); });
  thrIn.addEventListener("input", () => {
    state.thr = +thrIn.value; thrOut.textContent = thrIn.value;
    clearTimeout(thrTimer); thrTimer = setTimeout(renderContour, 120);
  });
  $("hotspots-on").addEventListener("change", e => (e.target.checked ? hotspotLayer.addTo(map) : map.removeLayer(hotspotLayer)));
  $("opacity").addEventListener("input", e => { state.opacity = +e.target.value; baseOverlay.setOpacity(state.opacity); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => state.grid && renderCharts());

  // ---------------------------------------------------------------- старт
  buildLayerList();
  buildBinSwitch();

  fetch("data/hotspots.json").then(r => r.json()).then(j => {
    state.hotspots = j.hotspots; drawHotspots(); buildTop10();
  }).catch(() => {});

  loadGrid().then(({ meta, grid }) => {
    state.meta = meta; state.grid = grid;
    buildLayerList(); renderLegend(); renderBase(); renderContour(); renderCharts(); writeStats();
  }).catch(() => {
    $("nodata").hidden = false;
    for (const id of ["chart-zonal", "chart-binned", "chart-koppen"]) $(id).classList.add("empty");
    $("bin-var").hidden = true;
    contourOn.disabled = thrIn.disabled = true;
    $("opacity").disabled = true;
  });
})();
