// src/charts/InflationYoYTwoSeries.jsx
import React from "react";
import * as d3 from "d3";

const prefix = import.meta.env.BASE_URL;
const DATA_URL = `${prefix}pipr_hpi_uk.csv`;
const INFL_URL = `${prefix}uk_inflation_rate.csv`;

const DIMS = {
  w: 920,
  h: 700,
  // slightly bigger right margin for safety
  m: { t: 40, r: 72, b: 44, l: 56 },
};

const COLORS = {
  rent: "#73605b",
  house: "#9e2f50",
  infl: "#6b7280",
  ann: "#9ca3af",
  annText: "#111827",
};

const ANNOTATIONS = [
  { date: "2020-03-23", label: "UK lockdown\nbegins" },
  { date: "2021-12-16", label: "BoE first\nrate hike" },
  { date: "2022-09-23", label: "Mini-budget" },
  { date: "2025-03-01", label: "SDLT change" },
];

export default function InflationYoYTwoSeries() {
  const ref = React.useRef(null);
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState("");

  // ---- Load & join datasets ----
  React.useEffect(() => {
    const parseDMY = d3.timeParse("%d/%m/%Y");
    const parseMY = d3.timeParse("%b-%y");
    const parseMYsp = d3.timeParse("%b %Y");
    const parseYMD = d3.timeParse("%Y-%m-%d");
    const parseYM = d3.timeParse("%Y-%m");
    const smartDate = (v) => {
      const s = String(v ?? "").trim();
      return (
        parseMY(s) ||
        parseMYsp(s) ||
        parseDMY(s) ||
        parseYMD(s) ||
        parseYM(s) ||
        (isNaN(Date.parse(s)) ? null : new Date(s))
      );
    };

    Promise.all([
      d3.csv(DATA_URL, (r) => {
        const t = smartDate(r.Date ?? r.date);
        const pipr = Number(String(r.pipr ?? r.PIPR ?? "").replace(",", "."));
        const ukHpi = Number(String(r.uk_hpi ?? r.UK_HPI ?? "").replace(",", "."));
        return { t, rentYoY: pipr, houseYoY: ukHpi };
      }),
      d3.csv(INFL_URL, (r) => {
        const t = smartDate(r.date);
        const inflation = Number(String(r.annual_rate ?? r.rate ?? "").replace(",", "."));
        return { t, inflation };
      }),
    ])
      .then(([rentData, inflData]) => {
        const rentClean = (rentData || [])
          .filter((d) => d.t instanceof Date && !isNaN(d.t))
          .sort((a, b) => a.t - b.t);

        const inflClean = (inflData || [])
          .filter((d) => d.t instanceof Date && !isNaN(d.t))
          .sort((a, b) => a.t - b.t);

        const merged = rentClean.map((d) => {
          const match = inflClean.find((r) => Math.abs(r.t - d.t) < 40 * 24 * 60 * 60 * 1000);
          return { ...d, inflation: match ? match.inflation : NaN };
        });

        if (!merged.length) throw new Error("No valid rows after parsing (check CSV paths).");
        setRows(merged);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  // ---- Draw ----
  React.useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${DIMS.w} ${DIMS.h}`)
      .style("display", "block")
      .style("width", "100%")
      .style("height", "auto")
      .style("overflow", "visible"); // allow labels beyond bounds

    if (err) {
      svg.append("text").attr("x", 20).attr("y", 40).attr("fill", "crimson").text(`Error: ${err}`);
      return;
    }
    if (!rows.length) {
      svg.append("text").attr("x", 20).attr("y", 40).text("Loading…");
      return;
    }

    const parseISO = d3.timeParse("%Y-%m-%d");
    const dataExtent = d3.extent(rows, (d) => d.t);

    const annDates = ANNOTATIONS
      .map((a) => parseISO(a.date) || new Date(a.date))
      .filter((d) => d instanceof Date && !isNaN(+d));

    const maxAnn = annDates.length ? new Date(Math.max(...annDates.map((d) => +d))) : dataExtent[1];
    const extraPadMs = 1000 * 60 * 60 * 24 * 240; // ~8 months pad on the right
    const domainMin = dataExtent[0];
    const domainMax = new Date(Math.max(+dataExtent[1], +maxAnn) + extraPadMs);

    const x = d3.scaleUtc().domain([domainMin, domainMax]).range([DIMS.m.l, DIMS.w - DIMS.m.r]);
    const [minY, maxY] = d3.extent(rows.flatMap((d) => [d.rentYoY, d.houseYoY, d.inflation]));
    const pad = (maxY - minY) * 0.1 || 1;
    const y = d3
      .scaleLinear()
      .domain([minY - pad, maxY + pad])
      .nice()
      .range([DIMS.h - DIMS.m.b, DIMS.m.t]);

    // Axes
    svg
      .append("g")
      .attr("transform", `translate(0,${DIMS.h - DIMS.m.b})`)
      .call(d3.axisBottom(x).ticks(7))
      .select(".domain")
      .attr("stroke", "#e5e7eb");

    svg
      .append("g")
      .attr("transform", `translate(${DIMS.m.l},0)`)
      .call(d3.axisLeft(y).ticks(7).tickFormat((d) => `${d}%`))
      .select(".domain")
      .attr("stroke", "#e5e7eb");

    // Grid lines
    svg
      .append("g")
      .attr("stroke", "#f3f4f6")
      .selectAll("line")
      .data(y.ticks(7))
      .join("line")
      .attr("x1", DIMS.m.l)
      .attr("x2", DIMS.w - DIMS.m.r)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));

    svg
      .append("line")
      .attr("x1", DIMS.m.l)
      .attr("x2", DIMS.w - DIMS.m.r)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#ddd");

    // Lines
    const lineRent = d3.line().x((d) => x(d.t)).y((d) => y(d.rentYoY)).curve(d3.curveMonotoneX);
    const lineHouse = d3.line().x((d) => x(d.t)).y((d) => y(d.houseYoY)).curve(d3.curveMonotoneX);
    const lineInfl = d3.line().x((d) => x(d.t)).y((d) => y(d.inflation)).curve(d3.curveMonotoneX);

    svg.append("path").datum(rows).attr("fill", "none").attr("stroke", COLORS.rent).attr("stroke-width", 2.5).attr("d", lineRent);
    svg.append("path").datum(rows).attr("fill", "none").attr("stroke", COLORS.house).attr("stroke-width", 2.5).attr("d", lineHouse);
    svg.append("path").datum(rows).attr("fill", "none").attr("stroke", COLORS.infl).attr("stroke-width", 2).attr("stroke-dasharray", "4 3").attr("d", lineInfl);

    // End labels
    const last = rows[rows.length - 1];
    const lblSize = 12;
    const rightLimit = DIMS.w - DIMS.m.r - 2;
    const labelX = (xVal) => Math.min(x(xVal) + 6, rightLimit);

    svg.append("text").attr("x", labelX(last.t)).attr("y", y(last.rentYoY)).attr("alignment-baseline", "middle").attr("font-size", lblSize).attr("fill", COLORS.rent).text("Private rents");
    svg.append("text").attr("x", labelX(last.t)).attr("y", y(last.houseYoY)).attr("alignment-baseline", "middle").attr("font-size", lblSize).attr("fill", COLORS.house).text("House prices");
    svg.append("text").attr("x", labelX(last.t)).attr("y", y(last.inflation)).attr("alignment-baseline", "middle").attr("font-size", lblSize).attr("fill", COLORS.infl).text("Inflation");

    // --- Annotations (safe inside visible area) ---
    const bisectLeft = d3.bisector((d) => d.t).left;
    const inflAt = (t) => {
      const i = Math.max(1, Math.min(rows.length - 1, bisectLeft(rows, t)));
      const a = rows[i - 1], b = rows[i];
      if (!Number.isFinite(a?.inflation)) return b?.inflation;
      if (!Number.isFinite(b?.inflation)) return a?.inflation;
      const u = (t - a.t) / (b.t - a.t);
      return a.inflation + u * (b.inflation - a.inflation);
    };

    const topBase = DIMS.m.t + 6;  // moved inside chart
    const rightEdge = DIMS.w - DIMS.m.r - 8;
    const padX = 4;

    const annData = ANNOTATIONS.map((a, idx) => {
      const t = parseISO(a.date) || new Date(a.date);
      if (!(t instanceof Date) || isNaN(t)) return null;
      const v = inflAt(t);
      if (!Number.isFinite(v)) return null;
      return { ...a, t, px: x(t), py: y(v), labelY: topBase - ((idx % 4) * 10) };
    }).filter(Boolean);

    const gAnn = svg.append("g").attr("class", "annotations");

    gAnn.selectAll("line.vline").data(annData).join("line")
      .attr("class", "vline")
      .attr("x1", (d) => d.px)
      .attr("x2", (d) => d.px)
      .attr("y1", DIMS.m.t)
      .attr("y2", DIMS.h - DIMS.m.b)
      .attr("stroke", COLORS.ann)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.9);

    gAnn.selectAll("circle.marker").data(annData).join("circle")
      .attr("class", "marker")
      .attr("cx", (d) => d.px)
      .attr("cy", (d) => d.py)
      .attr("r", 4)
      .attr("fill", COLORS.ann)
      .attr("stroke", "white")
      .attr("stroke-width", 1.2);

    // label groups (measure width, clamp right)
    const labelGs = gAnn.selectAll("g.toplabel").data(annData).join("g").attr("class", "toplabel")
      .each(function (d) {
        const g = d3.select(this);
        const yPos = d.labelY;
        const startX = d.px + padX;
        const text = g.append("text")
          .attr("font-size", 12)
          .attr("font-weight", 700)
          .attr("fill", COLORS.annText)
          .attr("dominant-baseline", "alphabetic")
          .text(d.label);
        const b = text.node().getBBox();
        const totalW = b.width + 2 * padX;
        const finalX = Math.min(startX, rightEdge - totalW);
        g.attr("transform", `translate(${finalX},${yPos})`);
        g.insert("rect", "text")
          .attr("x", b.x - padX)
          .attr("y", b.y - 2)
          .attr("width", b.width + 2 * padX)
          .attr("height", b.height + 4)
          .attr("fill", "rgba(255,255,255,0.8)")
          .attr("rx", 2);
      });

    // Hover overlay & tooltip (unchanged)
    const tooltip = d3.select(ref.current.parentNode).select("#hpi-tooltip");
    const guide = svg.append("line").attr("y1", DIMS.m.t).attr("y2", DIMS.h - DIMS.m.b).attr("stroke", "#d1d5db").attr("stroke-width", 1).attr("opacity", 0);
    const focusRent = svg.append("g").style("display", "none");
    focusRent.append("circle").attr("r", 4.5).attr("fill", COLORS.rent).attr("stroke", "white").attr("stroke-width", 1.5);
    const focusHouse = svg.append("g").style("display", "none");
    focusHouse.append("circle").attr("r", 4.5).attr("fill", COLORS.house).attr("stroke", "white").attr("stroke-width", 1.5);
    const focusInfl = svg.append("g").style("display", "none");
    focusInfl.append("circle").attr("r", 4.5).attr("fill", COLORS.infl).attr("stroke", "white").attr("stroke-width", 1.5);

    const bisectCenter = d3.bisector((d) => d.t).center;
    svg.append("rect")
      .attr("fill", "transparent")
      .attr("pointer-events", "all")
      .attr("x", DIMS.m.l)
      .attr("y", DIMS.m.t)
      .attr("width", DIMS.w - DIMS.m.l - DIMS.m.r)
      .attr("height", DIMS.h - DIMS.m.t - DIMS.m.b)
      .style("cursor", "crosshair")
      .on("mouseenter", () => {
        focusRent.style("display", null);
        focusHouse.style("display", null);
        focusInfl.style("display", null);
        tooltip.style("display", "block");
        guide.attr("opacity", 1);
      })
      .on("mouseleave", () => {
        focusRent.style("display", "none");
        focusHouse.style("display", "none");
        focusInfl.style("display", "none");
        tooltip.style("display", "none");
        guide.attr("opacity", 0);
      })
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event, this);
        const t = x.invert(mx);
        const i = bisectCenter(rows, t);
        const d = rows[Math.max(0, Math.min(rows.length - 1, i))];
        focusRent.attr("transform", `translate(${x(d.t)},${y(d.rentYoY)})`);
        focusHouse.attr("transform", `translate(${x(d.t)},${y(d.houseYoY)})`);
        focusInfl.attr("transform", `translate(${x(d.t)},${y(d.inflation)})`);
        guide.attr("x1", x(d.t)).attr("x2", x(d.t));
        const bbox = this.getBoundingClientRect();
        const pageX = event.clientX - bbox.left;
        const pageY = event.clientY - bbox.top;
        const inflTxt = Number.isFinite(d.inflation) ? `${d.inflation.toFixed(1)}%` : "—";
        const tf2 = d3.timeFormat("%b %Y");
        tooltip
          .style("left", `${pageX}px`)
          .style("top", `${pageY - 14}px`)
          .html(
            `<div style="font-weight:600; margin-bottom:4px">${tf2(d.t)}</div>
             <div><span style="display:inline-block;width:10px;height:10px;background:${COLORS.rent};border-radius:50%;margin-right:6px"></span>
               Private rents: <strong>${d.rentYoY.toFixed(1)}%</strong></div>
             <div><span style="display:inline-block;width:10px;height:10px;background:${COLORS.house};border-radius:50%;margin-right:6px"></span>
               House prices: <strong>${d.houseYoY.toFixed(1)}%</strong></div>
             <div><span style="display:inline-block;width:10px;height:10px;background:${COLORS.infl};border-radius:50%;margin-right:6px"></span>
               Inflation: <strong>${inflTxt}</strong></div>`
          );
      });
  }, [rows, err]);

  return (
    <figure style={{ background: "#f8f1e7", borderRadius: 12, padding: 12, overflow: "visible" }}>
      <figcaption style={{ marginBottom: 8, fontWeight: 600, textAlign: "center" }}>
        UK house price inflation, rent inflation, and CPI inflation (YoY %)
      </figcaption>
      <div style={{ position: "relative", width: "100%" }}>
        <
svg ref={ref} />
        <div
          id="hpi-tooltip"
          style={{
            position: "absolute",
            pointerEvents: "none",
            background: "rgba(17,24,39,0.92)",
            color: "white",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.2,
            transform: "translate(-50%, -120%)",
            display: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
          }}
        />
      </div>

      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, textAlign: "center" }}>
        Source: ONS (Sep 2025). Hover the chart to read values; hover dashed markers for event dates.
      </p>
    </figure>
  );
}
