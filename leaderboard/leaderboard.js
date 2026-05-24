const DATA_PATH = "./data/";

const state = {
  leaderboard: null,
  benchmarks: null,
  coverage: null,
  citations: null,
  selectedBenchmark: "calvin",
  selectedMetric: "overall",
  query: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "score-desc",
  firstPartyOnly: false,
};

const els = {
  summaryStats: document.querySelector("#summaryStats"),
  benchmarkSelect: document.querySelector("#benchmarkSelect"),
  metricSelect: document.querySelector("#metricSelect"),
  modelSearch: document.querySelector("#modelSearch"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  sortSelect: document.querySelector("#sortSelect"),
  firstPartyOnly: document.querySelector("#firstPartyOnly"),
  chartTitle: document.querySelector("#chartTitle"),
  chartMeta: document.querySelector("#chartMeta"),
  trendChart: document.querySelector("#trendChart"),
  coverageMeta: document.querySelector("#coverageMeta"),
  coverageGrid: document.querySelector("#coverageGrid"),
  tableTitle: document.querySelector("#tableTitle"),
  tableMeta: document.querySelector("#tableMeta"),
  benchmarkNotes: document.querySelector("#benchmarkNotes"),
  table: document.querySelector("#leaderboardTable"),
};

const formatter = new Intl.NumberFormat("en-US");

function escHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function byId(id) {
  return document.getElementById(id);
}

function rawArxivId(url) {
  if (!url) return null;
  const match = String(url).match(/arxiv\.org\/abs\/(\d+\.\d+)/i);
  return match ? match[1] : null;
}

function pubMonthFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/arxiv\.org\/abs\/(\d{2})(\d{2})\.\d+/i);
  if (!match) return null;
  const century = Number(match[1]) >= 50 ? "19" : "20";
  return `${century}${match[1]}-${match[2]}`;
}

function resultPubMonth(result) {
  return pubMonthFromUrl(result.model_paper) || pubMonthFromUrl(result.reported_paper);
}

function resultArxivId(result) {
  return rawArxivId(result.model_paper) || rawArxivId(result.reported_paper);
}

function isThirdParty(result) {
  if (result.reported_paper && result.model_paper && result.reported_paper !== result.model_paper) return true;
  return typeof result.model === "string" && result.model.includes("__");
}

function getBenchmarkKeys() {
  const resultBenchmarks = new Set(state.leaderboard.results.map((result) => result.benchmark));
  const ordered = Object.keys(state.benchmarks).filter((key) => resultBenchmarks.has(key));
  resultBenchmarks.forEach((key) => {
    if (!ordered.includes(key)) ordered.push(key);
  });
  return ordered;
}

function getBenchmark(key = state.selectedBenchmark) {
  return state.benchmarks[key] || {};
}

function shouldExpandSuites(key = state.selectedBenchmark) {
  const benchmark = getBenchmark(key);
  if (!benchmark.suites || !benchmark.suites.length) return false;
  if (benchmark.expand_suites) return true;
  const rows = state.leaderboard.results.filter((result) => result.benchmark === key);
  return rows.length > 0 && rows.every((result) => result.overall_score == null);
}

function metricOptionsForBenchmark(key) {
  const benchmark = getBenchmark(key);
  const options = [];
  const hasOverall = state.leaderboard.results.some(
    (result) => result.benchmark === key && result.overall_score != null,
  );
  if (hasOverall) {
    options.push({ value: "overall", label: benchmark.avg_label || "Overall" });
  }
  if (shouldExpandSuites(key)) {
    (benchmark.suites || []).forEach((suite) => {
      options.push({ value: `suite:${suite}`, label: shortLabel(suite, benchmark.display_name) });
    });
  }
  if (!options.length) {
    const taskKeys = new Set();
    state.leaderboard.results
      .filter((result) => result.benchmark === key)
      .forEach((result) => Object.keys(result.task_scores || {}).forEach((task) => taskKeys.add(task)));
    [...taskKeys].slice(0, 24).forEach((task) => {
      options.push({ value: `task:${task}`, label: shortLabel(task, benchmark.display_name) });
    });
  }
  return options;
}

function shortLabel(value, displayName = "") {
  let label = String(value).replace(/_/g, " ");
  const prefix = `${displayName.toLowerCase()} `;
  if (displayName && label.toLowerCase().startsWith(prefix)) label = label.slice(prefix.length);
  return label.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/Google Robot/g, "GR");
}

function selectedMetricLabel() {
  const match = metricOptionsForBenchmark(state.selectedBenchmark).find((option) => option.value === state.selectedMetric);
  return match ? match.label : "Overall";
}

function scoreFor(result, metric = state.selectedMetric) {
  if (metric === "overall") return result.overall_score ?? null;
  if (metric.startsWith("suite:")) {
    return (result.suite_scores || {})[metric.slice(6)] ?? null;
  }
  if (metric.startsWith("task:")) {
    return (result.task_scores || {})[metric.slice(5)] ?? null;
  }
  return null;
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return "--";
  const metricName = getBenchmark().metric?.name || "";
  const number = Number(value);
  return metricName === "avg_len" ? number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : number.toFixed(1);
}

function metricUnit() {
  const benchmark = getBenchmark();
  if (!benchmark.metric?.unit) return "";
  if (benchmark.metric.unit === "%") return "%";
  return ` ${benchmark.metric.unit}`;
}

function metricDescription() {
  const benchmark = getBenchmark();
  const name = benchmark.metric?.name ? benchmark.metric.name.replace(/_/g, " ") : "score";
  const unit = benchmark.metric?.unit ? ` (${benchmark.metric.unit})` : "";
  return `${name}${unit}`;
}

function passesFilters(result) {
  if (result.benchmark !== state.selectedBenchmark) return false;
  const haystack = [
    result.display_name,
    result.name_in_paper,
    result.model,
    result.params,
    result.reported_table,
    result.notes,
    result.curated_by,
    result.weight_type,
  ].join(" ").toLowerCase();
  if (state.query && !haystack.includes(state.query)) return false;
  if (state.firstPartyOnly && isThirdParty(result)) return false;
  const month = resultPubMonth(result);
  if (state.dateFrom || state.dateTo) {
    if (!month) return false;
    if (state.dateFrom && month < state.dateFrom) return false;
    if (state.dateTo && month > state.dateTo) return false;
  }
  return true;
}

function filteredResults() {
  const rows = state.leaderboard.results.filter(passesFilters);
  rows.sort((a, b) => {
    const scoreA = scoreFor(a);
    const scoreB = scoreFor(b);
    const monthA = resultPubMonth(a) || "";
    const monthB = resultPubMonth(b) || "";
    const nameA = (a.display_name || a.model || "").toLowerCase();
    const nameB = (b.display_name || b.model || "").toLowerCase();

    if (state.sortBy === "model-asc") return nameA.localeCompare(nameB);
    if (state.sortBy === "date-asc") return monthA.localeCompare(monthB) || nameA.localeCompare(nameB);
    if (state.sortBy === "date-desc") return monthB.localeCompare(monthA) || nameA.localeCompare(nameB);

    const missingA = scoreA == null;
    const missingB = scoreB == null;
    if (missingA && missingB) return nameA.localeCompare(nameB);
    if (missingA) return 1;
    if (missingB) return -1;
    const diff = Number(scoreA) - Number(scoreB);
    return state.sortBy === "score-asc" ? diff || nameA.localeCompare(nameB) : -diff || nameA.localeCompare(nameB);
  });
  return rows;
}

function renderStats() {
  const modelCount = new Set(state.leaderboard.results.map((result) => result.model)).size;
  const benchmarkCount = getBenchmarkKeys().length;
  const stats = [
    ["Models", formatter.format(modelCount)],
    ["Benchmarks", formatter.format(benchmarkCount)],
    ["Results", formatter.format(state.leaderboard.results.length)],
    ["Updated", state.leaderboard.last_updated || "--"],
  ];
  els.summaryStats.innerHTML = stats
    .map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderBenchmarkSelect() {
  const keys = getBenchmarkKeys();
  els.benchmarkSelect.innerHTML = keys
    .map((key) => `<option value="${escHtml(key)}">${escHtml(getBenchmark(key).display_name || key)}</option>`)
    .join("");
  if (!keys.includes(state.selectedBenchmark)) state.selectedBenchmark = keys[0] || "";
  els.benchmarkSelect.value = state.selectedBenchmark;
}

function renderMetricSelect() {
  const options = metricOptionsForBenchmark(state.selectedBenchmark);
  if (!options.some((option) => option.value === state.selectedMetric)) {
    state.selectedMetric = options[0]?.value || "overall";
  }
  els.metricSelect.innerHTML = options
    .map((option) => `<option value="${escHtml(option.value)}">${escHtml(option.label)}</option>`)
    .join("");
  els.metricSelect.value = state.selectedMetric;
  els.metricSelect.disabled = options.length <= 1;
}

function chartPoints() {
  return state.leaderboard.results
    .filter((result) => {
      if (!passesFilters(result)) return false;
      const score = scoreFor(result);
      return score != null && Number.isFinite(Number(score)) && resultPubMonth(result);
    })
    .map((result) => ({
      result,
      score: Number(scoreFor(result)),
      month: resultPubMonth(result),
      displayName: result.display_name || result.model,
    }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.displayName.localeCompare(b.displayName));
}

function frontierPoints(points) {
  const higher = getBenchmark().metric?.higher_is_better !== false;
  const frontier = [];
  let best = null;
  points.forEach((point) => {
    if (best == null || (higher ? point.score > best : point.score < best)) {
      best = point.score;
      frontier.push(point);
    }
  });
  return frontier;
}

function monthToDate(month) {
  return new Date(`${month}-01T00:00:00Z`);
}

function renderChart() {
  const benchmark = getBenchmark();
  const points = chartPoints();
  const frontier = frontierPoints(points);
  const metricLabel = selectedMetricLabel();
  els.chartTitle.textContent = `${benchmark.display_name || state.selectedBenchmark} Performance Trend`;
  els.chartMeta.textContent = `${metricLabel} · ${metricDescription()} · ${points.length} scored entries`;

  const svg = els.trendChart;
  const width = 980;
  const height = 430;
  const margin = { top: 28, right: 28, bottom: 54, left: 62 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.textContent = "";

  if (!points.length) {
    const text = svgEl("text", { x: width / 2, y: height / 2, class: "empty-chart", "text-anchor": "middle" });
    text.textContent = "No comparable scored entries for the current filters.";
    svg.append(text);
    return;
  }

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const dates = points.map((point) => monthToDate(point.month).getTime());
  const minX = Math.min(...dates);
  const maxX = Math.max(...dates);
  const scores = points.map((point) => point.score);
  const range = benchmark.metric?.range || [];
  const hasRange = Number.isFinite(Number(range[0])) && Number.isFinite(Number(range[1]));
  let minY = hasRange ? Number(range[0]) : Math.min(...scores);
  let maxY = hasRange ? Number(range[1]) : Math.max(...scores);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  if (!hasRange) {
    const scorePad = (maxY - minY) * 0.08;
    minY = Math.min(minY, Math.min(...scores) - scorePad);
    maxY = Math.max(maxY, Math.max(...scores) + scorePad);
  }

  const x = (time) => margin.left + ((time - minX) / Math.max(1, maxX - minX)) * plotW;
  const y = (score) => margin.top + plotH - ((score - minY) / Math.max(1, maxY - minY)) * plotH;

  for (let i = 0; i <= 4; i += 1) {
    const value = minY + ((maxY - minY) * i) / 4;
    const yy = y(value);
    svg.append(svgEl("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "grid-line" }));
    const label = svgEl("text", { x: margin.left - 10, y: yy + 4, class: "axis-text", "text-anchor": "end" });
    label.textContent = formatScore(value);
    svg.append(label);
  }

  svg.append(svgEl("line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, class: "axis-line" }));
  svg.append(svgEl("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, class: "axis-line" }));

  const years = [...new Set(points.map((point) => point.month.slice(0, 4)))];
  years.forEach((year) => {
    const time = monthToDate(`${year}-01`).getTime();
    if (time < minX || time > maxX) return;
    const xx = x(time);
    svg.append(svgEl("line", { x1: xx, y1: height - margin.bottom, x2: xx, y2: height - margin.bottom + 5, class: "axis-line" }));
    const label = svgEl("text", { x: xx, y: height - margin.bottom + 24, class: "axis-text", "text-anchor": "middle" });
    label.textContent = year;
    svg.append(label);
  });

  const yTitle = svgEl("text", {
    x: 18,
    y: margin.top + plotH / 2,
    class: "axis-text chart-label",
    "text-anchor": "middle",
    transform: `rotate(-90 18 ${margin.top + plotH / 2})`,
  });
  yTitle.textContent = `${metricLabel}${metricUnit()}`;
  svg.append(yTitle);

  const pointsGroup = svgEl("g");
  points.forEach((point) => {
    const circle = svgEl("circle", {
      cx: x(monthToDate(point.month).getTime()),
      cy: y(point.score),
      r: 3.3,
      class: "point",
    });
    circle.append(svgTitle(`${point.displayName} · ${point.month} · ${formatScore(point.score)}${metricUnit()}`));
    pointsGroup.append(circle);
  });
  svg.append(pointsGroup);

  if (frontier.length) {
    const line = frontier
      .map((point) => `${x(monthToDate(point.month).getTime())},${y(point.score)}`)
      .join(" ");
    svg.append(svgEl("polyline", { points: line, class: "frontier-line" }));
    frontier.forEach((point, index) => {
      const xx = x(monthToDate(point.month).getTime());
      const yy = y(point.score);
      const circle = svgEl("circle", { cx: xx, cy: yy, r: 4.4, class: "frontier-point" });
      circle.append(svgTitle(`${point.displayName} · ${point.month} · ${formatScore(point.score)}${metricUnit()}`));
      svg.append(circle);
      if (index === frontier.length - 1 || index % Math.ceil(frontier.length / 8) === 0) {
        const label = svgEl("text", { x: Math.min(xx + 7, width - margin.right - 120), y: yy - 8, class: "frontier-label" });
        label.textContent = point.displayName.slice(0, 28);
        svg.append(label);
      }
    });
  }
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function svgTitle(text) {
  const title = svgEl("title");
  title.textContent = text;
  return title;
}

function renderCoverage() {
  if (!els.coverageMeta || !els.coverageGrid) return;
  const coverage = state.coverage;
  if (!coverage?.benchmarks) {
    els.coverageMeta.textContent = "Coverage data unavailable.";
    els.coverageGrid.textContent = "";
    return;
  }

  els.coverageMeta.textContent =
    `${formatter.format(coverage.total_results)} results · ${formatter.format(coverage.total_models)} models · ${formatter.format(coverage.total_papers_reviewed || 0)} papers reviewed`;

  const items = Object.entries(coverage.benchmarks)
    .sort(([, a], [, b]) => (b.leaderboard_entries || 0) - (a.leaderboard_entries || 0));
  els.coverageGrid.innerHTML = items.map(([key, item]) => {
    const denom = item.arxiv_citing_papers || item.citing_papers || 1;
    const reviewed = item.papers_reviewed || 0;
    const pct = Math.max(2, Math.min(100, Math.round((reviewed / denom) * 100)));
    const isSelected = key === state.selectedBenchmark;
    return `
      <article class="coverage-item" ${isSelected ? 'style="border-color: var(--state);"' : ""}>
        <div class="coverage-head">
          <span class="coverage-name">${escHtml(item.display_name || key)}</span>
          <span class="coverage-count">${formatter.format(reviewed)}/${formatter.format(denom)}</span>
        </div>
        <div class="coverage-track"><div class="coverage-fill" style="width:${pct}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderNotes() {
  const benchmark = getBenchmark();
  if (!benchmark.detail_notes && !benchmark.official_leaderboard) {
    els.benchmarkNotes.hidden = true;
    els.benchmarkNotes.textContent = "";
    return;
  }
  const official = benchmark.official_leaderboard
    ? `Official leaderboard: <a href="${escHtml(benchmark.official_leaderboard)}" target="_blank" rel="noopener">${escHtml(benchmark.official_leaderboard)}</a>. `
    : "";
  els.benchmarkNotes.innerHTML = official + (benchmark.detail_notes || "");
  els.benchmarkNotes.hidden = false;
}

function renderTable() {
  const rows = filteredResults();
  const scoredRows = rows.filter((row) => scoreFor(row) != null);
  const benchmark = getBenchmark();
  els.tableTitle.textContent = `${benchmark.display_name || state.selectedBenchmark} Results`;
  els.tableMeta.textContent = `${formatter.format(rows.length)} filtered entries · ${formatter.format(scoredRows.length)} scored on ${selectedMetricLabel()} · ${metricDescription()}`;

  const thead = els.table.querySelector("thead");
  const tbody = els.table.querySelector("tbody");
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Model</th>
      <th>${escHtml(selectedMetricLabel())}</th>
      <th>Params</th>
      <th>Paper</th>
      <th>Table</th>
      <th>Date</th>
    </tr>
  `;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">No matching results. Adjust the filters and try again.</td></tr>`;
    return;
  }

  const higher = benchmark.metric?.higher_is_better !== false;
  const bestScore = scoredRows.reduce((best, row) => {
    const score = Number(scoreFor(row));
    if (!Number.isFinite(score)) return best;
    if (best == null) return score;
    return higher ? Math.max(best, score) : Math.min(best, score);
  }, null);

  tbody.innerHTML = rows.map((row, index) => {
    const score = scoreFor(row);
    const paper = row.reported_paper || row.model_paper || "";
    const month = resultPubMonth(row) || "--";
    const paperArxiv = rawArxivId(paper);
    const citations = paperArxiv && state.citations?.papers ? state.citations.papers[paperArxiv] : null;
    const bestClass = score != null && Number(score) === bestScore ? " best-score" : "";
    return `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td class="model-cell">
          ${row.model_paper ? `<a class="model-name" href="${escHtml(row.model_paper)}" target="_blank" rel="noopener">${escHtml(row.display_name || row.model)}</a>` : `<span class="model-name">${escHtml(row.display_name || row.model)}</span>`}
        </td>
        <td class="score-cell${bestClass}">${score == null ? '<span class="empty">--</span>' : `${formatScore(score)}${metricUnit()}`}</td>
        <td class="meta-cell">${escHtml(row.params || "--")}</td>
        <td>
          ${paper ? `<a class="paper-link" href="${escHtml(paper)}" target="_blank" rel="noopener">${escHtml(paperArxiv ? `arXiv:${paperArxiv}` : "Source")}</a>${citations != null ? `<span class="paper-meta">${formatter.format(citations)} citations</span>` : ""}` : '<span class="empty">--</span>'}
        </td>
        <td class="meta-cell">${escHtml(row.reported_table || "--")}</td>
        <td class="meta-cell">${escHtml(month)}</td>
      </tr>
    `;
  }).join("");
}

function renderAll() {
  renderMetricSelect();
  renderNotes();
  renderChart();
  renderCoverage();
  renderTable();
}

function bindEvents() {
  els.benchmarkSelect.addEventListener("change", (event) => {
    state.selectedBenchmark = event.target.value;
    state.selectedMetric = "overall";
    renderAll();
  });

  els.metricSelect.addEventListener("change", (event) => {
    state.selectedMetric = event.target.value;
    renderChart();
    renderTable();
  });

  els.modelSearch.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderChart();
    renderTable();
  });

  els.dateFrom.addEventListener("change", (event) => {
    state.dateFrom = event.target.value;
    renderChart();
    renderTable();
  });

  els.dateTo.addEventListener("change", (event) => {
    state.dateTo = event.target.value;
    renderChart();
    renderTable();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    renderTable();
  });

  els.firstPartyOnly.addEventListener("change", (event) => {
    state.firstPartyOnly = event.target.checked;
    renderChart();
    renderTable();
  });
}

async function loadJson(name) {
  const response = await fetch(`${DATA_PATH}${name}.json`);
  if (!response.ok) throw new Error(`${name}.json failed with HTTP ${response.status}`);
  return response.json();
}

async function init() {
  try {
    const [leaderboard, benchmarks, coverage, citations] = await Promise.all([
      loadJson("leaderboard"),
      loadJson("benchmarks"),
      loadJson("coverage").catch(() => null),
      loadJson("citations").catch(() => null),
    ]);
    state.leaderboard = leaderboard;
    state.benchmarks = benchmarks;
    state.coverage = coverage;
    state.citations = citations;
    renderStats();
    renderBenchmarkSelect();
    renderAll();
    bindEvents();
  } catch (error) {
    const message = `Failed to load local leaderboard data: ${error.message}`;
    byId("chartMeta").textContent = message;
    byId("tableMeta").textContent = message;
    console.error(error);
  }
}

init();
