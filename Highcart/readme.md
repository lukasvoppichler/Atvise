# Multi-Plant Highcharts (atvise / WebMI) – Tree-Legende, Live + Shift, ohne Pad-Serien

Dieses Projekt ist ein **SVG/<foreignObject>-basiertes Highcharts-Trenddiagramm** für **atvise/WebMI** mit:

- **Multi-Plant-Modus** (Plant = `ALL` → Biometano / Belagreen / BBO)
- **Single-Plant-Modus** (Plant = `<Name>`)
- **Legacy-Modus** (Plant leer → alte Struktur)
- **Tree-Legende**: Plant → Group → Subgroup → Serien
- **Live-Modus** (Rolling Window) + **Historie**
- **Shift Left/Right** (nur Historie)
- **OHNE Pad-Serien** (keine erfundenen Punkte, keine Backfill/Forwardfill-Linien)
- **Echte Archivpunkte**: Tooltip/Timestamps nur für echte Daten aus dem Archiv

---

## Inhaltsverzeichnis

- [Features](#features)
- [Modi](#modi)
- [Adress-Schemata](#adress-schemata)
- [Aggregation & Archive-Strategie](#aggregation--archive-strategie)
- [Query-Parameter](#query-parameter)
- [Konfiguration (Config) & Auto-Browse](#konfiguration-config--auto-browse)
- [Tree-Legende](#tree-legende)
- [Live-Modus](#live-modus)
- [Export](#export)
- [Einbau / Setup](#einbau--setup)
- [Troubleshooting](#troubleshooting)
- [Changelog / Notes](#changelog--notes)

---

## Features

### ✅ Multi-Plant / Single / Legacy
- `Plant=ALL` → lädt und zeigt Plants: **Biometano, Belagreen, BBO**
- `Plant=<PlantName>` → Single-Plant (z.B. `Biometano`)
- `Plant` leer → Legacy (kein Multi-Header, globaler Config-Pfad)

### ✅ Tree-Legende
Hierarchischer Aufbau:
- **Plant**
  - **Group** (z.B. Fermenter_1)
    - **Subgroup** (optional)
      - **Serie**

Serien können per Klick ein-/ausgeblendet werden. Beim Aktivieren wird die Serie **lazy geladen**.

### ✅ Live + Historie
- Live-Toggle schaltet zwischen Historie und Live.
- Live verwendet ein Rolling Window (Default: die aktuell eingestellte Spanne).
- Shift-Buttons sind im Live-Modus deaktiviert.

### ✅ Keine Pad-Serien
- Es werden **keine künstlichen Punkte** erzeugt.
- Es gibt **keine** Backfill/Forwardfill-Linien.
- Tooltip/Zeitstempel entstehen nur aus **echten Archivpunkten**.

---

## Modi

### Multi-Plant-Modus
Aktiv, wenn:
- `Plant=ALL`

Dann:
- Config liegt global:  
  `AGENT.OBJECTS.System.Diagramm.Konfiguriert`
- SortOrder wird pro Plant geladen:
  - `AGENT.DISPLAYS.MAIN.Biometano.Anlage.SortOrder`
  - `AGENT.DISPLAYS.MAIN.Belagreen.Anlage.SortOrder`
  - `AGENT.DISPLAYS.MAIN.BBO.Anlage.SortOrder`
- Browse läuft pro Plant über:
  - `AGENT.OBJECTS.<Plant>.Anlage`
  - `AGENT.OBJECTS.<Plant>.System.Tagesprogramm`

### Single-Plant-Modus
Aktiv, wenn:
- `Plant=<PlantName>` (und nicht ALL)

Dann:
- Config pro Plant:  
  `AGENT.OBJECTS.<Plant>.System.Diagramm.Konfiguriert`
- SortOrder:
  - Default: `AGENT.DISPLAYS.MAIN.<Plant>.Anlage.SortOrder`
  - Optional überschreibbar via `SortierVariable`

### Legacy-Modus
Aktiv, wenn:
- `Plant` leer oder fehlt

Dann:
- Config global:  
  `AGENT.OBJECTS.System.Diagramm.Konfiguriert`
- Browse:
  - `AGENT.OBJECTS.Anlage`
  - `AGENT.OBJECTS.System.Tagesprogramm`

---

## Adress-Schemata

### Anlage (Legacy)
AGENT.OBJECTS.Anlage.<Group>.<Name>.IOs.(Istwert|Position_Istwert|Status|Zustand)


### Anlage (Multi/Single – Plant-Schema)
AGENT.OBJECTS.<Plant>.Anlage.<Group>.<Name>.IOs.(Istwert|Position_Istwert|Status|Zustand)


### Tagesprogramm
Multi/Single/Legacy möglich:
AGENT.OBJECTS.(<Plant>.)?System.Tagesprogramm.<...>.Heute.IW_Menge_Tag


---

## Aggregation & Archive-Strategie

### Grundregeln (so wie implementiert)
- **Status / Zustand** → immer **RAW** (keine Aggregation)
- **Tagesprogramm** → immer **RAW**
- **Analoge Messwerte**:
  - **< 2 Wochen**:  
    **Sampled 5m + RAW Merge**, RAW gewinnt bei gleichen Timestamps
  - **≥ 2 Wochen**:  
    **nur Average 10m** (kein Sampled, kein Merge)

### Archive (Fallback-Kaskaden)

#### Status/Zustand & Tagesprogramm
1. RAW mit `archive=RAW`
2. RAW ohne `archive` (Fallback)

#### Analog ≥ 2 Wochen (Average 10m)
1. Average 10m mit `archive=RAW`
2. Average 10m ohne `archive`
3. RAW ohne archive/aggregation (letzter Fallback)

#### Analog < 2 Wochen (Sampled + RAW)
1. Sampled 5m mit `archive=SAMPLED_5MIN` + RAW Merge (RAW bevorzugt)
2. Sampled 5m ohne archive + RAW Merge
3. Wenn alles leer: RAW ohne Agg/Archive und Debug-Fallback (7 Tage)

> Hinweis: Das Projekt **erzeug illuminated keine Pad-Punkte**. Wenn keine Punkte geliefert werden, ist die Serie tatsächlich leer im Zeitraum.

---

## Query-Parameter

Diese Parameter werden über `webMI.query` erwartet:

| Parameter | Beispiel | Bedeutung |
|---|---:|---|
| `Plant` | `ALL` / `Biometano` / *(leer)* | Modus-Auswahl |
| `Variable` | `AGENT.OBJECTS....` | Optionaler Base-Filter bzw. initial sichtbare Serien |
| `Zeitbereich` | `86400000` | Initialer Zeitraum in ms (Default 24h) |
| `SortierVariable` | `AGENT.DISPLAYS....SortOrder` | SortOrder Override (v.a. Legacy/Single) |
| `RawArchiv` | `RAW` | Name des RAW-Archivs (Default: `RAW`) |
| `SampledArchiv` | `SAMPLED_5MIN` | Name des Sampled-Archivs (Default: `SAMPLED_5MIN`) |

---

## Konfiguration (Config) & Auto-Browse

### Config-Format
Die Konfiguration wird als JSON in `configAddress` gespeichert:

```json
{
  "reload": true,
  "source": "config",
  "groups": [
    {
      "name": "Fermenter_1",
      "variables": [
        { "address": "AGENT.OBJECTS....IOs.Istwert", "visible": true },
        { "address": "AGENT.OBJECTS....IOs.Status", "visible": false }
      ]
    }
  ]
}
Priorität
Config vorhanden → wird geladen

Config fehlt/ungültig → es wird BrowseNodes ausgeführt und anschließend Config gespeichert

Manual Definitions (extern)
Manuelle Serien (z.B. „Allgemein“) werden:

immer geladen

nie in die Config geschrieben (werden beim Speichern ignoriert)

Tree-Legende
Legende wird aus chartInstance.series aufgebaut.

Gruppierung:

Plant aus series.options.plant oder per detectPlantFromAddress()

Group aus series.options.group

Subgroup optional (series.options.subgroup)

Klick auf Serie:

toggelt Sichtbarkeit

bei Aktivierung: lazy load der Daten

Live-Modus
Aktivierung per Button liveBtn

Rolling Window basiert auf der aktuell eingestellten Spanne:

Wenn User z.B. 2h eingestellt hat → Live läuft als „letzte 2h“

Interval: alle 5 Sekunden

Im Live-Modus:

Shift-Buttons disabled

Achsen werden nicht auto-neu skaliert (Performance/Stabilität)

Export
Highcharts Exporting ist aktiv:

Offline Exporting

Source Size: 1700x940

Kein Export-Server (offline)

Einbau / Setup
Voraussetzungen
atvise/WebMI Projekt

SVG Display mit <foreignObject> (oder HTML Display)

Highcharts Libraries via webMI.libraryLoader.load(...)

Minimal benötigte HTML-IDs
Im DOM müssen vorhanden sein:

container (Chart Container)

html-tree (Legend Container)

startTime / endTime (Datetime Inputs)

loadBtn (Load)

shiftLeftBtn / shiftRightBtn (Shift)

liveBtn (Live Toggle)

Troubleshooting
1) Keine Daten im Zeitraum
Prüfe, ob überhaupt Archivpunkte existieren (RAW/SAMPLED).

Bei „heute nicht im Timespan“: Es gibt dann wirklich keine Punkte → keine Pads im Projekt.

2) Average liefert 0 Punkte
Manche Archive unterstützen ggf. keine Aggregation → dann greift Fallback auf RAW.

3) Live wirkt „ruckelig“
Im Live-Modus werden Daten regelmäßig neu abgefragt.

Bei vielen sichtbaren Serien kann das Last erzeugen → weniger Serien sichtbar lassen.

4) SortOrder wirkt falsch
SortOrder pro Plant prüfen (...Anlage.SortOrder)

Strings werden normalisiert (T{...} entfernt, Sonderzeichen raus, underscore-normalisiert)

Changelog / Notes
Entfernt: Pad-Serien / erfundene Punkte / Backfill-Logik

Status/Zustand + Tagesprogramm immer RAW

Analog:

<2 Wochen: Sampled 5m + RAW Merge

≥2 Wochen: nur Average 10m

Multi-Plant nur bei Plant=ALL

Legacy bei leerem Plant

