// src/charts/HpiLines.jsx
import React from "react";
import * as d3 from "d3";

const DIMS = { w: 1400, h: 700, m: { t: 40, r: 40, b: 60, l: 80 } };
const DATA_URL = "/hpi_uk_london.csv";

const COLORS = {
  uk_hpi: "#111827",     // black-ish
  london_hpi: "#e11d48", // red
  other: "#9ca3af",      // grey
  highlight: "#0f172a",  // dark navy highlight for “other” series when hovered
};

const pretty = (k) => {
  if (k === "uk_hpi") return "UK";
  if (k === "london_hpi") return "London";
  return String(k)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function HpiLines() {
  const ref = React.useRef(null);
  const tipRef = React.useRef(null);

  const [rows, setRows] = React.useState([]);
  const [series, setSeries] = React.useState([]); // [{key, values:[{t,v}]}]
  const [err, setErr] = React.useState("");

  // load & normalize
  React.useEffect(() => {
    const parseDMY = d3.timeParse("%d/%m/%Y");
    const cleanKey = (k) => String(k).trim().toLowerCase().replace(/\s+/g, "_");

    d3.csv(DATA_URL, (r) => {
      const t = parseDMY(String(r.date ?? "").trim());
      const out = { t };
      for (const [kRaw, vRaw] of Object.entries(r)) {
        if (kRaw === "date") continue;
        const k = cleanKey(kRaw);
        const num = Number(String(vRaw ?? "").replace(/,/g, "."));
        if (Number.isFinite(num)) out[k] = num;
      }
      return out;
    })
      .then((data) => {
        const clean = (data || [])
          .filter((d) => d.t instanceof Date && !isNaN(d.t))
          .sort((a, b) => a.t - b.t);
        if (!clean.length) throw new Error("No valid rows (check CSV).");

        const keys = Object.keys(clean[0]).filter((k) => k !== "t");
        const built = keys.map((key) => ({
          key,
          values: clean.map((d) => ({ t: d.t, v: d[key] })),
        }));

        setRows(clean);
        setSeries(built);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  // draw
  React.useEffect(() => {
    const svg = d3.select(ref.current);
    const tooltip = d3.select(tipRef.current);
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
    if (!rows.length || !series.length) {
      svg.append("text").attr("x", 20).attr("y", 40).text("Loading…");
      return;
    }

    const x = d3.scaleUtc()
      .domain(d3.extent(rows, (d) => d.t))
      .range([DIMS.m.l, DIMS.w - DIMS.m.r]);

    const allVals = series.flatMap((s) => s.values.map((p) => p.v));
    const y = d3.scaleLinear()
      .domain(d3.extent(allVals)).nice()
      .range([DIMS.h - DIMS.m.b, DIMS.m.t]);

    // axes + grid
    svg.append("g")
      .attr("transform", `translate(0,${DIMS.h - DIMS.m.b})`)
      .call(d3.axisBottom(x).ticks(7))
      .select(".domain").attr("stroke", "#e5e7eb");

    svg.append("g")
      .attr("transform", `translate(${DIMS.m.l},0)`)
      .call(d3.axisLeft(y).ticks(7))
      .select(".domain").attr("stroke", "#e5e7eb");

    svg.append("g").attr("stroke", "#f3f4f6")
      .selectAll("line")
      .data(y.ticks(7))
      .join("line")
      .attr("x1", DIMS.m.l).attr("x2", DIMS.w - DIMS.m.r)
      .attr("y1", (d) => y(d)).attr("y2", (d) => y(d));

    const line = d3.line().x((d) => x(d.t)).y((d) => y(d.v)).curve(d3.curveMonotoneX);

    const colorFor = (key) =>
      key === "uk_hpi" ? COLORS.uk_hpi
      : key === "london_hpi" ? COLORS.london_hpi
      : COLORS.other;

    const widthFor = (key) => (key === "uk_hpi" || key === "london_hpi" ? 2.6 : 1.4);
    const opacityFor = (key) => (key === "uk_hpi" || key === "london_hpi" ? 1 : 0.7);

    // draw lines and remember their path nodes
    const pathByKey = new Map();
    series
      .slice()
      .sort((a, b) => {
        const rank = (k) => (k === "uk_hpi" ? 2 : k === "london_hpi" ? 1 : 0);
        return rank(a.key) - rank(b.key);
      })
      .forEach((s) => {
        const path = svg.append("path")
          .datum(s.values)
          .attr("fill", "none")
          .attr("stroke", colorFor(s.key))
          .attr("stroke-width", widthFor(s.key))
          .attr("stroke-opacity", opacityFor(s.key))
          .attr("d", line)
          .attr("data-key", s.key);
        pathByKey.set(s.key, path);
      });

    // end labels (UK/London)
    const last = rows[rows.length - 1];
    if (Number.isFinite(last.uk_hpi))
      svg.append("text")
        .attr("x", x(last.t) + 6).attr("y", y(last.uk_hpi))
        .attr("alignment-baseline", "middle").attr("font-size", 12).attr("fill", COLORS.uk_hpi)
        .text("UK");
    if (Number.isFinite(last.london_hpi))
      svg.append("text")
        .attr("x", x(last.t) + 6).attr("y", y(last.london_hpi))
        .attr("alignment-baseline", "middle").attr("font-size", 12).attr("fill", COLORS.london_hpi)
        .text("London");

    // hover
    const bisect = d3.bisector((d) => d.t).center;
    const focus = svg.append("g").style("display", "none");
    focus.append("circle").attr("r", 4.5).attr("fill", COLORS.highlight).attr("stroke", "white").attr("stroke-width", 1.5);

    const guide = svg.append("line")
      .attr("y1", DIMS.m.t).attr("y2", DIMS.h - DIMS.m.b)
      .attr("stroke", "#d1d5db").attr("stroke-width", 1).attr("opacity", 0);

    // reset all to default styles
    const resetStyles = () => {
      series.forEach((s) => {
        const p = pathByKey.get(s.key);
        p && p
          .attr("stroke", colorFor(s.key))
          .attr("stroke-width", widthFor(s.key))
          .attr("stroke-opacity", opacityFor(s.key));
      });
    };

    svg.append("rect")
      .attr("fill", "transparent")
      .attr("pointer-events", "all")
      .attr("x", DIMS.m.l)
      .attr("y", DIMS.m.t)
      .attr("width", DIMS.w - DIMS.m.l - DIMS.m.r)
      .attr("height", DIMS.h - DIMS.m.t - DIMS.m.b)
      .style("cursor", "crosshair")
      .on("mouseenter", () => {
        focus.style("display", null);
        tooltip.style("display", "block");
        guide.attr("opacity", 1);
      })
      .on("mouseleave", () => {
        focus.style("display", "none");
        tooltip.style("display", "none");
        guide.attr("opacity", 0);
        resetStyles();
      })
      .on("mousemove", function (event) {
        const [mx, my] = d3.pointer(event, this);
        const t = x.invert(mx);
        const i = bisect(rows, t);
        const r = rows[Math.max(0, Math.min(rows.length - 1, i))];

        // pick nearest series by Y distance at this date
        let best = null;
        series.forEach((s) => {
          const v = r[s.key];
          if (!Number.isFinite(v)) return;
          const dy = Math.abs(y(v) - my);
          if (!best || dy < best.dy) best = { key: s.key, v, dy };
        });
        if (!best) return;

        // highlight chosen series
        resetStyles();
        const chosen = best.key;
        const chosenPath = pathByKey.get(chosen);
        if (chosenPath) {
          const stroke =
            chosen === "uk_hpi" ? COLORS.uk_hpi :
            chosen === "london_hpi" ? COLORS.london_hpi :
            COLORS.highlight;
          chosenPath.attr("stroke", stroke).attr("stroke-width", 3.2).attr("stroke-opacity", 1);
          focus.select("circle").attr(
            "fill",
            chosen === "uk_hpi" ? COLORS.uk_hpi :
            chosen === "london_hpi" ? COLORS.london_hpi :
            COLORS.highlight
          );
        }

        // move focus
        focus.attr("transform", `translate(${x(r.t)},${y(best.v)})`);
        guide.attr("x1", x(r.t)).attr("x2", x(r.t));

        // tooltip
        const box = ref.current.getBoundingClientRect();
        const pageX = event.clientX - box.left;
        const pageY = event.clientY - box.top;
        tooltip
          .style("left", `${pageX}px`)
          .style("top", `${pageY}px`)
          .html(
            `<div style="font-weight:600; margin-bottom:4px">${d3.timeFormat("%b %Y")(r.t)}</div>
             <div><strong>${pretty(chosen)}</strong>: ${best.v.toFixed(1)}</div>`
          );
      });
  }, [rows, series, err]);

  return (
    <figure style={{ background: "#fff", borderRadius: 12, padding: 12 }}>
      <figcaption style={{ marginBottom: 8, fontWeight: 600, textAlign: "center" }}>
        House Price Index (2015 = 100): UK, London and regions
      </figcaption>

      <div style={{ position: "relative" }}>
        <svg ref={ref} />
        <div
          ref={tipRef}
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
            zIndex: 10,
          }}
        />
      </div>

      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, textAlign: "center" }}>
        Grey = other regions; London = red; UK = black. Hover anywhere to see the nearest region at that date.
      </p>
    </figure>
  );
}
