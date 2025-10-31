// src/charts/SalaryDumbbell.jsx
import React from "react";
import * as d3 from "d3";
import { useContainerSize } from "../hooks/useContainerSize";

const prefix = import.meta.env.BASE_URL;
const CSV_URL = `${prefix}ldn_salary_growth.csv`; // rows where Metric = "salary"

function parsePounds(v) {
  if (v == null) return NaN;
  const s = String(v).replace(/[\u00A0\s,]/g, "");
  const n = +s;
  return Number.isFinite(n) ? n : NaN;
}

export default function SalaryDumbbell({ fromYear = 2022, toYear = 2024 }) {
  const wrapRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const tipRef = React.useRef(null);
  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState("");

  // Container width for responsiveness
  const cw = useContainerSize(wrapRef, 840);
  const isSmall = cw < 480;

  // Load + prep
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await d3.csv(CSV_URL);
        const salaryRows = raw.filter(
          (r) => String(r.Metric ?? r.metric ?? "").toLowerCase() === "salary"
        );
        const fy = String(fromYear);
        const ty = String(toYear);

        const data = salaryRows
          .map((r) => {
            const name =
              r.LA_name ?? r.la_name ?? r.Borough ?? r.borough ?? r.name ?? "";
            const a = parsePounds(r[fy]);
            const b = parsePounds(r[ty]);
            const diff = Number.isFinite(a) && Number.isFinite(b) ? b - a : NaN;
            return { name, a, b, diff };
          })
          .filter((d) => d.name && Number.isFinite(d.a) && Number.isFinite(d.b));

        // Sort by end salary (highest at top)
        data.sort((a, b) => d3.descending(a.b, b.b));

        setRows(data);
        setErr("");
      } catch (e) {
        setErr(String(e));
        setRows([]);
      }
    })();
  }, [fromYear, toYear]);

  // Draw
  React.useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tip = d3.select(tipRef.current);
    svg.selectAll("*").remove();

    // --- Dynamic sizing (prevents “squeezed” chart on phones) ---
    const n = rows.length || 32;
    const perRow = isSmall ? 24 : 30;                 // vertical space per borough
    const base   = isSmall ? 120 : 160;               // top/bottom & axes space
    const H      = Math.min(1800, Math.max(base + perRow * n, isSmall ? 560 : 900));

    const DIMS = {
      w: cw,
      h: H,
      m: { t: 28, r: isSmall ? 80 : 150, b: 44, l: isSmall ? 110 : 240 },
    };

    svg
      .attr("viewBox", `0 0 ${DIMS.w} ${DIMS.h}`)
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block");

    if (err) {
      svg.append("text").attr("x", 20).attr("y", 40).attr("fill", "crimson").text(err);
      return;
    }
    if (!rows.length) {
      svg.append("text").attr("x", 20).attr("y", 40).text("Loading…");
      return;
    }

    const names = rows.map((d) => d.name);

    const y = d3
      .scaleBand()
      .domain(names)
      .range([DIMS.m.t, DIMS.h - DIMS.m.b])
      .padding(isSmall ? 0.25 : 0.4);

    const xs = rows.flatMap((d) => [d.a, d.b]);
    const [minX, maxX] = d3.extent(xs);
    const x = d3
      .scaleLinear()
      .domain([
        Math.floor((minX ?? 0) * 0.95),
        Math.ceil((maxX ?? 1) * 1.05),
      ])
      .nice()
      .range([DIMS.m.l, DIMS.w - DIMS.m.r]);

    const fmtGBP = d3.format(",.0f");
    const fmtSigned = d3.format("+,.0f");

    // X axis
    const xTicks = isSmall ? 4 : 6;
    svg
      .append("g")
      .attr("transform", `translate(0,${DIMS.h - DIMS.m.b})`)
      .call(d3.axisBottom(x).ticks(xTicks).tickFormat((d) => `£${fmtGBP(d)}`))
      .select(".domain")
      .attr("stroke", "#e5e7eb");

    // Y axis — fewer tick labels on small screens
    const showEvery = isSmall ? 2 : 1; // show every 2nd label on small
    const yTickValues = names.filter((_, i) => i % showEvery === 0);
    const yAxis = d3.axisLeft(y).tickValues(yTickValues);

    const gy = svg.append("g").attr("transform", `translate(${DIMS.m.l},0)`).call(yAxis);
    gy.select(".domain").attr("stroke", "#e5e7eb");
    gy.selectAll(".tick text").attr("font-size", isSmall ? 10 : 12);

    // Grid
    svg
      .append("g")
      .attr("stroke", "#f3f4f6")
      .selectAll("line")
      .data(x.ticks(xTicks))
      .join("line")
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", DIMS.m.t)
      .attr("y2", DIMS.h - DIMS.m.b);

    // Row groups
    const gRows = svg
      .append("g")
      .selectAll("g.row")
      .data(rows)
      .join("g")
      .attr("class", "row")
      .attr("transform", (d) => `translate(0, ${y(d.name) + y.bandwidth() / 2})`);

    const baseStroke = "#cbd5e1";
    const hiStroke = "#73605b";
    const cA = "#94a3b8"; // start
    const cB = "#9e2f50"; // end

    // Connector lines
    gRows
      .append("line")
      .attr("class", "connector")
      .attr("x1", (d) => x(d.a))
      .attr("x2", (d) => x(d.b))
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", baseStroke)
      .attr("stroke-width", 2);

    // Wide invisible hover area
    gRows
      .append("line")
      .attr("class", "hitline")
      .attr("x1", (d) => x(d.a))
      .attr("x2", (d) => x(d.b))
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "transparent")
      .attr("stroke-width", 22)
      .attr("pointer-events", "stroke")
      .on("mouseenter", function (event, d) {
        const g = d3.select(this.parentNode);
        g.select(".connector").attr("stroke", hiStroke).attr("stroke-width", 3);
        g.selectAll(".dotA,.dotB").attr("r", 6.5);
        showTip(event, d);
      })
      .on("mousemove", (event, d) => showTip(event, d))
      .on("mouseleave", function () {
        const g = d3.select(this.parentNode);
        g.select(".connector").attr("stroke", baseStroke).attr("stroke-width", 2);
        g.selectAll(".dotA,.dotB").attr("r", 5);
        hideTip();
      });

    // Dots
    const dotEvents = {
      mouseenter(event, d) {
        const g = d3.select(this.parentNode);
        g.select(".connector").attr("stroke", hiStroke).attr("stroke-width", 3);
        g.selectAll(".dotA,.dotB").attr("r", 6.5);
        showTip(event, d);
      },
      mousemove(event, d) {
        showTip(event, d);
      },
      mouseleave() {
        const g = d3.select(this.parentNode);
        g.select(".connector").attr("stroke", baseStroke).attr("stroke-width", 2);
        g.selectAll(".dotA,.dotB").attr("r", 5);
        hideTip();
      },
    };

    gRows
      .append("circle")
      .attr("class", "dotA")
      .attr("cx", (d) => x(d.a))
      .attr("cy", 0)
      .attr("r", 5)
      .attr("fill", cA)
      .on("mouseenter", dotEvents.mouseenter)
      .on("mousemove", dotEvents.mousemove)
      .on("mouseleave", dotEvents.mouseleave);

    gRows
      .append("circle")
      .attr("class", "dotB")
      .attr("cx", (d) => x(d.b))
      .attr("cy", 0)
      .attr("r", 5)
      .attr("fill", cB)
      .on("mouseenter", dotEvents.mouseenter)
      .on("mousemove", dotEvents.mousemove)
      .on("mouseleave", dotEvents.mouseleave);

    // Change labels
    gRows
      .append("text")
      .attr("class", "delta")
      .attr("x", (d) => x(Math.max(d.a, d.b)) + 8)
      .attr("y", 0)
      .attr("alignment-baseline", "middle")
      .attr("font-size", isSmall ? 10 : 11)
      .attr("fill", "#0f172a")
      .text((d) => `£${fmtSigned(d.diff)}`);

    // Tooltip
    function showTip(event, d) {
      const bbox = svgRef.current.getBoundingClientRect();
      const pageX = event.clientX - bbox.left;
      const pageY = event.clientY - bbox.top;
      tip
        .style("left", `${pageX}px`)
        .style("top", `${pageY - 16}px`)
        .style("display", "block")
        .html(
          `<div style="font-weight:700; margin-bottom:4px">${d.name}</div>
           <div>${fromYear}: <strong>£${fmtGBP(d.a)}</strong></div>
           <div>${toYear}: <strong>£${fmtGBP(d.b)}</strong></div>
           <div>Change: <strong>${fmtSigned(d.diff)}</strong></div>`
        );
    }
    function hideTip() {
      tip.style("display", "none");
    }
  }, [rows, err, fromYear, toYear, cw, isSmall]);

  return (
    <figure style={{ background: "#f8f1e7", borderRadius: 12, padding: 12 }}>
      <figcaption style={{ textAlign: "center", fontWeight: 600, marginBottom: 8 }}>
        Borough salaries: change from {fromYear} to {toYear}
      </figcaption>

      {/* Wrapper tracks width for resizing */}
      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <svg ref={svgRef} />
        <div
          ref={tipRef}
          style={{
            position: "absolute",
            pointerEvents: "none",
            background: "rgba(17,24,39,0.92)",
            color: "#f8f1e7",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            display: "none",
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            transform: "translate(-50%, -120%)",
          }}
        />
      </div>

      <p style={{ fontSize: 12, color: "#121212ff", textAlign: "center", marginTop: 4 }}>
        Source: ASHE workplace earnings (gross annual). Hover the line or dots to see levels and change.
      </p>
    </figure>
  );
}
