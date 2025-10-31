// src/charts/InflationYoYTwoSeries.jsx
import React from "react";
import * as d3 from "d3";
import { useContainerSize } from "../hooks/useContainerSize";

const prefix = import.meta.env.BASE_URL;
// ❗ remove the extra slash — BASE_URL already ends with "/"
const DATA_URL = `${prefix}pipr_hpi_uk.csv`;
const INFL_URL = `${prefix}uk_inflation_rate.csv`;

const COLORS = {
  rent:  "#73605b",   // Private rents
  house: "#9e2f50",   // House prices
  infl:  "#6b7280",   // Inflation (grey)
  ann:   "#9ca3af",   // Annotation line
  annText: "#111827",
};

const ANNOTATIONS = [
  { date: "2020-03-23", label: "UK lockdown\nbegins" },
  { date: "2021-12-16", label: "BoE first\nrate hike" },
  { date: "2022-09-23", label: "Mini-budget" },
  { date: "2025-03-01", label: "SDLT change" },
];

export default function InflationYoYTwoSeries() {
  const wrapRef = React.useRef(null);
  const ref = React.useRef(null);
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState("");

  // Responsive size from container
  const cw = useContainerSize(wrapRef, 840);
  const isSmall = cw < 520;

  const DIMS = {
    w: cw,
    h: isSmall ? 480 : 700,                  // a touch taller on phones
   m: { t: 40, r: isSmall ? 36 : 100, b: 40, l: isSmall ? 36 : 80 }, // tighter side margins on phones
  };

  // ---- Load & join datasets ----
  React.useEffect(() => {
    const parseDMY  = d3.timeParse("%d/%m/%Y");
    const parseMY   = d3.timeParse("%b-%y");
    const parseMYsp = d3.timeParse("%b %Y");
    const parseYMD  = d3.timeParse("%Y-%m-%d");
    const parseYM   = d3.timeParse("%Y-%m");

    const smartDate = (v) => {
      const s = String(v ?? "").trim();
      return (
        parseMY(s)   ||
        parseMYsp(s) ||
        parseDMY(s)  ||
        parseYMD(s)  ||
        parseYM(s)   ||
        (isNaN(Date.parse(s)) ? null : new Date(s))
      );
    };

    Promise.all([
      d3.csv(DATA_URL, (r) => {
        const t     = smartDate(r.Date ?? r.date);
        const pipr  = Number(String(r.pipr   ?? r.PIPR   ?? "").replace(",", "."));
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

        // Merge on nearest month
        const merged = rentClean.map((d) => {
          const match = inflClean.find((r) => Math.abs(r.t - d.t) < 40 * 24 * 60 * 60 * 1000);
          return { ...d, inflation: match ? match.inflation : NaN };
        });

        if (!merged.length) throw new Error("No valid rows after parsing (check CSV paths).");
        setRows(merged);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  // Draw chart 
  React.useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${DIMS.w} ${DIMS.h}`)
      .style("display", "block")
      .style("width", "100%")
      .style("height", "auto");

    if (err) {
      svg.append("text").attr("x", 20).attr("y", 40).attr("fill", "crimson").text(`Error: ${err}`);
      return;
    }
    if (!rows.length) {
      svg.append("text").attr("x", 20).attr("y", 40).text("Loading…");
      return;
    }

    const x = d3.scaleUtc()
      .domain(d3.extent(rows, (d) => d.t))
      .range([DIMS.m.l, DIMS.w - DIMS.m.r]);

    const [minY, maxY] = d3.extent(rows.flatMap((d) => [d.rentYoY, d.houseYoY, d.inflation]));
    const pad = (maxY - minY) * 0.1 || 1;
    const y = d3.scaleLinear()
      .domain([minY - pad, maxY + pad])
      .nice()
      .range([DIMS.h - DIMS.m.b, DIMS.m.t]);

    const bottomTicks = isSmall ? 4 : 7;
    const leftTicks   = isSmall ? 4 : 7;

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${DIMS.h - DIMS.m.b})`)
      .call(d3.axisBottom(x).ticks(bottomTicks))
      .select(".domain").attr("stroke", "#e5e7eb");

    svg.append("g")
      .attr("transform", `translate(${DIMS.m.l},0)`)
      .call(d3.axisLeft(y).ticks(leftTicks).tickFormat((d) => `${d}%`))
      .select(".domain").attr("stroke", "#e5e7eb");

    // Grid
    svg.append("g").attr("stroke", "#f3f4f6")
      .selectAll("line")
      .data(y.ticks(leftTicks))
      .join("line")
      .attr("x1", DIMS.m.l).attr("x2", DIMS.w - DIMS.m.r)
      .attr("y1", (d) => y(d)).attr("y2", (d) => y(d));

    svg.append("line")
      .attr("x1", DIMS.m.l).attr("x2", DIMS.w - DIMS.m.r)
      .attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", "#ddd");

    // Lines
    const lineRent  = d3.line().x(d => x(d.t)).y(d => y(d.rentYoY)).curve(d3.curveMonotoneX);
    const lineHouse = d3.line().x(d => x(d.t)).y(d => y(d.houseYoY)).curve(d3.curveMonotoneX);
    const lineInfl  = d3.line().x(d => x(d.t)).y(d => y(d.inflation)).curve(d3.curveMonotoneX);

    svg.append("path").datum(rows)
      .attr("fill", "none").attr("stroke", COLORS.rent)
      .attr("stroke-width", 2.5).attr("d", lineRent);

    svg.append("path").datum(rows)
      .attr("fill", "none").attr("stroke", COLORS.house)
      .attr("stroke-width", 2.5).attr("d", lineHouse);

    svg.append("path").datum(rows)
      .attr("fill", "none").attr("stroke", COLORS.infl)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 3")
      .attr("d", lineInfl);

    // End labels (slightly smaller on mobile)
    const last = rows[rows.length - 1];
    const lblSize = isSmall ? 11 : 12;
    svg.append("text")
      .attr("x", x(last.t) + 6).attr("y", y(last.rentYoY))
      .attr("alignment-baseline", "middle").attr("font-size", lblSize).attr("fill", COLORS.rent)
      .text("Private rents");
    svg.append("text")
      .attr("x", x(last.t) + 6).attr("y", y(last.houseYoY))
      .attr("alignment-baseline", "middle").attr("font-size", lblSize).attr("fill", COLORS.house)
      .text("House prices");
    svg.append("text")
      .attr("x", x(last.t) + 6).attr("y", y(last.inflation))
      .attr("alignment-baseline", "middle").attr("font-size", lblSize).attr("fill", COLORS.infl)
      .text("Inflation");

    // Annotations
    const tf = d3.timeFormat("%b %Y");
    const parseISO = d3.timeParse("%Y-%m-%d");
    const bisectLeft = d3.bisector((d) => d.t).left;

    const inflAt = (t) => {
      const i = Math.max(1, Math.min(rows.length - 1, bisectLeft(rows, t)));
      const a = rows[i - 1], b = rows[i];
      if (!Number.isFinite(a?.inflation)) return b?.inflation;
      if (!Number.isFinite(b?.inflation)) return a?.inflation;
      const u = (t - a.t) / (b.t - a.t);
      return a.inflation + u * (b.inflation - a.inflation);
    };

    const topBase = DIMS.m.t - 10; // top label baseline
    const annData = ANNOTATIONS.map((a, idx) => {
      const t = parseISO(a.date) || new Date(a.date);
      if (!(t instanceof Date) || isNaN(t) || t < x.domain()[0] || t > x.domain()[1]) return null;
      const v = inflAt(t);
      if (!Number.isFinite(v)) return null;
      const px = x(t);
      const py = y(v);
      const labelY = topBase - ((idx % 4) * 10); // stagger a bit
      return { ...a, t, px, py, labelY };
    }).filter(Boolean);

    const gAnn = svg.append("g").attr("class", "annotations");

    gAnn.selectAll("line.vline")
      .data(annData)
      .join("line")
      .attr("class", "vline")
      .attr("x1", d => d.px).attr("x2", d => d.px)
      .attr("y1", DIMS.m.t).attr("y2", DIMS.h - DIMS.m.b)
      .attr("stroke", COLORS.ann)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.9);

    gAnn.selectAll("circle.marker")
      .data(annData)
      .join("circle")
      .attr("class", "marker")
      .attr("cx", d => d.px).attr("cy", d => d.py)
      .attr("r", 4)
      .attr("fill", COLORS.ann)
      .attr("stroke", "white")
      .attr("stroke-width", 1.2);

    gAnn.selectAll("text.toplabel")
      .data(annData)
      .join("text")
      .attr("class", "toplabel")
      .attr("x", d => d.px + 4)
      .attr("y", d => d.labelY)
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", COLORS.annText)
      .text(d => d.label);

    // Hover overlay & tooltip
    const tooltip = d3.select(ref.current.parentNode).select("#hpi-tooltip");
    const guide = svg.append("line")
      .attr("y1", DIMS.m.t).attr("y2", DIMS.h - DIMS.m.b)
      .attr("stroke", "#d1d5db").attr("stroke-width", 1).attr("opacity", 0);

    const focusRent  = svg.append("g").style("display", "none");
    focusRent.append("circle").attr("r", 4.5).attr("fill", COLORS.rent).attr("stroke", "white").attr("stroke-width", 1.5);

    const focusHouse = svg.append("g").style("display", "none");
    focusHouse.append("circle").attr("r", 4.5).attr("fill", COLORS.house).attr("stroke", "white").attr("stroke-width", 1.5);

    const focusInfl  = svg.append("g").style("display", "none");
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
        focusInfl .attr("transform", `translate(${x(d.t)},${y(d.inflation)})`);
        guide.attr("x1", x(d.t)).attr("x2", x(d.t));

        const bbox = this.getBoundingClientRect();
        const pageX = event.clientX - bbox.left;
        const pageY = event.clientY - bbox.top;

        const inflTxt = Number.isFinite(d.inflation) ? `${d.inflation.toFixed(1)}%` : "—";
        const tf2 = d3.timeFormat("%b %Y");
        tooltip
          .style("left", `${pageX}px`)
          .style("top", `${pageY}px`)
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
  }, [rows, err, cw, isSmall]);

  return (
    <figure style={{ background: "#f8f1e7", borderRadius: 12, padding: 12 }}>
      <figcaption style={{ marginBottom: 8, fontWeight: 600, textAlign: "center" }}>
        UK house price inflation, rent inflation, and CPI inflation (YoY %)
      </figcaption>

      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <svg ref={ref} />
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
