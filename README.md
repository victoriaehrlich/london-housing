**Rents vs House Prices — UK Housing Dashboard (React + Vite + D3)**

Interactive mini-dashboard exploring UK housing dynamics:

- Price & rent inflation vs CPI with key event annotations.

- Salary dumbbell chart showing borough-level pay changes.

- London affordability heatmap (price-to-income ratios).

Built with _React_ + _Vite_, _D3_, and plain CSS. Deployed on GitHub Pages.

Live demo: (https://victoriaehrlich.github.io/london-housing/)

**✨ Features**

InflationYoYTwoSeries [src > charts] - UK house price inflation, private rent inflation, and CPI (YoY, %), with vertical event markers (e.g., lockdown, BoE hike, mini-budget, SDLT change).

Label/annotation no-clip logic: labels are measured and clamped inside the drawable area.

SalaryDumbbell  [src > charts] - Borough salaries, change from {fromYear} → {toYear}.

Responsive, compact height logic so the chart never gets too tall.

Wide invisible hover targets, clean tooltips.

LondonHeatmap  [src > maps] - Affordability map (median price vs earnings)

**🗂️ Project structure**
src/
  App.jsx
  charts/
    InflationYoYTwoSeries.jsx
    SalaryDumbbell.jsx
  maps/
    LondonHeatmap.jsx
  hooks/
    useContainerSize.js
public/
  pipr_hpi_uk.csv
  uk_inflation_rate.csv
  ldn_salary_growth.csv

CSVs belong in public/ so Vite copies them to dist/ unchanged.

**🔧 Local development
**
# install
npm ci
# run dev server
npm run dev
# build for production
npm run build
# preview local production build (optional)
npm run preview

Dev server: run on your local host server. 

To stop the dev server: press Ctrl + C in the terminal.

**⚙️ Vite config for GitHub Pages
**
Because the code uses:

const prefix = import.meta.env.BASE_URL;

you must set base in vite.config.(js|ts) to match your Pages URL.

**If deploying to a project page
**
https://USERNAME.github.io/REPO_NAME/

// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/<REPO_NAME>/',   // <-- important
})

**🚀 Deployment 
** 

1. Commit & push:

git add -A
git commit -m "Deploy: compact charts + annotations fix"
git push origin main

2. Create workflow at .github/workflows/deploy.yml:

name: Deploy Vite site to GitHub Pages

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      # SPA fallback so client routing works on GH Pages
      - run: cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4


3. In your repo: Settings → Pages → Build and deployment → Source: GitHub Actions.

Every push to main will build & publish automatically.


**📊 Data sources**

ONS - UK House Price Index & Private Rental Prices (YoY %).

CPI - UK consumer price inflation (YoY %).

ASHE - Annual Survey of Hours and Earnings, workplace-based median gross annual pay.

If you use these charts publicly, a note crediting ONS/ASHE data is appreciated.


Make sure your CSV headers match the fields read in the components:

pipr_hpi_uk.csv → columns like Date, PIPR (or pipr), UK_HPI (or uk_hpi)

uk_inflation_rate.csv → columns like date, annual_rate (or rate)

ldn_salary_growth.csv → Metric = salary, borough name in LA_name/Borough etc., and numeric columns for each year (e.g., 2022, 2024)

**🖼️ Design / implementation notes**

D3 rendering: scaled with viewBox, responsive width.

Tooltips: absolutely positioned divs; wide hover targets for accessibility.

Annotation no-clip: labels are measured via getBBox() and clamped against the drawable right edge; the figure allows overflow: visible and has a slightly larger right margin to avoid rounded-corner clipping.

Compact dumbbell: dynamic per-row spacing aims for a target height (520–640px), thinning y-axis labels when there are many rows.

**🧪 Troubleshooting
**

CSV 404s on GitHub Pages

Ensure CSVs sit in public/.

Verify base in vite.config matches your Pages path.

After build, check dist/ contains the CSVs and that requests resolve to /<REPO_NAME>/file.csv.

Annotations clipped on the right/top

Keep the updated annotation logic (measured + clamped).

Ensure container uses overflow: visible or inset the right edge slightly.

Avoid global svg, figure { overflow: hidden }.

Client-side routing 404

Ensure 404.html is copied from index.html in the build step (see workflows/scripts).

**🏷️ Scripts**
npm run dev       # start local dev (HMR)
npm run build     # production build to dist/
npm run preview   # preview dist locally
npm run deploy    # if using gh-pages (manual deploy)

_Happy charting!_
