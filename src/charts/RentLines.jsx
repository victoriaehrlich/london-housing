// src/charts/piprSmallMultiples.jsx
import React from "react";
import * as d3 from "d3";

/**
 * Small-multiples for UK rental index (2015=100).
 * - One mini-chart per region (including London)
 * - The focal region is RED in its own panel
 * - UK is BLACK in every panel
 * - All other regions are GREY for context
 * - Optional hover tooltip per panel (on by default)
 *
 * CSV requirements (same as your current file):
 * date,uk,England,Wales,Scotland,northern_ireland,north_east,north_west,yorkshire,east_midlands,west_midlands,East ,London,south_east,south_west
 * 01/01/2015,81.3,81.5,82.2,79.7,75.1,86.1,79.5,81.9,76.6,79.0,76.4,86.3,79.7,76.0
 */

const DATA_URL = "/pipr_uk.csv";

const COLORS = {
  uk: "#111827", // black-ish
  focal: "#e11d48", // red
  other: "#9ca3af", // grey
  text: "#111827", // neutral text color for titles
  tooltipBg: "rgba(17,24,39,0.92)",
};

const DIMS = {
  w: 320,
  h: 220,
  m: { t: 24, r: 16, b: 26, l: 36 },
};

function pretty(key) {
  const replaced = String(key).split("_").join(" ");
  const words = replaced.trim().split(" ").filter(Boolean);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function normalizeSpaces(str) {
  return String(str).trim().split(" ").filter(Boolean).join("_");
}

// ---------- Parent component loads/normalises once ----------
export default function RentSmallMultiples({ showTooltip = true }) {
  const [rows, setRows] = React.useState([]);
  const [regionKeys, setRegionKeys] = React.useState([]); // excludes 'uk'
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    const parseDMY = d3.timeParse("%d/%m/%Y");

    d3.csv(DATA_URL, (r) => {
      const t = parseDMY(String(r.date || "").trim());
      const out = { t };
      for (const [rawK, rawV] of Object.entries(r)) {
        if (rawK === "date") continue;
        const key = normalizeSpaces(String(rawK).toLowerCase());
        const num = Number(String(rawV || "").split(',').join('.'));
        if (Number.isFinite(num)) out[key] = num;
      }
      return out;
    })
      .then((data) => {
        const clean = (data || [])
          .filter((d) => d.t instanceof Date && !isNaN(d.t))
          .sort((a, b) => a.t - b.t);
        if (!clean.length) throw new Error("No valid rows (check CSV).");

        const keys = Object.keys(clean[0]).filter((k) => k !== "t");
        const ukKey = "uk"; 
        const regions = keys.filter((k) => k !== ukKey);

        setRows(clean);
        setRegionKeys(regions);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;
  if (!rows.length || !regionKeys.length) return <div>Loading…</div>;

  const x = d3
    .scaleUtc()
    .domain(d3.extent(rows, (d) => d.t))
    .range([DIMS.m.l, DIMS.w - DIMS.m.r]);

  const allVals = regionKeys
    .concat(["uk"]) // include UK line
    .flatMap((k) => rows.map((r) => r[k]))
    .filter((v) => Number.isFinite(v));

  const y = d3
    .scaleLinear()
    .domain(d3.extent(allVals))
    .nice()
    .range([DIMS.h - DIMS.m.b, DIMS.m.t]);

  return (
    <section>
      <header style={{ textAlign: "center", marginBottom: 8 }}>
        <h3 style={{ fontWeight: 700, color: COLORS.text }}>Rent Price Index (2015 = 100): small multiples by region</h3>
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          UK in black, focal region in red, all other regions in grey. Shared axes across panels.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {regionKeys.map((rk) => (
          <SmallChart
            key={rk}
            rows={rows}
            x={x}
            y={y}
            focalKey={rk}
            allKeys={["uk", ...regionKeys]}
            showTooltip={showTooltip}
          />
        ))}
      </div>
    </section>
  );
}

// One per region 
function SmallChart({ rows, x, y, focalKey, allKeys, showTooltip }) {
  const svgRef = React.useRef(null);
  const tipRef = React.useRef(null);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tipRef.current);

    svg.selectAll("*").remove();
    svg
      .attr("viewBox", `0 0 ${DIMS.w} ${DIMS.h}`)
      .style("display", "block")
      .style("width", "100%")
      .style("height", "auto");

    // Axes (minimal)
    const xAxis = d3.axisBottom(x).ticks(4).tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).ticks(4).tickSizeOuter(0);

    svg
      .append("g")
      .attr("transform", `translate(0,${DIMS.h - DIMS.m.b})`)
      .attr("aria-hidden", true)
      .call(xAxis)
      .select(".domain")
      .attr("stroke", "#e5e7eb");

    svg
      .append("g")
      .attr("transform", `translate(${DIMS.m.l},0)`)
      .attr("aria-hidden", true)
      .call(yAxis)
      .select(".domain")
      .attr("stroke", "#e5e7eb");

    // Light horizontal gridlines
    svg
      .append("g")
      .attr("stroke", "#f3f4f6")
      .selectAll("line")
      .data(y.ticks(4))
      .join("line")
      .attr("x1", DIMS.m.l)
      .attr("x2", DIMS.w - DIMS.m.r)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));

    const line = d3
      .line()
      .x((d) => x(d.t))
      .y((d) => y(d.v));

    const valuesByKey = new Map(
      allKeys.map((k) => [k, rows.map((r) => ({ t: r.t, v: r[k] }))])
    );

    // Draw OTHER regions first (thin, grey)
    allKeys
      .filter((k) => k !== "uk" && k !== focalKey)
      .forEach((k) => {
        svg
          .append("path")
          .datum(valuesByKey.get(k))
          .attr("fill", "none")
          .attr("stroke", COLORS.other)
          .attr("stroke-opacity", 0.7)
          .attr("stroke-width", 1.2)
          .attr("d", line);
      });

    // Draw UK (thicker, black)
    if (valuesByKey.has("uk")) {
      svg
        .append("path")
        .datum(valuesByKey.get("uk"))
        .attr("fill", "none")
        .attr("stroke", COLORS.uk)
        .attr("stroke-width", 2.2)
        .attr("stroke-opacity", 1)
        .attr("d", line);
    }

    // Draw FOCAL region last (thicker, red)
    if (valuesByKey.has(focalKey)) {
      svg
        .append("path")
        .datum(valuesByKey.get(focalKey))
        .attr("fill", "none")
        .attr("stroke", COLORS.focal)
        .attr("stroke-width", 2.6)
        .attr("stroke-opacity", 1)
        .attr("d", line);

      // Panel title with latest value (neutral color)
      const last = rows[rows.length - 1];
      const v = last ? last[focalKey] : undefined;
      const title = pretty(focalKey);
      const label = Number.isFinite(v) ? `${title} — ${v.toFixed(1)}` : title;
      svg
        .append("text")
        .attr("x", DIMS.m.l)
        .attr("y", DIMS.m.t - 8)
        .attr("font-size", 12)
        .attr("font-weight", 700)
        .attr("fill", COLORS.text)
        .text(label);
    }

    if (!showTooltip) return;

    // Hover tooltip (date, focal & UK values) 
    const bisect = d3.bisector((d) => d.t).center;
    const guide = svg
      .append("line")
      .attr("y1", DIMS.m.t)
      .attr("y2", DIMS.h - DIMS.m.b)
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1)
      .attr("opacity", 0);

    svg
      .append("rect")
      .attr("fill", "transparent")
      .attr("pointer-events", "all")
      .attr("x", DIMS.m.l)
      .attr("y", DIMS.m.t)
      .attr("width", DIMS.w - DIMS.m.l - DIMS.m.r)
      .attr("height", DIMS.h - DIMS.m.t - DIMS.m.b)
      .style("cursor", "crosshair")
      .on("mouseenter", () => {
        tooltip.style("display", "block");
        guide.attr("opacity", 1);
      })
      .on("mouseleave", () => {
        tooltip.style("display", "none");
        guide.attr("opacity", 0);
      })
      .on("mousemove", function (event) {
        const coords = d3.pointer(event, this);
        const mx = coords[0];
        const t = x.invert(mx);
        const i = bisect(rows, t);
        const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
        const fVal = r ? r[focalKey] : undefined;
        const ukVal = r ? r["uk"] : undefined;
        guide.attr("x1", x(r.t)).attr("x2", x(r.t));

        const box = wrapRef.current.getBoundingClientRect();
        const pageX = event.clientX - box.left;
        const pageY = event.clientY - box.top;
        tooltip
          .style("left", `${pageX}px`)
          .style("top", `${pageY}px`)
          .html(
            `<div style="font-weight:600; margin-bottom:4px">${d3.timeFormat("%b %Y")(r.t)}</div>` +
            `<div><strong>${pretty(focalKey)}</strong>: ${Number.isFinite(fVal) ? fVal.toFixed(1) : "–"}</div>` +
            `<div><strong>UK</strong>: ${Number.isFinite(ukVal) ? ukVal.toFixed(1) : "–"}</div>`
          );
      });
  }, [rows, x, y, focalKey, allKeys, showTooltip]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg ref={svgRef} />
      <div
        ref={tipRef}
        style={{
          position: "absolute",
          pointerEvents: "none",
          background: COLORS.tooltipBg,
          color: "white",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.2,
          transform: "translate(-50%, -120%)",
          display: "none",
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}
      />
    </div>
  );
}
