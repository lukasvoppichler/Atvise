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
  <div style="width:100%; height:100%; display:flex; font-family:Segoe UI, Arial, sans-serif; box-sizing:border-box;" xmlns="http://www.w3.org/1999/xhtml">
   <!-- LINKS: Controls + Chart -->
   <div style="flex:1; display:flex; flex-direction:column; padding:10px; box-sizing:border-box; min-height:0;">
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-end; background:#f4f4f4; padding:10px; border-radius:8px; box-shadow:0 0 4px rgba(0,0,0,0.1);">
     <div style="display:flex; flex-direction:column;">
      <label style="font-size:12px; margin-bottom:2px;">T{Von}:</label>
      <input id="startTime" max="2199-12-31T23:59" min="2000-01-01T00:00" oninput="this.setCustomValidity(''); if(this.validity.rangeOverflow || this.validity.rangeUnderflow){this.setCustomValidity('Datum muss zwischen 2000 und 2099 liegen.');}" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; min-width:140px;" type="datetime-local"/>
     </div>
     <div style="display:flex; flex-direction:column;">
      <label style="font-size:12px; margin-bottom:2px;">T{Bis}:</label>
      <input id="endTime" max="2199-12-31T23:59" min="2025-01-01T00:00" oninput="this.setCustomValidity(''); if(this.validity.rangeOverflow || this.validity.rangeUnderflow){this.setCustomValidity('Datum muss zwischen 2000 und 2099 liegen.');}" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px; min-width:140px;" type="datetime-local"/>
     </div>
     <button id="shiftLeftBtn" style="padding:8px 10px; border:none; background:#555; color:white; border-radius:4px; cursor:pointer; font-size:14px;" title="T{Zurück}">⟵</button>
     <button id="shiftRightBtn" style="padding:8px 10px; border:none; background:#555; color:white; border-radius:4px; cursor:pointer; font-size:14px;" title="T{Vor}">⟶</button>
     <button id="loadBtn" style="padding:8px 10px; border:none; background:#276ef1; color:white; border-radius:4px; cursor:pointer; font-size:14px;">↻ T{Laden}</button>
     <button id="liveBtn" style="padding:8px 10px; border:none; background:#777; color:white; border-radius:4px; cursor:pointer; font-size:14px;">T{Historie}</button>
    </div>
    <div id="container" style="flex:1; min-height:0; width:100%; overflow:hidden; border-radius:8px;"/>
   </div>
   <!-- RECHTS: Tree Legend -->
   <div id="html-tree" style="width:260px; padding:10px; overflow:auto; font-size:13px; box-sizing:border-box; border-left:1px solid #ddd;"/>
  </div>
 </foreignObject>
 <script atv:desc="" atv:name="" type="text/ecmascript"><![CDATA[// ============================================================
// 20260130 - 2  Multi-Plant Highcharts (Tree-Legende, Live + Shift, OHNE Pad-Serien)
// READY TO PASTE
//
// Ziele (Rückbau):
// - Multi-Plant bleibt (q.Plant leer/ALL => Biometano/Belagreen/BBO)
// - Tree-Legende bleibt (Plant -> Group -> Subgroup -> Serien)
// - Live-Mode bleibt
// - Shift-Buttons bleiben
// - PAD-SERIEN KOMPLETT ENTFERNT:
//     => KEINE erfundenen Punkte, KEINE Backfill/Forwardfill-Linien
//     => Tooltip/Timestamps gibt es nur für echte Archivpunkte
//
// Wartbarkeit:
// - Verständliche Variablennamen
// - Klar getrennte Bereiche: Config/Sort, Helpers, Data, Legend, Chart, UI
// ============================================================


// ============================================================
// 0) MANUAL DEFINITIONS (bleiben immer, werden NICHT in Config gespeichert)
// ============================================================

const manualDefinitions = [
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "T{BHKW}",
    address:
      "AGENT.OBJECTS.Biometano.Anlage.Fackel_BHKW_Upgrading.Schnittstelle_BHKW.Leistung_BHKW_zu_BGA",
    name: "T{Leistung BHKW}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "T{Biogas}",
    address:
      "AGENT.OBJECTS.Biometano.Anlage.Fackel_BHKW_Upgrading.Parameter.Steuerung_Fackel.Gesamt_Fuellstand",
    name: "T{Gesamt Gasfüllstand}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Spannung_L1_L2",
    name: "T{Spannung L1-L2}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Spannung_L2_L3",
    name: "T{Spannung L2-L3}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Spannung_L3_L1",
    name: "T{Spannung L3-L1}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Strom_L1",
    name: "T{Strom L1}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Strom_L2",
    name: "T{Strom L2}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Strom_L3",
    name: "T{Strom L3}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR1",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR1.Gesamtwirkleistung",
    name: "T{Gesamtwirkleistung}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },

  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Spannung_L1_L2",
    name: "T{Spannung L1-L2}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Spannung_L2_L3",
    name: "T{Spannung L2-L3}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Spannung_L3_L1",
    name: "T{Spannung L3-L1}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Strom_L1",
    name: "T{Strom L1}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Strom_L2",
    name: "T{Strom L2}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Strom_L3",
    name: "T{Strom L3}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "CR2",
    address: "AGENT.OBJECTS.Biometano.System.Energie.CR2.Gesamtwirkleistung",
    name: "T{Gesamtwirkleistung}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },

  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Spannung_L1_L2",
    name: "T{Spannung L1-L2}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Spannung_L2_L3",
    name: "T{Spannung L2-L3}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Spannung_L3_L1",
    name: "T{Spannung L3-L1}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Strom_L1",
    name: "T{Strom L1}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Strom_L2",
    name: "T{Strom L2}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Strom_L3",
    name: "T{Strom L3}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
  {
    plant: "Biometano",
    group: "Allgemein",
    subgroup: "HV",
    address: "AGENT.OBJECTS.Biometano.System.Energie.HV.Gesamtwirkleistung",
    name: "T{Gesamtwirkleistung}",
    yAxis: 0,
    step: false,
    visible: false,
    dataType: "value",
    Archiv: "Archiv",
  },
];


// ============================================================
// 0b) GLOBAL STATE
// ============================================================

let chartInstance = null;

// Live
let isLiveMode = false;
let liveIntervalHandle = null;
let liveWindowMs = 3600 * 1000;

// Language
let uiLanguage = null;

// Token, damit alte Query-Antworten ignoriert werden
let currentReloadToken = 0;

// SortOrder pro Plant (Multi) + Legacy fallback
let sortOrderByPlant = {};   // { Biometano: <raw>, Belagreen: <raw>, BBO: <raw>, <singlePlant>: <raw> }
let legacySortOrderList = null;

// Intern: afterSetExtremes darf nicht rekursiv triggern
let suppressAfterSetExtremes = false;


// ============================================================
// 0c) MULTI / SINGLE MODE
// ============================================================

const queryParams = webMI.query;

const plantParamRaw = (typeof queryParams.Plant === "string") ? queryParams.Plant.trim() : "";
const isMultiPlantMode = (!plantParamRaw || plantParamRaw.toUpperCase() === "ALL");

const defaultPlantNames = ["Biometano", "Belagreen", "BBO"];
const singlePlantName = isMultiPlantMode ? "" : plantParamRaw;

// Config-Adresse (Multi: global | Single (neues Schema): pro Plant | Legacy: global)
const configAddress = isMultiPlantMode
  ? "AGENT.OBJECTS.System.Diagramm.Konfiguriert"
  : (singlePlantName
      ? ("AGENT.OBJECTS." + singlePlantName + ".System.Diagramm.Konfiguriert")
      : "AGENT.OBJECTS.System.Diagramm.Konfiguriert"
    );

// SortOrder pro Plant
const sortOrderAddressMulti = {
  Biometano: "AGENT.DISPLAYS.MAIN.Biometano.Anlage.SortOrder",
  Belagreen: "AGENT.DISPLAYS.MAIN.Belagreen.Anlage.SortOrder",
  BBO: "AGENT.DISPLAYS.MAIN.BBO.Anlage.SortOrder"
};

// Single (neues Schema) Standard-SortOrder
const sortOrderAddressSingleDefault = singlePlantName
  ? ("AGENT.DISPLAYS.MAIN." + singlePlantName + ".Anlage.SortOrder")
  : "";

// Wenn q.SortierVariable gesetzt ist, hat das Vorrang (Single-Fall)
const sortOrderAddressSingle = queryParams.SortierVariable ? queryParams.SortierVariable : sortOrderAddressSingleDefault;


// ============================================================
// 1) BASIC HELPERS
// ============================================================

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

function normalizeAddress(addr) {
  if (typeof addr !== "string") return addr;
  return addr.replace(/^\s*(v:|g:|n:)\s*/i, "").trim();
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMaybeJson(value) {
  if (value == null) return value;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return value;
    if (s[0] === "{" || s[0] === "[") {
      try { return JSON.parse(s); } catch (e) { return value; }
    }
  }
  return value;
}

function parseConfig(raw) {
  try { return (typeof raw === "string") ? JSON.parse(raw) : raw; }
  catch (e) { return null; }
}

function parseAnyNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "on" || s === "ein" || s === "1") return 1;
    if (s === "false" || s === "off" || s === "aus" || s === "0") return 0;
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? NaN : n;
  }

  if (v && typeof v === "object") {
    if (typeof v.value === "number") return v.value;
    if (typeof v.de === "string") return parseAnyNumber(v.de);
    if (typeof v.en === "string") return parseAnyNumber(v.en);
  }

  return NaN;
}

function normalizeQueryResultToPoints(res) {
  if (!res || !res.result) return [];

  const points = [];
  for (let i = 0; i < res.result.length; i++) {
    const row = res.result[i];

    let ts = row.timestamp;
    if (typeof ts === "string") {
      const parsed = Date.parse(ts);
      ts = isNaN(parsed) ? null : parsed;
    } else if (ts && typeof ts === "object" && typeof ts.getTime === "function") {
      ts = ts.getTime();
    } else if (typeof ts !== "number") {
      ts = null;
    }

    const val = parseAnyNumber(row.value);
    if (ts === null) continue;
    if (isNaN(val)) continue;

    points.push([ts, val]);
  }

  points.sort(function (a, b) { return a[0] - b[0]; });

  // Dedup gleiche timestamps: letzter gewinnt
  const out = [];
  for (let j = 0; j < points.length; j++) {
    if (out.length === 0) out.push(points[j]);
    else {
      const last = out[out.length - 1];
      if (points[j][0] === last[0]) last[1] = points[j][1];
      else out.push(points[j]);
    }
  }
  return out;
}

function detectPlantFromAddress(addr) {
  if (typeof addr !== "string") return "Allgemein";
  if (addr.indexOf(".Biometano.") !== -1) return "Biometano";
  if (addr.indexOf(".Belagreen.") !== -1) return "Belagreen";
  if (addr.indexOf(".BBO.") !== -1) return "BBO";
  return "Allgemein";
}

function getTimeRangeFromInputs() {
  const from = new Date(document.getElementById("startTime").value);
  const to = new Date(document.getElementById("endTime").value);
  return { from: from, to: to };
}

function setTimeRangeInputs(fromMs, toMs) {
  const startEl = document.getElementById("startTime");
  const endEl = document.getElementById("endTime");
  if (startEl) startEl.value = toLocalDatetimeString(new Date(fromMs));
  if (endEl) endEl.value = toLocalDatetimeString(new Date(toMs));
}

// Tagesprogramm: Multi/Single/Legacy robust
function isTagesprogrammAddress(address) {
  address = normalizeAddress(address || "");

  if (/^AGENT\.OBJECTS\.(Biometano|Belagreen|BBO)\.System\.Tagesprogramm\./i.test(address)) return true;

  if (singlePlantName) {
    const rx = new RegExp("^AGENT\\.OBJECTS\\." + escapeRegExp(singlePlantName) + "\\.System\\.Tagesprogramm\\.", "i");
    if (rx.test(address)) return true;
  }

  return /^AGENT\.OBJECTS\.System\.Tagesprogramm\./i.test(address);
}


// ============================================================
// 2) SERIES ID (stabil, gut lesbar)
// ============================================================

function makeSeriesIdFromAddress(address) {
  const addr = normalizeAddress(address || "");
  return "series_" + addr.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}


// ============================================================
// 3) BROWSE HELPERS (Multi/Single/Legacy)
// ============================================================

function walkTreeCollect(nodeOrMap, outputArray, predicate) {
  if (!nodeOrMap) return;

  // Node: { name, childs }
  if (
    typeof nodeOrMap === "object" &&
    (Object.prototype.hasOwnProperty.call(nodeOrMap, "name") ||
      Object.prototype.hasOwnProperty.call(nodeOrMap, "childs"))
  ) {
    const nodeName = nodeOrMap.name;
    if (nodeName && predicate(nodeName)) outputArray.push(nodeName);

    const children = nodeOrMap.childs ? Object.values(nodeOrMap.childs) : null;
    if (children && children.length) {
      for (let i = 0; i < children.length; i++) {
        walkTreeCollect(children[i], outputArray, predicate);
      }
    }
    return;
  }

  // Map
  if (typeof nodeOrMap === "object") {
    const values = Object.values(nodeOrMap);
    for (let j = 0; j < values.length; j++) {
      walkTreeCollect(values[j], outputArray, predicate);
    }
  }
}

function getRegexForAnlageIOs() {
  if (isMultiPlantMode) {
    return /^AGENT\.OBJECTS\.(Biometano|Belagreen|BBO)\.Anlage\.[^.]+\.[^.]+\.IOs\.(Istwert|Position_Istwert|Status|Zustand)$/i;
  }

  if (singlePlantName) {
    return new RegExp(
      "^AGENT\\.OBJECTS\\." + escapeRegExp(singlePlantName) + "\\.Anlage\\.[^.]+\\.[^.]+\\.IOs\\.(Istwert|Position_Istwert|Status|Zustand)$",
      "i"
    );
  }

  return /^AGENT\.OBJECTS\.Anlage\.[^.]+\.[^.]+\.IOs\.(Istwert|Position_Istwert|Status|Zustand)$/i;
}

function getRegexForTagesprogramm() {
  if (isMultiPlantMode) {
    return /^AGENT\.OBJECTS\.(Biometano|Belagreen|BBO)\.System\.Tagesprogramm\.[^.]+\.[^.]+(\.Automatischer_Eintrag)?\.Heute\.IW_Menge_Tag$/i;
  }

  if (singlePlantName) {
    return new RegExp(
      "^AGENT\\.OBJECTS\\." + escapeRegExp(singlePlantName) + "\\.System\\.Tagesprogramm\\.[^.]+\\.[^.]+(\\.Automatischer_Eintrag)?\\.Heute\\.IW_Menge_Tag$",
      "i"
    );
  }

  return /^AGENT\.OBJECTS\.System\.Tagesprogramm\.[^.]+(\.Automatischer_Eintrag)?\.Heute\.IW_Menge_Tag$/i;
}

function collectAnlageAddresses(treeData) {
  const out = [];
  const rx = getRegexForAnlageIOs();
  walkTreeCollect(treeData, out, function (addr) { return typeof addr === "string" && rx.test(addr); });
  return out;
}

function collectTagesprogrammAddresses(treeData) {
  const out = [];
  const rx = getRegexForTagesprogramm();
  walkTreeCollect(treeData, out, function (addr) { return typeof addr === "string" && rx.test(addr); });
  return out;
}


// ============================================================
// 4) SERIES DEFINITION (aus Address)
// ============================================================

function makeSeriesDefinitionFromAddress(address, groupOverride, visibleOverride) {
  const addr = normalizeAddress(address);
  const parts = addr.split(".");

  const plantName = isMultiPlantMode
    ? detectPlantFromAddress(addr)
    : (singlePlantName ? singlePlantName : "Legacy");

  let seriesName = parts[parts.length - 3] || addr; // Default: Segment vor IOs
  let groupName = groupOverride || "Ungruppiert";
  let yAxisIndex = 0;
  let stepMode = false;
  let tryDetectTypeAddress = null;
  let subGroupName = null;

  const isState = /\.Zustand$|\.Status$/i.test(addr);

  // Anlage Multi/Single neues Schema: AGENT.OBJECTS.<Plant>.Anlage.<Group>.<Name>.IOs.<...>
  const isNewPlantSchema =
    /^AGENT\.OBJECTS\.(Biometano|Belagreen|BBO)\.Anlage\./i.test(addr) ||
    (singlePlantName && new RegExp("^AGENT\\.OBJECTS\\." + escapeRegExp(singlePlantName) + "\\.Anlage\\.", "i").test(addr));

  if (isNewPlantSchema) {
    groupName = groupOverride || parts[4] || "Anlage";
    seriesName = parts[5] || "?";

    if (isState) {
      yAxisIndex = 1;
      stepMode = true;
    } else if (/\.Aktiver_Istwert$/i.test(addr)) {
      yAxisIndex = 6;
      stepMode = true;
    } else {
      tryDetectTypeAddress = parts.slice(0, 6).join(".") + ".Intern.Typ";
    }
  }
  // Anlage Legacy: AGENT.OBJECTS.Anlage.<Group>.<Name>.IOs.<...>
  else if (/^AGENT\.OBJECTS\.Anlage\./i.test(addr)) {
    groupName = groupOverride || parts[3] || "Anlage";
    seriesName = parts[4] || "?";

    if (isState) {
      yAxisIndex = 1;
      stepMode = true;
    } else if (/\.Aktiver_Istwert$/i.test(addr)) {
      yAxisIndex = 6;
      stepMode = true;
    } else {
      tryDetectTypeAddress = parts.slice(0, 5).join(".") + ".Intern.Typ";
    }
  }
  // Tagesprogramm (Multi/Single/Legacy)
  else if (isTagesprogrammAddress(addr)) {
    groupName = groupOverride || "Tagesprogramm";

    // robust: finde Segment nach "Tagesprogramm"
    let tpName = "";
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "Tagesprogramm") {
        tpName = parts[i + 2] || parts[i + 1] || "";
        break;
      }
    }
    seriesName = String(tpName).replace(/_/g, " ").replace(/zu/g, "->");
  }

  // Sichtbarkeit: q.Variable hat Priorität
  const visibleByQuery =
    (queryParams.Variable && addr.indexOf(normalizeAddress(queryParams.Variable)) !== -1);

  const initialVisible =
    visibleByQuery ? true :
    (typeof visibleOverride === "boolean") ? visibleOverride :
    false;

  return {
    address: addr,
    name: seriesName,
    group: groupName,
    subgroup: subGroupName,
    yAxis: yAxisIndex,
    step: stepMode,
    visible: initialVisible,
    tryDetectType: tryDetectTypeAddress,
    plant: plantName
  };
}

function makeDefinitionsFromConfig(configObject) {
  const defs = [];
  if (!configObject || !Array.isArray(configObject.groups)) return defs;

  configObject.groups.forEach(function (groupItem) {
    const groupName = groupItem && groupItem.name ? String(groupItem.name) : "Ungruppiert";
    const vars = Array.isArray(groupItem && groupItem.variables) ? groupItem.variables : [];

    vars.forEach(function (v) {
      if (!v || !v.address) return;
      defs.push(makeSeriesDefinitionFromAddress(v.address, groupName, !!v.visible));
    });
  });

  return defs;
}


// ============================================================
// 5) AGGREGATION (RAW < 1 Woche, sonst 10m Average; TP/Status immer RAW)
// ============================================================

function decideAggregation(fromDate, toDate, address) {
  const addr = normalizeAddress(address);
  const diffMs = toDate.getTime() - fromDate.getTime();
  const weekMs = 7 * 24 * 3600 * 1000;

  if (isTagesprogrammAddress(addr)) return { aggregate: null, interval: null, unit: null };
  if (/\.Zustand$|\.Status$/i.test(addr)) return { aggregate: null, interval: null, unit: null };
  if (diffMs < weekMs) return { aggregate: null, interval: null, unit: null };

  return { aggregate: "Average", interval: "10", unit: "m" };
}


// ============================================================
// 6) FETCH DATA (nur echte Archivpunkte, Token-Schutz)
// ============================================================

function fetchSeriesData(series, fromDate, toDate, options) {
  if (!series) return;

  options = options || {};
  const redraw = (typeof options.redraw === "boolean") ? options.redraw : true;
  const onDone = (typeof options.onDone === "function") ? options.onDone : null;
  const token = (typeof options.token === "number") ? options.token : 0;

  const address = normalizeAddress(series.options && series.options.address);
  if (!address) { if (onDone) onDone(); return; }

  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();

  function isStale() {
    return (token && token !== currentReloadToken);
  }

  const filter = {
    type: ["v:1"],
    address: ["v:" + address],
    timestamp: ["n:>=" + fromMs + "<=" + toMs]
  };

  // Aggregation (außer Status/TP -> decideAggregation liefert nulls)
  const agg = decideAggregation(fromDate, toDate, address);
  if (agg && agg.aggregate) {
    filter.aggregate = ["v:" + agg.aggregate];
    filter.interval = ["v:" + agg.interval];
    filter.unit = ["v:" + agg.unit];
  }

  webMI.data.queryFilter(filter, function (res) {
    if (isStale()) { if (onDone) onDone(); return; }

    const points = normalizeQueryResultToPoints(res);

    series.setData(points, redraw);
    series.options.loaded = true;
    series.options.from = fromMs;
    series.options.to = toMs;

    if (onDone) onDone();
  });
}


// ============================================================
// 7) Y-ACHSE (FIX)
// ============================================================

function updateYAxisRangesAndRedraw() {
  if (!chartInstance) return;

  const usedAxisIndexes = new Set();
  chartInstance.series.forEach(function (s) {
    if (s.visible) usedAxisIndexes.add(s.options.yAxis);
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

  chartInstance.yAxis.forEach(function (axis, idx) {
    const useAxis = usedAxisIndexes.has(idx);
    const cfg = useAxis ? yAxisRanges[idx] : { min: null, max: null, title: "" };

    axis.update(
      { min: cfg.min, max: cfg.max, title: { text: cfg.title } },
      false
    );
  });

  chartInstance.redraw();
}


// ============================================================
// 8) RELOAD VISIBLE (zentrales Laden, Token erhöht)
// ============================================================

let liveReloadBusy = false;

function reloadVisibleSeries(options) {
  if (!chartInstance) return;

  options = options || {};
  const setExtremes = (typeof options.setExtremes === "boolean") ? options.setExtremes : true;
  const updateYAxis = (typeof options.updateYAxis === "boolean") ? options.updateYAxis : true;
  const redrawOnce = (typeof options.redrawOnce === "boolean") ? options.redrawOnce : true;

  // Live: wenn noch am Laden, nicht stapeln
  if (isLiveMode && liveReloadBusy) return;

  const range = getTimeRangeFromInputs();
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  if (setExtremes) {
    suppressAfterSetExtremes = true;
    chartInstance.xAxis[0].setExtremes(fromMs, toMs, false, false, { trigger: "internal" });
    suppressAfterSetExtremes = false;
  }

  // Token hochzählen => alte Antworten werden ignoriert
  currentReloadToken++;

  let pending = 0;
  chartInstance.series.forEach(function (s) {
    if (!s.visible) return;
    pending++;
  });

  if (pending === 0) {
    if (redrawOnce) chartInstance.redraw();
    return;
  }

  if (isLiveMode) liveReloadBusy = true;

  function doneOne() {
    pending--;
    if (pending > 0) return;

    if (isLiveMode) liveReloadBusy = false;

    if (updateYAxis && !isLiveMode) {
      updateYAxisRangesAndRedraw(); // enthält redraw
      return;
    }

    if (redrawOnce) chartInstance.redraw();
  }

  chartInstance.series.forEach(function (s) {
    if (!s.visible) return;
    fetchSeriesData(s, range.from, range.to, { redraw: false, onDone: doneOne, token: currentReloadToken });
  });
}


// ============================================================
// 9) SERIES BUILD + TREE LEGEND
// ============================================================

function addAllSeriesAndBuildLegend(addressDefinitions, options) {
  options = options || {};
  const saveAfterAdd = (typeof options.saveAfterAdd === "boolean") ? options.saveAfterAdd : false;

  if (!chartInstance) return;

  // Chart leeren
  while (chartInstance.series.length) chartInstance.series[0].remove(false);

  // Manual Adressen als Set (damit Auto nicht doppelt anlegt)
  const manualAddressSet = new Set(
    manualDefinitions
      .map(function (d) { return d && normalizeAddress(d.address); })
      .filter(function (a) { return typeof a === "string" && a.length > 0; })
  );

  // 1) Manual Serien
  manualDefinitions.forEach(function (def) {
    if (!def || !def.address) return;

    const addr = normalizeAddress(def.address);
    const seriesId = makeSeriesIdFromAddress(addr);

    const isStatus = (def.dataType === "status") || /\.Zustand$|\.Status$/i.test(addr);

    chartInstance.addSeries(
      {
        id: seriesId,
        name: def.name || def.group || addr,
        data: [],
        address: addr,

        visible: !!def.visible,
        type: "line",
        yAxis: (typeof def.yAxis === "number") ? def.yAxis : (isStatus ? 1 : 0),
        step: isStatus ? "left" : (def.step ? "left" : undefined),

        loaded: false,
        group: def.group || "Allgemein",
        subgroup: def.subgroup || null,
        dataType: def.dataType || "value",
        plant: def.plant || detectPlantFromAddress(addr) || (singlePlantName ? singlePlantName : "Legacy")
      },
      false
    );
  });

  // 2) Auto Serien (nicht doppelt zu Manual)
  let pendingTypeReads = 0;

  (addressDefinitions || []).forEach(function (def) {
    if (!def || !def.address) return;

    const addr = normalizeAddress(def.address);
    if (manualAddressSet.has(addr)) return; // nicht doppelt

    const seriesId = makeSeriesIdFromAddress(addr);
    const isStateAddr = /\.Zustand$|\.Status$/i.test(addr);

    // Typ-Read nur für "echte" Messwerte (nicht Status)
    if (!isStateAddr && def.tryDetectType) {
      pendingTypeReads++;

      webMI.data.read(def.tryDetectType, function (e) {
        const typ = e && e.value ? e.value.de : null;
        let yIdx = (def.yAxis != null) ? def.yAxis : 0;

        switch (typ) {
          case "Auslastung": yIdx = 0; break;
          case "Füllstandsmessung": yIdx = 2; break;
          case "Druckmessung": yIdx = 3; break;
          case "Durchflussmessung": yIdx = 4; break;
          case "Temperaturmessung": yIdx = 5; break;
          case "Gasleck- Sensor": yIdx = 0; break;
        }

        chartInstance.addSeries(
          {
            id: seriesId,
            name: def.name,
            data: [],
            address: addr,

            visible: !!def.visible,
            type: "line",
            yAxis: yIdx,
            step: def.step ? "left" : undefined,

            loaded: false,
            group: def.group,
            subgroup: def.subgroup || null,
            plant: def.plant || detectPlantFromAddress(addr) || (singlePlantName ? singlePlantName : "Legacy")
          },
          false
        );

        pendingTypeReads--;
        if (pendingTypeReads === 0) finalize();
      });

      return;
    }

    chartInstance.addSeries(
      {
        id: seriesId,
        name: def.name,
        data: [],
        address: addr,

        visible: !!def.visible,
        type: "line",
        yAxis: (def.yAxis != null) ? def.yAxis : (isStateAddr ? 1 : 0),
        step: def.step ? "left" : undefined,

        loaded: false,
        group: def.group,
        subgroup: def.subgroup || null,
        plant: def.plant || detectPlantFromAddress(addr) || (singlePlantName ? singlePlantName : "Legacy")
      },
      false
    );
  });

  if (pendingTypeReads === 0) finalize();

  function finalize() {
    chartInstance.redraw();

    buildTreeLegend();

    const range = getTimeRangeFromInputs();

    // initial: sichtbare Serien laden
    chartInstance.series.forEach(function (s) {
      if (s.visible && !s.options.loaded) {
        fetchSeriesData(s, range.from, range.to, { redraw: false, token: currentReloadToken });
      }
    });

    suppressAfterSetExtremes = true;
    chartInstance.xAxis[0].setExtremes(range.from.getTime(), range.to.getTime(), true, false, { trigger: "internal" });
    suppressAfterSetExtremes = false;

    updateYAxisRangesAndRedraw();

    if (saveAfterAdd) saveCurrentConfig();
  }
}


// ============================================================
// 9b) TREE LEGEND (Multi: Plant -> Group -> Subgroup)
// ============================================================

function buildTreeLegend() {
  const container = document.getElementById("html-tree");
  if (!container || !chartInstance) return;

  container.innerHTML = "";

  // ---------------------------
  // SortOrder Normalisierung
  // ---------------------------
  function normalizeSortKey(s) {
    if (s == null) return "";
    s = String(s);

    // T{...} Wrapper weg
    s = s.replace(/T\{([^}]*)\}/g, "$1");
    s = s.trim();

    // spaces -> underscores
    s = s.replace(/\s+/g, "_").replace(/_+/g, "_");

    // Sonderzeichen raus
    s = s.replace(/[^a-z0-9_]/gi, "");

    return s.toLowerCase();
  }

  function collectStringsDeep(item) {
    const out = [];
    if (item == null) return out;

    if (typeof item === "string") { out.push(item); return out; }

    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) {
        if (typeof item[i] === "string") out.push(item[i]);
        else if (item[i] && typeof item[i] === "object") {
          const inner = collectStringsDeep(item[i]);
          out.push.apply(out, inner);
        }
      }
      return out;
    }

    if (typeof item === "object") {
      const vals = Object.values(item);
      for (let j = 0; j < vals.length; j++) {
        const v = vals[j];
        if (typeof v === "string") out.push(v);
        else if (v && typeof v === "object") {
          const inner2 = collectStringsDeep(v);
          out.push.apply(out, inner2);
        }
      }
      return out;
    }

    return out;
  }

  function buildSortIndexMap(sortList) {
    const map = {};
    if (!Array.isArray(sortList)) return map;

    for (let i = 0; i < sortList.length; i++) {
      const candidates = collectStringsDeep(sortList[i]);
      for (let k = 0; k < candidates.length; k++) {
        const key = normalizeSortKey(candidates[k]);
        if (!key) continue;
        if (map[key] == null) map[key] = i; // first wins
      }
    }
    return map;
  }

  // plants[plant][group][sub] = series[]
  const plantTree = {};

  chartInstance.series.forEach(function (s) {
    const addr = normalizeAddress(s.options && s.options.address);
    const plant = (s.options && s.options.plant) ? s.options.plant : detectPlantFromAddress(addr);

    if (!plantTree[plant]) plantTree[plant] = {};

    const group = (s.options && s.options.group) ? s.options.group : "Ungruppiert";
    const sub = (s.options && s.options.subgroup) ? s.options.subgroup : null;

    if (!plantTree[plant][group]) plantTree[plant][group] = {};
    if (!plantTree[plant][group][sub]) plantTree[plant][group][sub] = [];
    plantTree[plant][group][sub].push(s);
  });

  const plantNames = Object.keys(plantTree).sort(function (a, b) { return a.localeCompare(b); });

  plantNames.forEach(function (plantName, plantIndex) {
    if (plantIndex > 0 && isMultiPlantMode) {
      const hrPlant = top.document.createElement("hr");
      hrPlant.style.border = "0";
      hrPlant.style.borderTop = "1px solid #444";
      hrPlant.style.margin = "10px 0";
      container.appendChild(hrPlant);
    }

    // Plant header (nur Multi sichtbar)
    const plantHeader = top.document.createElement("div");
    plantHeader.style.fontWeight = "bold";
    plantHeader.style.cursor = "pointer";
    plantHeader.style.fontSize = "16px";
    plantHeader.style.marginTop = "12px";
    plantHeader.style.marginBottom = "4px";
    plantHeader.style.color = "#222";
    plantHeader.textContent = plantName;

    try {
      webMI.data.call(
        "Standard_elpo",
        { Funktion: "Translate", Text: plantName, Sprache: uiLanguage },
        function (resp) {
          plantHeader.textContent = (resp && resp.result) ? resp.result : plantName;
        }
      );
    } catch (e) {}

    if (isMultiPlantMode) container.appendChild(plantHeader);

    const plantBody = top.document.createElement("div");
    plantBody.style.marginLeft = "8px";
    plantBody.style.display = isMultiPlantMode ? "none" : "block";
    container.appendChild(plantBody);

    if (isMultiPlantMode) {
      plantHeader.addEventListener("click", function () {
        plantBody.style.display = (plantBody.style.display === "none") ? "block" : "none";
      });
    }

    const groups = plantTree[plantName];

    // SortOrder pro Plant (Multi) oder Legacy fallback
    const rawSort = parseMaybeJson(sortOrderByPlant[plantName]);
    const plantSortList = Array.isArray(rawSort) ? rawSort : legacySortOrderList;
    const sortIndexMap = buildSortIndexMap(plantSortList);

    const allGroupNames = Object.keys(groups);
    const hasAllgemein = allGroupNames.indexOf("Allgemein") !== -1;
    const hasTagesprogramm = allGroupNames.indexOf("Tagesprogramm") !== -1;

    const middleGroups = allGroupNames.filter(function (g) {
      if (g === "Allgemein") return false;
      if (g === "Tagesprogramm") return false;
      return true;
    });

    middleGroups.sort(function (a, b) {
      const ka = normalizeSortKey(a);
      const kb = normalizeSortKey(b);

      const ia = (sortIndexMap[ka] != null) ? sortIndexMap[ka] : -1;
      const ib = (sortIndexMap[kb] != null) ? sortIndexMap[kb] : -1;

      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;

      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return String(a).localeCompare(String(b));
    });

    const sortedGroupNames = [];
    if (hasAllgemein) sortedGroupNames.push("Allgemein");
    sortedGroupNames.push.apply(sortedGroupNames, middleGroups);
    if (hasTagesprogramm) sortedGroupNames.push("Tagesprogramm");

    sortedGroupNames.forEach(function (groupName, groupIndex) {
      if (groupIndex > 0) {
        const hr = top.document.createElement("hr");
        hr.style.border = "0";
        hr.style.borderTop = "1px solid #444";
        hr.style.margin = "10px 0";
        plantBody.appendChild(hr);
      }

      const groupHeader = top.document.createElement("div");
      groupHeader.style.fontWeight = "bold";
      groupHeader.style.marginTop = "10px";
      groupHeader.style.cursor = "pointer";
      groupHeader.style.fontSize = "13px";

      const displayName = String(groupName).replace(/_/g, " ");
      try {
        webMI.data.call(
          "Standard_elpo",
          { Funktion: "Translate", Text: displayName, Sprache: uiLanguage },
          function (resp) {
            groupHeader.textContent = (resp && resp.result) ? resp.result : displayName;
          }
        );
      } catch (e) {
        groupHeader.textContent = displayName;
      }

      plantBody.appendChild(groupHeader);

      const groupBody = top.document.createElement("div");
      groupBody.style.marginLeft = "8px";
      groupBody.style.display = "none";
      plantBody.appendChild(groupBody);

      const hasVisibleInGroup = Object.values(groups[groupName]).some(function (arr) {
        return arr.some(function (s) { return s.visible; });
      });
      if (hasVisibleInGroup) groupBody.style.display = "block";

      groupHeader.addEventListener("click", function () {
        groupBody.style.display = (groupBody.style.display === "none") ? "block" : "none";
      });

      const subgroups = groups[groupName];
      const sortedSubNames = Object.keys(subgroups).sort(function (a, b) {
        if (a === "null") return -1;
        if (b === "null") return 1;
        return String(a).localeCompare(String(b));
      });

      sortedSubNames.forEach(function (sub) {
        let targetContainer = groupBody;

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
            subBody.style.display = (subBody.style.display === "none") ? "block" : "none";
          });

          groupBody.appendChild(subHeader);
          groupBody.appendChild(subBody);
          targetContainer = subBody;
        }

        const seriesList = subgroups[sub];
        seriesList
          .sort(function (a, b) { return a.name.localeCompare(b.name); })
          .forEach(function (s) {
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

              const range = getTimeRangeFromInputs();

              // X-Range synchron halten (ohne afterSetExtremes-Kaskade)
              suppressAfterSetExtremes = true;
              chartInstance.xAxis[0].setExtremes(
                range.from.getTime(),
                range.to.getTime(),
                false,
                false,
                { trigger: "internal" }
              );
              suppressAfterSetExtremes = false;

              if (!show) {
                // AUS -> Achsen/Redraw sofort
                if (!isLiveMode) updateYAxisRangesAndRedraw();
                else chartInstance.redraw();
                return;
              }

              // EIN -> Daten laden, DANACH redraw (sonst sieht man erst beim 2. Klick was)
              currentReloadToken++;
              fetchSeriesData(s, range.from, range.to, {
                redraw: false,
                token: currentReloadToken,
                onDone: function () {
                  if (!isLiveMode) updateYAxisRangesAndRedraw(); // enthält redraw
                  else chartInstance.redraw();
                }
              });
            });

            targetContainer.appendChild(row);
          });
      });
    });
  });
}


// ============================================================
// 10) CONFIG speichern (manual ignorieren)
// ============================================================

function saveCurrentConfig() {
  if (!chartInstance) return;

  const manualAddressSet = new Set(
    manualDefinitions
      .map(function (d) { return d && normalizeAddress(d.address); })
      .filter(function (a) { return typeof a === "string"; })
  );

  const config = { reload: true, source: "config", groups: [] };
  const grouped = {};

  chartInstance.series.forEach(function (s) {
    const opts = s.options || {};
    const addr = normalizeAddress(opts.address);
    if (!addr) return;

    // manual nicht speichern
    if (manualAddressSet.has(addr)) return;

    const g = opts.group || "Ungruppiert";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({ address: addr, visible: s.visible });
  });

  Object.keys(grouped).forEach(function (groupName) {
    config.groups.push({ name: groupName, variables: grouped[groupName] });
  });

  webMI.data.write(configAddress, JSON.stringify(config), function () {});
}


// ============================================================
// 11) CONFIG/BROWSE LADEN (Multi/Single/Legacy)
// ============================================================

function loadFromConfigOrBrowse() {
  webMI.data.read(configAddress, function (ce) {
    const rawConfig = ce && ce.value ? ce.value : null;
    const configObject = parseConfig(rawConfig);

    // 1) Config hat Priorität
    const configDefs = makeDefinitionsFromConfig(configObject);
    if (configDefs.length > 0) {
      addAllSeriesAndBuildLegend(configDefs, { saveAfterAdd: false });
      return;
    }

    // 2) Wenn Config leer/ungültig: browse und danach Config speichern
    const allAddresses = [];

    // Multi: pro Plant browsen
    if (isMultiPlantMode) {
      const plantsToBrowse = defaultPlantNames.slice(0);

      function browsePlant(index) {
        if (index >= plantsToBrowse.length) {
          const defs = allAddresses.map(function (addr) { return makeSeriesDefinitionFromAddress(addr); });
          addAllSeriesAndBuildLegend(defs, { saveAfterAdd: true });
          return;
        }

        const plant = plantsToBrowse[index];
        const browsePaths = [
          "AGENT.OBJECTS." + plant + ".Anlage",
          "AGENT.OBJECTS." + plant + ".System.Tagesprogramm"
        ];

        function browsePath(pathIndex) {
          if (pathIndex >= browsePaths.length) { browsePlant(index + 1); return; }

          const startAddress = browsePaths[pathIndex];
          webMI.data.call("BrowseNodes", { startAddress: startAddress }, function (tree) {
            if (startAddress.indexOf(".Anlage") !== -1) {
              allAddresses.push.apply(allAddresses, collectAnlageAddresses(tree));
            } else {
              allAddresses.push.apply(allAddresses, collectTagesprogrammAddresses(tree));
            }
            browsePath(pathIndex + 1);
          });
        }

        browsePath(0);
      }

      browsePlant(0);
      return;
    }

    // Single neues Schema
    if (singlePlantName) {
      const browsePathsSingle = [
        "AGENT.OBJECTS." + singlePlantName + ".Anlage",
        "AGENT.OBJECTS." + singlePlantName + ".System.Tagesprogramm"
      ];

      function browsePathSingle(index) {
        if (index >= browsePathsSingle.length) {
          const defs = allAddresses.map(function (addr) { return makeSeriesDefinitionFromAddress(addr); });
          addAllSeriesAndBuildLegend(defs, { saveAfterAdd: true });
          return;
        }

        const startAddress = browsePathsSingle[index];
        webMI.data.call("BrowseNodes", { startAddress: startAddress }, function (tree) {
          if (startAddress.indexOf(".Anlage") !== -1) {
            allAddresses.push.apply(allAddresses, collectAnlageAddresses(tree));
          } else {
            allAddresses.push.apply(allAddresses, collectTagesprogrammAddresses(tree));
          }
          browsePathSingle(index + 1);
        });
      }

      browsePathSingle(0);
      return;
    }

    // Legacy
    webMI.data.call("BrowseNodes", { startAddress: "AGENT.OBJECTS.Anlage" }, function (treeAnlage) {
      allAddresses.push.apply(allAddresses, collectAnlageAddresses(treeAnlage));

      webMI.data.call("BrowseNodes", { startAddress: "AGENT.OBJECTS.System.Tagesprogramm" }, function (treeTP) {
        allAddresses.push.apply(allAddresses, collectTagesprogrammAddresses(treeTP));

        const defs = allAddresses.map(function (addr) { return makeSeriesDefinitionFromAddress(addr); });
        addAllSeriesAndBuildLegend(defs, { saveAfterAdd: true });
      });
    });
  });
}


// ============================================================
// 12) CHART (Standard Highcharts Zoom/Reset)
// ============================================================

function createChart() {
  chartInstance = top.Highcharts.chart(document.getElementById("container"), {
    chart: {
      style: { fontSize: "11px" },
      events: {
        load: function () {
          loadFromConfigOrBrowse();
        }
      }
    },

    title: { text: "", useHTML: true },
    time: { useUTC: false },
    legend: { enabled: false },

    xAxis: {
      type: "datetime",
      events: {
        afterSetExtremes: function (e) {
          if (suppressAfterSetExtremes) return;
          if (!e || typeof e.min !== "number" || typeof e.max !== "number") return;

          setTimeRangeInputs(e.min, e.max);

          // User-Zoom / Navigator => Daten neu laden
          reloadVisibleSeries({ setExtremes: false, updateYAxis: !isLiveMode, redrawOnce: true });
        }
      }
    },

    yAxis: Array.from({ length: 7 }, function (_, i) {
      return { title: { text: "" }, opposite: i === 1 };
    }),

    plotOptions: {
      series: {
        boostThreshold: 2000,
        label: { enabled: true, connectorAllowed: false, style: { fontSize: "14px" } },
        marker: { enabled: false }
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

  // Initial extremes aus Inputs setzen
  const range = getTimeRangeFromInputs();
  suppressAfterSetExtremes = true;
  chartInstance.xAxis[0].setExtremes(range.from.getTime(), range.to.getTime(), false, false, { trigger: "internal" });
  suppressAfterSetExtremes = false;

  // Initial reload (falls bereits sichtbare Serien existieren)
  reloadVisibleSeries({ setExtremes: false, updateYAxis: true, redrawOnce: true });
}


// ============================================================
// 13) SORT LADEN (Multi/Single/Legacy) und Start
// ============================================================

function loadSortThenStart() {
  function start() {
    createChart();
    wireButtons();
  }

  // Multi: pro Plant SortOrder
  if (isMultiPlantMode) {
    let remaining = defaultPlantNames.length;

    defaultPlantNames.forEach(function (plantName) {
      const sortAddress = sortOrderAddressMulti[plantName];
      if (!sortAddress) {
        sortOrderByPlant[plantName] = null;
        remaining--;
        if (remaining === 0) start();
        return;
      }

      webMI.data.read(sortAddress, function (e) {
        sortOrderByPlant[plantName] = (e && e.value != null) ? e.value : null;
        remaining--;
        if (remaining === 0) start();
      });
    });

    return;
  }

  // Single neues Schema
  if (singlePlantName) {
    if (!sortOrderAddressSingle) {
      sortOrderByPlant[singlePlantName] = null;
      start();
      return;
    }

    webMI.data.read(sortOrderAddressSingle, function (e) {
      sortOrderByPlant[singlePlantName] = (e && e.value != null) ? e.value : null;
      start();
    });

    return;
  }

  // Legacy: q.SortierVariable -> legacySortOrderList
  if (!queryParams.SortierVariable) {
    legacySortOrderList = null;
    start();
    return;
  }

  webMI.data.read(queryParams.SortierVariable, function (e) {
    const raw = (e && e.value != null) ? e.value : null;
    const parsed = parseMaybeJson(raw);

    if (Array.isArray(parsed)) { legacySortOrderList = parsed; start(); return; }

    if (typeof raw === "string") {
      const parsed2 = parseMaybeJson(raw);
      if (Array.isArray(parsed2)) { legacySortOrderList = parsed2; start(); return; }
    }

    legacySortOrderList = null;
    start();
  });
}


// ============================================================
// 14) BUTTONS (Load + Live + Shift Left/Right)
// ============================================================

function wireButtons() {
  const loadButton = document.getElementById("loadBtn");
  const shiftLeftBtn = document.getElementById("shiftLeftBtn");
  const shiftRightBtn = document.getElementById("shiftRightBtn");
  const liveBtn = document.getElementById("liveBtn");

  // ------------------------------------------------------------
  // Helper: Shift-Buttons aktiv / deaktiv
  // ------------------------------------------------------------
  function updateShiftButtons() {
    const disabled = isLiveMode;

    [shiftLeftBtn, shiftRightBtn].forEach(function (btn) {
      if (!btn) return;

      btn.disabled = disabled;
      btn.style.opacity = disabled ? "0.4" : "1.0";
      btn.style.cursor = disabled ? "not-allowed" : "pointer";
    });
  }

  // ------------------------------------------------------------
  // LOAD BUTTON
  // ------------------------------------------------------------
  if (loadButton) {
    loadButton.addEventListener("click", function () {
      reloadVisibleSeries({ setExtremes: true, updateYAxis: true, redrawOnce: true });
    });
  }

  // ------------------------------------------------------------
  // SHIFT BUTTONS (nur Historie)
  // ------------------------------------------------------------
  function shiftTimeRange(direction) {
    if (!chartInstance) return;
    if (isLiveMode) return; // doppelte Sicherheit

    const range = getTimeRangeFromInputs();
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    if (isNaN(fromMs) || isNaN(toMs)) return;

    const span = toMs - fromMs;
    if (span <= 0) return;

    const newFromMs = fromMs + (direction * span);
    const newToMs = toMs + (direction * span);

    setTimeRangeInputs(newFromMs, newToMs);
    reloadVisibleSeries({ setExtremes: true, updateYAxis: true, redrawOnce: true });
  }

  if (shiftLeftBtn) {
    shiftLeftBtn.addEventListener("click", function () {
      if (!isLiveMode) shiftTimeRange(-1);
    });
  }

  if (shiftRightBtn) {
    shiftRightBtn.addEventListener("click", function () {
      if (!isLiveMode) shiftTimeRange(+1);
    });
  }

  // ------------------------------------------------------------
  // LIVE BUTTON
  // ------------------------------------------------------------
  if (!liveBtn) return;

  liveBtn.addEventListener("click", function () {
    isLiveMode = !isLiveMode;

    const startEl = document.getElementById("startTime");
    const endEl = document.getElementById("endTime");

    if (startEl) startEl.readOnly = isLiveMode;
    if (endEl) endEl.readOnly = isLiveMode;

    liveBtn.textContent = isLiveMode ? "T{Live}" : "T{Historie}";

    // <<< HIER: Shift-Buttons aktualisieren
    updateShiftButtons();

    if (isLiveMode) {
      if (liveIntervalHandle) clearInterval(liveIntervalHandle);
      liveIntervalHandle = null;

      const range = getTimeRangeFromInputs();
      const diff = range.to - range.from;
      liveWindowMs = (!isNaN(diff) && diff > 30 * 1000) ? diff : (3600 * 1000);

      function liveTick() {
        if (liveReloadBusy) return;

        const now = new Date();
        const from = new Date(now.getTime() - liveWindowMs);

        if (startEl) startEl.value = toLocalDatetimeString(from);
        if (endEl) endEl.value = toLocalDatetimeString(now);

        reloadVisibleSeries({ setExtremes: true, updateYAxis: false, redrawOnce: true });
      }

      liveTick();
      liveIntervalHandle = setInterval(liveTick, 5000);
    } else {
      if (liveIntervalHandle) clearInterval(liveIntervalHandle);
      liveIntervalHandle = null;

      liveReloadBusy = false;
      reloadVisibleSeries({ setExtremes: true, updateYAxis: true, redrawOnce: true });
    }
  });

  // ------------------------------------------------------------
  // Initialer Zustand (beim Start)
  // ------------------------------------------------------------
  updateShiftButtons();
}



// ============================================================
// 15) START
// ============================================================

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
      Language = top.language;

      const now = new Date();
      const defaultRangeMs = (parseInt(queryParams.Zeitbereich, 10) || (24 * 3600 * 1000));
      const past = new Date(now.getTime() - defaultRangeMs);

      const startEl = document.getElementById("startTime");
      const endEl = document.getElementById("endTime");
      if (startEl) startEl.value = toLocalDatetimeString(past);
      if (endEl) endEl.value = toLocalDatetimeString(now);

      loadSortThenStart();
    });
  }
);
]]></script>
</svg>
