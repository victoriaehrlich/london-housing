// src/App.jsx
import InflationYoYTwoSeries from "./charts/InflationYoYTwoSeries";
import SalaryDumbbell from "./charts/SalaryDumbbell";
import LondonHeatmap from "./maps/LondonHeatmap";

export default function App() {
  console.log("App.jsx loaded");

  const TEXT_MAX = 880; // text + chart max width

  return (
    <main
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "#fff7ecff",
        padding: "6vh 2vw",
      }}
    >
      {/* Outer content card */}
      <div
        style={{
          width: "clamp(360px, 90vw, 1200px)",
          margin: "0 auto",
          background: "#f8f1e7",
          borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: "24px 24px",
        }}
      >
        {/* --- Title + Intro --- */}
        <section
          style={{
            marginBottom: "6vh",
            color: "#1f2937",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ maxWidth: TEXT_MAX, width: "100%" }}>
            <h1
              style={{
                fontSize: 44,
                fontWeight: 800,
                marginBottom: 12,
                letterSpacing: "-0.02em",
                textAlign: "left",
              }}
            >
              Rents rise as the housing market cools
            </h1>

            <h3
              style={{
                fontSize: 20,
                fontWeight: 400,
                color: "#374151",
                lineHeight: 1.6,
                textAlign: "left",
              }}
            >
              The UK’s housing balance has flipped. After years of cheap borrowing and
              runaway house prices, interest rate hikes and the cost-of-living crisis
              have slowed buying but pushed rents higher. What does this shift mean for
              affordability, and where is the pressure greatest?
            </h3>
          </div>
        </section>

        {/* --- Section: Inflation chart --- */}
        <section style={{ margin: "6vh 0", color: "#374151" }}>
          <div style={{ maxWidth: TEXT_MAX, margin: "0 auto" }}>
            <h2 style={{ fontSize: 32, marginBottom: 12, textAlign: "left" }}>
              Price and rent inflation
            </h2>

            <p style={{ lineHeight: 1.6, textAlign: "left", margin: 0 }}>
              The story of housing in Britain has always been one of imbalance — between
              supply and demand, between those who own and those who rent. Over the past
              decade, that divide has deepened. The next chart tracks annual inflation in
              house prices and private rents. It shows how housing costs have moved through
              cycles of acceleration and restraint as policymakers attempted to manage
              affordability through interest-rate shifts.
              <br />
              <br />
              House-price inflation led the cycle. In the years following the pandemic,
              prices rose sharply as cheap borrowing and pent-up demand collided with
              limited housing stock. When the market overheated, the Bank of England stepped
              in, raising rates to curb activity. Yet as higher borrowing costs cooled house
              prices, demand spilled into the rental market, driving up rent inflation with
              a lag. By 2023, rent growth had overtaken house-price inflation — a sign of
              pressure shifting from buyers to renters. ONS data indicates a cooling in the
              rental market, but with pressures on renters as a whole likely to continue.
              Average UK monthly private rents increased by 7 per cent to £1,339 in the 12 months
              to May, the fifth month of slowing annual rate and the lowest since April 2023.
              <br />
              <br />
              Key moments punctuate this pattern. The March 2020 lockdown reshaped living
              preferences and accelerated demand for space. The Bank’s first rate hike in
              December 2021 marked the beginning of the end for ultra-low mortgage costs.
              The 2022 mini-budget sent financial markets reeling, briefly freezing mortgage
              products and pushing up borrowing costs. Each of these shocks left a distinct
              imprint on the inflation curve, showing how the housing market mirrors wider
              economic policy in real time.
            </p>

            {/* Chart container constrained to TEXT_MAX */}
            <div style={{ maxWidth: TEXT_MAX, width: "100%", margin: "12px auto 0" }}>
              <InflationYoYTwoSeries />
            </div>
          </div>
        </section>

        {/* --- Section: Salary Dumbbell --- */}
        <section style={{ margin: "6vh 0", color: "#374151" }}>
          <div style={{ maxWidth: TEXT_MAX, margin: "0 auto" }}>
            <h2 style={{ fontSize: 28, marginBottom: 12, textAlign: "left" }}>
              Where salaries moved fastest
            </h2>

            <p style={{ lineHeight: 1.6, textAlign: "left", margin: 0 }}>
              Understanding the cost side of housing is only half the story. Equally
              important is how earnings have changed. This chart compares median workplace
              salaries across London’s boroughs between 2022 and 2024. Over that period, the
              average borough saw a 13 per cent rise in pay — roughly in line with cumulative
              inflation at its peak, but one that masks striking local disparities.
              <br />
              <br />
              In some areas, wage growth outpaced inflation, offering a modest cushion
              against higher living costs. In others, pay packets lagged behind, eroding
              real purchasing power even as nominal salaries rose. The result is a patchwork
              London: a city where salary gains have not translated evenly into improved
              affordability.
              <br />
              <br />
              The connection between income and housing is critical. When house-price
              inflation slows but rents climb, stagnant wages can push more households into
              financial strain. By visualising salary growth before mapping affordability,
              we reveal the underlying tension between income and cost — a prelude to the
              next chart.
            </p>

            {/* Chart container constrained to TEXT_MAX */}
            <div style={{ maxWidth: TEXT_MAX, width: "100%", margin: "12px auto 0" }}>
              <SalaryDumbbell fromYear={2022} toYear={2024} />
            </div>
          </div>
        </section>

        {/* --- Section: London intro --- */}
        <section style={{ margin: "6vh 0", color: "#374151" }}>
          <div style={{ maxWidth: TEXT_MAX, margin: "0 auto" }}>
            <h2 style={{ fontSize: 28, marginBottom: 12, textAlign: "left" }}>
              Zooming in on London
            </h2>

            <p style={{ lineHeight: 1.6, textAlign: "left", margin: 0 }}>
              At the national level, housing trends can seem abstract. But at the city
              scale, the consequences are tangible. London’s boroughs offer a detailed
              snapshot of where affordability pressure is most acute. The heatmap below
              compares each borough’s affordability ratio — the relationship between median
              house price and local earnings.
              <br />
              <br />
              The results are stark. Central and west London remain among the least
              affordable places to buy, with price-to-income ratios still above 15 times
              average salaries. Outer boroughs, though relatively cheaper, have seen ratios
              rise fastest as the affordability frontier pushes outward.
              <br />
              <br />
              While the national debate often centres on ownership, these figures suggest
              that renting is becoming the default, not the choice, for many Londoners. The
              balance between rent and buy has shifted. Ownership, once the aspiration of
              the middle class, now looks increasingly out of reach in large parts of the
              capital.
            </p>
          </div>
        </section>

        {/* --- Section: London Heatmap --- */}
        <div style={{ maxWidth: TEXT_MAX, width: "100%", margin: "12px auto 0" }}>
          <LondonHeatmap />
        </div>
      </div>
    </main>
  );
}
