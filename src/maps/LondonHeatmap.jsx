// src/charts/LondonHeatmap.jsx
import React from "react";
import * as d3 from "d3";

// top of file
const prefix = import.meta.env.BASE_URL;

// then use:
const GEO_URL  = `${prefix}london_boroughs.geojson`;
const DATA_URL = `${prefix}ldn_ar_we_hp.csv`;


// layout & style 
const WIDTH = 820, HEIGHT = 760, MARGIN = 28;
const COLORS = {
  missing: "#f3f4f6",     // light grey for missing
  stroke:  "#d1d5db",     // inner boundaries
  outline: "#73605b",     // outer crisp outline
  tooltipBg: "rgba(17,24,39,0.92)",
};

// softer reds
const TOP_RED        = "#9d6173ff"; // soft deep red for top 5
const TOP_RED_STROKE = "#9e2f50";

const fmtRatio = d3.format(".0f");
const fmtMoney = (v) => (Number.isFinite(v) ? "£" + d3.format(",.0f")(v) : "—");

// helpers 
function toNumber(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return NaN;
  return Number(s.replace(/£/g, "").replace(/\s+/g, "").replace(/,/g, "")); // UK thousands commas
}
function clean(s) {
  return String(s || "").toLowerCase().normalize("NFKD")
    .replace(/\u200b/g, "").replace(/&/g, " and ")
    .replace(/[-'’.,()]/g, " ").replace(/\s+/g, " ").trim();
}
function featureKey(f) {
  const p = f.properties || {};
  const code = p.code ?? p.LAD23CD ?? p.LAD22CD ?? p.LAD20CD ?? p.GSS_CODE ?? "";
  const name = p.name ?? p.LAD23NM ?? p.LAD22NM ?? p.LAD20NM ?? p.NAME ?? p.Borough ?? p.borough ?? "";
  return { code: String(code), name, key: String(code) || clean(name), label: name || code };
}

export default function LondonHeatmap() {
  const svgRef = React.useRef(null);
  const tipRef = React.useRef(null);

  const [years, setYears] = React.useState([]);
  const [year, setYear] = React.useState(null);
  const [geo, setGeo] = React.useState(null);
  const [byYearCode, setByYearCode] = React.useState(new Map());
  const [byYearName, setByYearName] = React.useState(new Map());

  // load once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, rows] = await Promise.all([
        d3.json(GEO_URL),
        d3.csv(DATA_URL, (d) => ({
          code: String(d.LA_code || "").trim(),
          name: String(d.LA_name || "").trim(),
          year: +d.year,
          workplace: toNumber(d.workplace),
          house_price: toNumber(d.house_price),
          affordability: toNumber(d.affordability),
        })),
      ]);
      if (cancelled) return;

      const group = d3.group(rows, (r) => r.year);
      const codes = new Map();
      const names = new Map();
      for (const [yr, arr] of group) {
        codes.set(yr, new Map(arr.map((r) => [r.code, r])));
        names.set(yr, new Map(arr.map((r) => [clean(r.name), r])));
      }
      const yearsSorted = Array.from(group.keys()).sort((a, b) => a - b);

      setGeo(g);
      setByYearCode(codes);
      setByYearName(names);
      setYears(yearsSorted);
      setYear(yearsSorted[yearsSorted.length - 1]);
    })();
    return () => { cancelled = true; };
  }, []);

  // redraw when geo or year changes
  React.useEffect(() => {
    if (!geo || !year || !byYearCode.has(year)) return;

    const rowsThisYear = Array.from(byYearCode.get(year).values());
    const affVals = rowsThisYear.map((r) => r.affordability).filter(Number.isFinite);

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tipRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`).style("width", "100%").style("height", "auto");

    const projection = d3.geoMercator().fitExtent(
      [[MARGIN, MARGIN], [WIDTH - MARGIN, HEIGHT - MARGIN]],
      geo
    );
    const path = d3.geoPath(projection);

    // adjust if ratios exceed this (kept fixed for comparability across years)
    const FIXED_MIN = 5;
    const FIXED_MAX = 25;

    // perceptually smooth grey→red and clamped
    const grey = d3.rgb("#f3f4f6");  
    const softRed = d3.rgb("#982339ff"); 
    const interpGreyRed = d3.interpolateLab(grey, softRed);
    const baseColor = d3.scaleSequential(interpGreyRed)
      .domain([FIXED_MIN, FIXED_MAX])
      .clamp(true);

    // --- top 5 cutoff per year (still subtle) ---
    const sortedDesc = affVals.slice().sort((a, b) => b - a);
    const TOPN = Math.min(5, sortedDesc.length);
    const topCut = sortedDesc[TOPN - 1] ?? sortedDesc[sortedDesc.length - 1];

    const byCode = byYearCode.get(year);
    const byName = byYearName.get(year);

    // polygons
    svg.append("g")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("fill", (f) => {
        const { code, key } = featureKey(f);
        const r = byCode.get(code) || byName.get(clean(key));
        const v = r?.affordability;
        if (!Number.isFinite(v)) return COLORS.missing;
        return baseColor(v);
      })
      .attr("stroke", (f) => {
        const { code, key } = featureKey(f);
        const r = byCode.get(code) || byName.get(clean(key));
        const v = r?.affordability;
        return Number.isFinite(v) && v >= topCut ? TOP_RED_STROKE : COLORS.stroke;
      })
      .attr("stroke-width", (f) => {
        const { code, key } = featureKey(f);
        const r = byCode.get(code) || byName.get(clean(key));
        const v = r?.affordability;
        return Number.isFinite(v) && v >= topCut ? 2 : 1;
      })
      .on("mouseenter", function () {
        d3.select(this).attr("stroke-width", 2.2);
        tooltip.style("display", "block");
      })
      .on("mouseleave", function () {
        const f = d3.select(this).datum();
        const { code, key } = featureKey(f);
        const r = byCode.get(code) || byName.get(clean(key));
        const v = r?.affordability;
        d3.select(this).attr("stroke-width", Number.isFinite(v) && v >= topCut ? 2 : 1);
        tooltip.style("display", "none");
      })
      .on("mousemove", function (event, f) {
        const { code, key, label } = featureKey(f);
        const r = byCode.get(code) || byName.get(clean(key));
        const ratio = r?.affordability;
        const price = r?.house_price;
        const earn  = r?.workplace;
        const isTop = Number.isFinite(ratio) && ratio >= topCut;

        const [x, y] = d3.pointer(event, this.ownerSVGElement);
        tooltip
          .style("left", `${x}px`)
          .style("top", `${y - 16}px`)
          .html(
            `<div style="font-weight:700; margin-bottom:4px">${label} — ${year}</div>` +
            `<div>Affordability ratio: <strong>${Number.isFinite(ratio) ? fmtRatio(ratio) : "—"}</strong></div>` +
            `<div>Median house price: <strong>${fmtMoney(price)}</strong></div>` +
            `<div>Workplace median pay: <strong>${fmtMoney(earn)}</strong></div>` +
            (isTop ? `<div style="margin-top:4px;font-size:11px;">
              <span style="display:inline-block;width:8px;height:8px;background:${TOP_RED};border-radius:2px;margin-right:6px;"></span>
              Top 5 most expensive
            </div>` : "")
          );
      });

    // outlines
    svg.append("g")
      .selectAll("path")
      .data(geo.features)
      .join("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", COLORS.outline)
      .attr("stroke-width", 0.75)
      .attr("pointer-events", "none");

    // legend (grey → red, fixed domain)
    const legendWidth = 260, legendHeight = 10;
    const legendX = WIDTH - legendWidth - 24, legendY = HEIGHT - 36;

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
      .attr("id", "legend-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");

    // build stops using the same interpolator so legend matches map
    d3.range(0, 1.0001, 0.1).forEach((t) => {
      grad.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", interpGreyRed(t));
    });

    svg.append("rect")
      .attr("x", legendX).attr("y", legendY)
      .attr("width", legendWidth).attr("height", legendHeight).attr("rx", 2)
      .attr("fill", "url(#legend-grad)").attr("stroke", "#e5e7eb");

    const axis = d3.axisBottom(
      d3.scaleLinear().domain([FIXED_MIN, FIXED_MAX]).range([legendX, legendX + legendWidth])
    ).ticks(5).tickSize(4).tickFormat(fmtRatio);

    svg.append("g")
      .attr("transform", `translate(0, ${legendY + legendHeight})`)
      .call(axis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.append("text")
          .attr("x", legendX + legendWidth / 2)
          .attr("y", 26)
          .attr("text-anchor", "middle")
          .attr("fill", "#6b7280")
          .attr("font-size", 12)
          .text("Affordability ratio (lower = more affordable)")
      );
  }, [geo, year, byYearCode, byYearName]);

  return (
    <div>
      {/* Minimal slider styles (neutral, no blue) */}
      <style>{`
        .range-neutral {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: #e5e7eb; /* light grey track */
          border-radius: 9999px;
          outline: none;
        }
        .range-neutral::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px; height: 14px;
          border-radius: 9999px;
          background: #6b7280; /* neutral grey thumb */
          border: 2px solid #f9fafb; /* subtle ring */
          cursor: pointer;
          margin-top: -5px; /* centers on track in WebKit */
        }
        .range-neutral::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 9999px;
          background: #6b7280;
          border: 2px solid #f9fafb;
          cursor: pointer;
        }
        .range-neutral::-ms-thumb {
          width: 14px; height: 14px;
          border-radius: 9999px;
          background: #6b7280;
          border: 2px solid #f9fafb;
          cursor: pointer;
        }
        .range-neutral::-webkit-slider-runnable-track {
          height: 4px; border-radius: 9999px; background: #e5e7eb;
        }
        .range-neutral::-moz-range-track {
          height: 4px; border-radius: 9999px; background: #e5e7eb;
        }
      `}</style>

      {years.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 10px" }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Year</label>
          <input
            className="range-neutral"
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={1}
            value={year ?? years[years.length - 1]}
            onChange={(e) => setYear(+e.target.value)}
            style={{ flex: 1 }}
          />
          <div style={{ width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {year ?? ""}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <svg ref={svgRef} />
        <div
          ref={tipRef}
          style={{
            position: "absolute",
            left: 0, top: 0,
            transform: "translate(-50%, -120%)",
            background: COLORS.tooltipBg,
            color: "#fcfcfc",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            display: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
}
