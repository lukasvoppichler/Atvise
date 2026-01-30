<?xml version='1.0' encoding='UTF-8'?>
<svg height="940" version="1.2" width="1660" xmlns="http://www.w3.org/2000/svg" xmlns:atv="http://webmi.atvise.com/2007/svgext" xmlns:xlink="http://www.w3.org/1999/xlink">
 <defs/>
 <metadata>
  <atv:parameter behavior="optional" defaultvalue="AGENT.DISPLAYS.MAIN.Anlage.SortOrder" desc="Funktioniert mit der Display Sort Variable aus dem Nodebrowser" name="SortierVariable" substitute="" valuetype="address"/>
  <atv:parameter behavior="mandatory" defaultvalue="86400000" desc="Standardzeitbereich in ms" name="Zeitbereich" valuetype="number"/>
  <atv:parameter behavior="optional" name="Variable" valuetype="address"/>
  <atv:gridconfig enabled="false" gridstyle="lines" height="20" width="20"/>
  <atv:snapconfig enabled="false" height="10" width="10"/>
 </metadata>
 <foreignObject height="940px" id="id_0" width="1660px" x="0" y="0">
  <div style="width:100%; height:100%; display:flex; font-family:Segoe UI, sans-serif; box-sizing:border-box;" xmlns="http://www.w3.org/1999/xhtml">
   <!-- Chart & Controls -->
   <div style="flex-grow:1; display:flex; flex-direction:column; padding:10px; box-sizing:border-box; min-height:0;">
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-end; background:#f4f4f4; padding:10px; border-radius:8px; box-shadow:0 0 4px rgba(0,0,0,0.1);">
     <div style="display:flex; flex-direction:column;">
      <label style="font-size:12px; margin-bottom:2px;">T{Von}:</label>
      <input id="startTime" max="2199-12-31T23:59" min="2000-01-01T00:00" oninput="this.setCustomValidity(''); if(this.validity.rangeOverflow || this.validity.rangeUnderflow){this.setCustomValidity('Datum muss zwischen 2000 und 2099 liegen.');}" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; min-width:140px;" type="datetime-local"/>
     </div>
     <div style="display:flex; flex-direction:column;">
      <label style="font-size:12px; margin-bottom:2px;">T{Bis}:</label>
      <input id="endTime" max="2199-12-31T23:59" min="2025-01-01T00:00" oninput="this.setCustomValidity(''); if(this.validity.rangeOverflow || this.validity.rangeUnderflow){this.setCustomValidity('Datum muss zwischen 2000 und 2099 liegen.');}" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; min-width:140px;" type="datetime-local"/>
     </div>
     <button id="loadBtn" style="padding:8px 10px; border:none; background:#276ef1; color:white; border-radius:4px; cursor:pointer; font-size:14px;">↻ T{Laden}</button>
     <button id="liveBtn" style="padding:8px 10px; border:none; background:#777; color:white; border-radius:4px; cursor:pointer; font-size:14px;">T{Historie}</button>
    </div>
    <div id="container" style="flex-grow:1; width:100%; min-height:0; overflow:hidden;"/>
   </div>
   <!-- Sidebar rechts -->
   <div id="html-tree" style="width:250px; padding:10px; overflow:auto; font-size:13px; box-sizing:border-box;"/>
  </div>
 </foreignObject>
 <script atv:desc="" atv:name="" type="text/ecmascript"><![CDATA[
let chart,
  liveMode = false,
  liveTimer = null,
  language,
  sortMap = {};

let liveWindowMs = 3600 * 1000; // Default: 1h Rolling Window

const browseAll = true;
const q = webMI.query;

// BBO-spezifisch
const configAddr = "AGENT.OBJECTS.BBO.System.Diagramm.Konfiguriert";

// Manuelle Gruppe „Allgemein“ (hier leer, aber bleibt kompatibel)
const manualDefinitions = [
  // leer wie bei dir
];

function toLocalDatetimeString(date) {
  function pad(n) { return n.toString().padStart(2, "0"); }
  return (
    date.getFullYear() + "-" +
    pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + "T" +
    pad(date.getHours()) + ":" +
    pad(date.getMinutes()) + ":" +
    pad(date.getSeconds())
  );
}

function parseConfig(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
}

// SortOrder kann bei atvise manchmal als JSON-String kommen
function parseMaybeJson(v) {
  if (v == null) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return v;
    if (s[0] === "{" || s[0] === "[") {
      try { return JSON.parse(s); } catch (e) { return v; }
    }
  }
  return v;
}

function resetReloadInConfig(cfg) {
  if (!cfg) return;
  const clone = JSON.parse(JSON.stringify(cfg));
  clone.reload = false;
  webMI.data.write(configAddr, JSON.stringify(clone), function () {});
}

function walkAny(nodeOrMap, out, predicate) {
  if (!nodeOrMap) return;

  if (
    typeof nodeOrMap === "object" &&
    (Object.prototype.hasOwnProperty.call(nodeOrMap, "name") ||
     Object.prototype.hasOwnProperty.call(nodeOrMap, "childs"))
  ) {
    const name = nodeOrMap.name;
    if (name && predicate(name)) out.push(name);

    const kids = nodeOrMap.childs ? Object.values(nodeOrMap.childs) : null;
    if (kids && kids.length) {
      for (let i = 0; i < kids.length; i++) walkAny(kids[i], out, predicate);
    }
    return;
  }

  if (typeof nodeOrMap === "object") {
    const values = Object.values(nodeOrMap);
    for (let i = 0; i < values.length; i++) walkAny(values[i], out, predicate);
  }
}

function collectAnlageIOs(treeData) {
  const out = [];
  const rx =
    /^AGENT\.OBJECTS\.BBO\.Anlage\.[^.]+\.[^.]+\.IOs\.(Istwert|Position_Istwert|Status|Zustand)$/i;
  const want = (addr) => typeof addr === "string" && rx.test(addr);
  walkAny(treeData, out, want);
  return out;
}

function collectTagesprogramm(treeData) {
  const out = [];
  const rx =
    /^AGENT\.OBJECTS\.BBO\.System\.Tagesprogramm\.[^.]+\.[^.]+\.Automatischer_Eintrag\.Heute\.IW_Menge_Tag$/i;
  const want = (addr) => typeof addr === "string" && rx.test(addr);
  walkAny(treeData, out, want);
  return out;
}

function makeSeriesDefFromAddress(addr, groupOverride, visibleOverride) {
  const parts = addr.split(".");
  const plant = "BBO";

  let name = parts[parts.length - 3] || addr;
  let group = groupOverride || "Ungruppiert";
  let yAxis = 0;
  let step = false;
  let tryDetectType = null;

  // --- Anlage ---
  if (/^AGENT\.OBJECTS\.BBO\.Anlage\./i.test(addr)) {
    group = groupOverride || parts[4] || "Anlage";
    name = parts[5] || "?";

    if (addr.endsWith(".Zustand") || addr.endsWith(".Status")) {
      yAxis = 1;
      step = true;
    } else if (addr.endsWith(".Aktiver_Istwert")) {
      yAxis = 6;
      step = true;
    } else {
      tryDetectType = parts.slice(0, 6).join(".") + ".Intern.Typ";
    }
  }

  // --- System.Tagesprogramm ---
  else if (/^AGENT\.OBJECTS\.BBO\.System\.Tagesprogramm\./i.test(addr)) {
    group = groupOverride || "Tagesprogramm";
    let tpName = parts[6] || "";
    const map = { Rez: "<->" };
    Object.keys(map).forEach((k) => { tpName = tpName.replace(k, map[k]); });
    name = tpName.replace(/_/g, " ").replace(/zu/g, "->");
  }

  const visible = !!(q.Variable && addr.includes(q.Variable))
    ? true
    : typeof visibleOverride === "boolean"
      ? visibleOverride
      : false;

  return { address: addr, name, group, yAxis, step, visible, tryDetectType, plant };
}

function defsFromConfig(cfg) {
  const defs = [];
  if (!cfg || !Array.isArray(cfg.groups)) return defs;

  cfg.groups.forEach((g) => {
    const gName = g && g.name ? g.name : "Ungruppiert";
    const vars = Array.isArray(g && g.variables) ? g.variables : [];
    vars.forEach((v) => {
      if (!v || !v.address) return;
      defs.push(makeSeriesDefFromAddress(v.address, gName, !!v.visible));
    });
  });

  return defs;
}

function saveCurrentConfig() {
  const cfg = { reload: true, source: "config", groups: [] };
  const grouped = {};

  chart.series.forEach((s) => {
    const g = s.options.group || "Ungruppiert";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({ address: s.options.address, visible: s.visible });
  });

  Object.keys(grouped).forEach((name) => {
    cfg.groups.push({ name: name, variables: grouped[name] });
  });

  webMI.data.write(configAddr, JSON.stringify(cfg), function () {});
}

function getTimeRange() {
  const from = new Date(document.getElementById("startTime").value);
  const to = new Date(document.getElementById("endTime").value);
  return { from: from, to: to };
}

function getAggregation(from, to) {
  const diff = to - from;
  const weekMs = 7 * 24 * 3600 * 1000;

  if (diff < weekMs) return { agg: null, int: null, unit: null, cat: "raw" };

  return { agg: "Average", int: "10", unit: "m", cat: "10m" };
}

function fetchData(series, from, to, agg) {
  const manualType = series.options?.dataType;
  const address = series.options.address;

  const isState = manualType === "status" || /\.Zustand$|\.Status$/i.test(address);

  const filter = {
    type: ["v:1"],
    address: ["v:" + address],
    timestamp: ["n:>=" + from.getTime() + "<=" + to.getTime()]
  };

  // Aggregationslogik:
  // - Status/Zustand: immer Rohdaten (wie bisher) => keine Aggregation setzen
  // - Messwerte: < 1 Woche Rohdaten (wie Status), >= 1 Woche 10min Average
  if (!isState) {
    if (agg && agg.agg) {
      filter.aggregate = ["v:" + agg.agg];
      filter.interval  = ["v:" + agg.int];
      filter.unit      = ["v:" + agg.unit];
    }
    // agg.agg == null => Rohdaten => NICHTS setzen
  }

  webMI.data.queryFilter(filter, function (res) {
    if (!res || !res.result) return;

    const data = res.result
      .map(function (p) { return [p.timestamp, parseFloat(p.value)]; })
      .filter(function (p) { return !isNaN(p[1]); });

    series.setData(data, true);
    series.options.loaded = true;
    series.options.from = from.getTime();
    series.options.to = to.getTime();
  });
}

function updateYAxisRangesAndRedraw() {
  if (!chart) return;

  const yUsed = new Set();
  chart.series.forEach((s) => {
    if (s.visible) yUsed.add(s.options.yAxis);
  });

  const yAxisRanges = {
    0: { min: 0, title: "T{Wert}" },
    1: { min: 0, max: 60, title: "T{Zustand}" },
    2: { min: 0, max: 1000, title: "T{Füllstand} m³" },
    3: { min: 0, max: 500, title: "T{Druck} mBar" },
    4: { min: 0, max: 500, title: "T{Durchfluss} m/h" },
    5: { min: -100, max: 100, title: "T{Temperatur} °C" },
    6: { min: 0, max: 100, title: "T{Aktiver Istwert} %" }
  };

  chart.yAxis.forEach((axis, idx) => {
    const use = yUsed.has(idx);
    const cfg = use ? yAxisRanges[idx] : { min: null, max: null, title: "" };
    axis.update({ min: cfg.min, max: cfg.max, title: { text: cfg.title } }, false);
  });

  chart.redraw();
}

function reloadVisible() {
  const tr = getTimeRange();
  const agg = getAggregation(tr.from, tr.to);

  chart.series.forEach((s) => {
    if (s.visible) fetchData(s, tr.from, tr.to, agg);
  });

  chart.xAxis[0].setExtremes(tr.from.getTime(), tr.to.getTime());
  updateYAxisRangesAndRedraw();
}

function addDiscoveredSeries(addressDefs, opts) {
  const afterAddSave = opts && typeof opts.afterAddSave === "boolean" ? opts.afterAddSave : false;
  let pendingTypeReads = 0;

  while (chart.series.length) chart.series[0].remove(false);

  // Manuelle (statische) Serien
  manualDefinitions.forEach((def) => {
    const isStatus = def.dataType === "status";
    chart.addSeries(
      {
        name: def.name || def.group,
        data: [],
        address: def.address,
        visible: def.visible,
        type: "line",
        yAxis: typeof def.yAxis === "number" ? def.yAxis : (isStatus ? 1 : 0),
        loaded: true,
        group: def.group,
        subgroup: def.subgroup || null,
        step: isStatus ? "left" : (def.step ? "left" : undefined),
        dataType: def.dataType,
        Archiv: def.Archiv || "Messungen",
        plant: "BBO"
      },
      false
    );
  });

  // Browse/Config Serien
  addressDefs.forEach((def) => {
    const isState = /\.Zustand$|\.Status$/i.test(def.address);

    if (!isState && def.tryDetectType) {
      pendingTypeReads++;
      webMI.data.read(def.tryDetectType, function (e) {
        const typ = e && e.value ? e.value.de : null;
        let yIdx = def.yAxis != null ? def.yAxis : 0;

        switch (typ) {
          case "Auslastung": yIdx = 0; break;
          case "Füllstandsmessung": yIdx = 2; break;
          case "Druckmessung": yIdx = 3; break;
          case "Durchflussmessung": yIdx = 4; break;
          case "Temperaturmessung": yIdx = 5; break;
        }

        chart.addSeries(
          {
            name: def.name,
            data: [],
            address: def.address,
            visible: !!def.visible,
            type: "line",
            yAxis: yIdx,
            loaded: false,
            group: def.group,
            step: def.step ? "left" : undefined,
            plant: "BBO"
          },
          false
        );

        if (--pendingTypeReads === 0) finalizeAdd();
      });
    } else {
      chart.addSeries(
        {
          name: def.name,
          data: [],
          address: def.address,
          visible: !!def.visible,
          type: "line",
          yAxis: def.yAxis != null ? def.yAxis : (isState ? 1 : 0),
          loaded: false,
          group: def.group,
          step: def.step ? "left" : undefined,
          plant: "BBO"
        },
        false
      );
    }
  });

  if (pendingTypeReads === 0) finalizeAdd();

  function finalizeAdd() {
    chart.redraw();
    buildLegend();

    const tr = getTimeRange();
    const agg = getAggregation(tr.from, tr.to);

    chart.series.forEach((s) => {
      if (s.visible && !s.options.loaded) fetchData(s, tr.from, tr.to, agg);
    });

    chart.xAxis[0].setExtremes(tr.from.getTime(), tr.to.getTime());
    updateYAxisRangesAndRedraw();

    if (afterAddSave) saveCurrentConfig();
  }
}

function buildLegend() {
  const container = document.getElementById("html-tree");
  container.innerHTML = "";

  const plants = {};
  chart.series.forEach((s) => {
    const plant = s.options.plant || "BBO";

    if (!plants[plant]) plants[plant] = {};
    const g = s.options.group || "Ungruppiert";
    const sub = s.options.subgroup || null;

    if (!plants[plant][g]) plants[plant][g] = {};
    if (!plants[plant][g][sub]) plants[plant][g][sub] = [];
    plants[plant][g][sub].push(s);
  });

  const sortedPlants = Object.keys(plants).sort((a, b) => a.localeCompare(b));

  sortedPlants.forEach((plant) => {
    // Plant header
    const plantDiv = top.document.createElement("div");
    plantDiv.style.fontWeight = "bold";
    plantDiv.style.cursor = "pointer";
    plantDiv.style.fontSize = "16px";
    plantDiv.style.marginTop = "12px";
    plantDiv.style.marginBottom = "4px";
    plantDiv.style.color = "#222";

    webMI.data.call(
      "Standard_elpo",
      { Funktion: "Translate", Text: plant, Sprache: language },
      function (resp) {
        plantDiv.textContent = (resp && resp.result) ? resp.result : plant;
      }
    );

    container.appendChild(plantDiv);

    const plantBody = top.document.createElement("div");
    plantBody.style.marginLeft = "8px";
    plantBody.style.display = "block"; // single plant: standard offen
    container.appendChild(plantBody);

    plantDiv.addEventListener("click", function () {
      plantBody.style.display = plantBody.style.display === "none" ? "block" : "none";
    });

    const groups = plants[plant];

    // SortOrder robust wie 3-Anlagen-Code (aber inkl. JSON-String Parse)
    const rawSort = parseMaybeJson(sortMap[plant]);
    const sortList = Array.isArray(rawSort) ? rawSort : [];

    const order = sortList
      .map((item) => {
        const val = item[1] || item.name || Object.values(item)[0];
        return typeof val === "string" ? val.trim() : "";
      })
      .filter(Boolean);

    const groupNames = Object.keys(groups).sort((a, b) => {
      if (a === "Allgemein") return -1;
      if (b === "Allgemein") return 1;

      const ia = order.indexOf(a);
      const ib = order.indexOf(b);

      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;

      return a.localeCompare(b);
    });

    groupNames.forEach((gName, gIdx) => {
      if (gIdx > 0) {
        const hr = top.document.createElement("hr");
        hr.style.border = "0";
        hr.style.borderTop = "1px solid #444";
        hr.style.margin = "6px 0";
        plantBody.appendChild(hr);
      }

      const header = top.document.createElement("div");
      header.style.fontWeight = "bold";
      header.style.marginTop = "10px";
      header.style.cursor = "pointer";
      header.style.fontSize = "13px";

      // BBO Spezial-DisplayName (wie bei dir)
      const displayName = (function (g) {
        if (g === "Allgemein") return "T{Allgemein}";
        const m = /^Lagune_(\d+)_(.+)$/.exec(g);
        return m ? ("Lagune " + m[1] + " / " + m[2].replace(/_/g, " ")) : g.replace(/_/g, " ");
      })(gName);

      webMI.data.call(
        "Standard_elpo",
        { Funktion: "Translate", Text: displayName, Sprache: language },
        function (resp) {
          header.textContent = (resp && resp.result) ? resp.result : displayName;
        }
      );

      plantBody.appendChild(header);

      const body = top.document.createElement("div");
      body.style.marginLeft = "8px";
      body.style.display = "none";

      const hasVisibleSeries = Object.values(groups[gName]).some((subgroup) =>
        subgroup.some((s) => s.visible)
      );
      if (hasVisibleSeries) body.style.display = "block";

      header.addEventListener("click", function () {
        body.style.display = body.style.display === "none" ? "block" : "none";
      });

      plantBody.appendChild(body);

      const subgroups = groups[gName];
      const sortedSubs = Object.keys(subgroups).sort((a, b) => {
        if (a === "null") return -1;
        if (b === "null") return 1;
        return a.localeCompare(b);
      });

      sortedSubs.forEach((sub) => {
        let targetContainer = body;

        if (sub && sub !== "null") {
          const subHeader = top.document.createElement("div");
          subHeader.style.fontStyle = "italic";
          subHeader.style.marginLeft = "8px";
          subHeader.style.cursor = "pointer";
          subHeader.style.fontWeight = "bold";
          subHeader.style.marginTop = "4px";
          subHeader.style.fontSize = "12px";
          subHeader.textContent = sub;

          const subBody = top.document.createElement("div");
          subBody.style.marginLeft = "8px";
          subBody.style.display = "none";

          subHeader.addEventListener("click", function (e) {
            e.stopPropagation();
            subBody.style.display = subBody.style.display === "none" ? "block" : "none";
          });

          body.appendChild(subHeader);
          body.appendChild(subBody);
          targetContainer = subBody;
        }

        const seriesList = subgroups[sub];
        seriesList
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((s) => {
            const row = top.document.createElement("div");
            row.textContent = s.name;
            row.style.cursor = "pointer";
            row.style.padding = "2px 8px";
            row.style.marginLeft = "8px";
            row.style.color = s.visible ? s.color : "#666";
            row.style.fontWeight = s.visible ? "bold" : "normal";

            row.addEventListener("click", function (e) {
              e.stopPropagation();

              const show = !s.visible;
              s.setVisible(show, false);

              row.style.fontWeight = show ? "bold" : "normal";
              row.style.color = show ? s.color : "#666";

              const tr = getTimeRange();

              if (show) {
                const agg = getAggregation(tr.from, tr.to);
                fetchData(s, tr.from, tr.to, agg);
              }

              chart.xAxis[0].setExtremes(tr.from.getTime(), tr.to.getTime());
              updateYAxisRangesAndRedraw();
            });

            targetContainer.appendChild(row);
          });
      });
    });
  });
}

function loadFromConfigOrBrowse() {
  webMI.data.read(configAddr, function (ce) {
    const cfg = parseConfig(ce && ce.value ? ce.value : null);

    if (!browseAll) {
      const defsCfg = defsFromConfig(cfg);
      if (defsCfg.length > 0) {
        addDiscoveredSeries(defsCfg, { afterAddSave: false });
      } else {
        console.log("[CONFIG] empty → nothing to show (browseAll=false).");
      }
      return;
    }

    // browseAll=true → wie im 3-Anlagen-Code: browsen und Config aktualisieren
    const allAddrs = [];
    const paths = [
      "AGENT.OBJECTS.BBO.Anlage",
      "AGENT.OBJECTS.BBO.System.Tagesprogramm"
    ];

    (function browsePath(j) {
      if (j >= paths.length) {
        const defs = allAddrs.map((addr) => makeSeriesDefFromAddress(addr));
        addDiscoveredSeries(defs, { afterAddSave: true });
        return;
      }

      webMI.data.call("BrowseNodes", { startAddress: paths[j] }, function (tree) {
        if (paths[j].includes(".Anlage")) {
          allAddrs.push.apply(allAddrs, collectAnlageIOs(tree));
        } else if (paths[j].includes(".System.Tagesprogramm")) {
          allAddrs.push.apply(allAddrs, collectTagesprogramm(tree));
        }
        browsePath(j + 1);
      });
    })(0);
  });
}

function drawChart() {
  chart = top.Highcharts.chart(document.getElementById("container"), {
    chart: {
      style: { fontSize: "11px" },
      events: {
        load: function () {
          loadFromConfigOrBrowse();
        }
      }
    },

    title: { text: "T{BBO}", useHTML: true },
    time: { useUTC: false },
    legend: { enabled: false },
    xAxis: { type: "datetime" },

    yAxis: Array.from({ length: 7 }, function (_, i) {
      return { title: { text: "" }, opposite: i === 1 };
    }),

    plotOptions: {
      series: {
        label: {
          enabled: true,
          connectorAllowed: false,
          style: { fontSize: "14px" }
        }
      }
    },

    tooltip: {
      shared: true,
      useHTML: true,
      xDateFormat: "%d.%m.%Y %H:%M:%S",
      pointFormat:
        '<span style="color:{series.color}">●</span> <b>{series.name}</b>: {point.y:.2f}<br/>',
      style: { fontSize: "14px" }
    },

    exporting: {
      enabled: true,
      chartOptions: { chart: { backgroundColor: "#ffffff" } },
      showTable: false,
      menuItemDefinitions: { viewData: null, viewFullscreen: null },
      url: null,
      fallbackToExportServer: false,
      sourceWidth: 1700,
      sourceHeight: 940
    },

    series: []
  });

  const tr = getTimeRange();
  chart.xAxis[0].setExtremes(tr.from.getTime(), tr.to.getTime());
}

webMI.libraryLoader.load(
  [
    "highcharts/highcharts.js",
    "highcharts/modules/exporting.js",
    "highcharts/modules/export-data.js",
    "highcharts/modules/offline-exporting.js",
    "highcharts/modules/series-label.js",
    "highcharts/modules/datagrouping.js",
    "highcharts/themes/grid-light.js"
  ],
  [],
  function () {
    webMI.addOnload(function () {
      language = top.language;

      const now = new Date();
      const past = new Date(now.getTime() - (parseInt(q.Zeitbereich) || 24 * 3600 * 1000));

      document.getElementById("startTime").value = toLocalDatetimeString(past);
      document.getElementById("endTime").value = toLocalDatetimeString(now);

      function startAfterSortLoaded() {
        drawChart();
        document.getElementById("loadBtn") && document.getElementById("loadBtn").addEventListener("click", reloadVisible);

        document.getElementById("liveBtn") && document.getElementById("liveBtn").addEventListener("click", function () {
          liveMode = !liveMode;

          const fromEl = document.getElementById("startTime");
          const toEl = document.getElementById("endTime");

          fromEl.readOnly = liveMode;
          toEl.readOnly = liveMode;

          document.getElementById("liveBtn").textContent = liveMode ? "T{Live}" : "T{Historie}";

          if (liveMode) {
            if (liveTimer) clearInterval(liveTimer);

            const tr = getTimeRange();
            const diff = tr.to - tr.from;

            if (!isNaN(diff) && diff > 30 * 1000) {
              liveWindowMs = diff;
            } else {
              liveWindowMs = 3600 * 1000;
            }

            const tick = function () {
              const now2 = new Date();
              const from2 = new Date(now2.getTime() - liveWindowMs);

              fromEl.value = toLocalDatetimeString(from2);
              toEl.value = toLocalDatetimeString(now2);

              reloadVisible();
            };

            tick();
            liveTimer = setInterval(tick, 5000);
          } else {
            if (liveTimer) clearInterval(liveTimer);
            liveTimer = null;
          }
        });
      }

      if (q.SortierVariable) {
        webMI.data.read(q.SortierVariable, function (e) {
          sortMap["BBO"] = e ? e.value : "";
          startAfterSortLoaded();
        });
      } else {
        sortMap["BBO"] = "";
        startAfterSortLoaded();
      }
    });
  }
);
]]></script>
</svg>
