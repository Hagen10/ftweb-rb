import { Controller } from "@hotwired/stimulus"

/*
 * Discourse-consistency tab.
 *
 * For each `topic` target, POST { query, stance_subject } to the timeline
 * endpoint and render an inline SVG: x = speech date, y = NLI stance in
 * [-1, 1] (or cosine similarity when stance is not available). Clicking
 * a point fetches nearest / farthest speeches from other politicians.
 */
export default class extends Controller {
  static targets = [
    "topic", "status", "chart",
    "customQuery", "customTopic", "customLabel", "customStatus", "customChart",
    "details", "detailsBody",
  ]
  static values = {
    timelineUrl: String,
    nearestUrl: String,
  }

  // Fallback domain when a chart has 0–1 points.
  static X_FALLBACK_MIN = new Date("2005-01-01").getTime()
  static X_FALLBACK_MAX = new Date("2026-12-31").getTime()
  static WIDTH = 720
  static HEIGHT = 140
  static PADDING = { top: 14, right: 14, bottom: 22, left: 32 }

  connect() {
    // Per-chart state: { docs, originalAnchorId, currentAnchorId }
    this._chartState = new WeakMap()
    this.topicTargets.forEach((el, idx) => this.loadTopic(el, idx))
  }

  async loadTopic(el, idx) {
    const query = el.dataset.topicQuery
    const stanceSubject = el.dataset.topicStanceSubject
    const status = this.statusTargets[idx]
    const chart = this.chartTargets[idx]
    try {
      const data = await this.fetchTimeline(query, stanceSubject)
      status.textContent = this.formatStatus(data)
      this.initChart(chart, data)
    } catch (e) {
      console.error(e)
      status.textContent = "Fejl ved indlæsning"
    }
  }

  async searchCustomTopic(event) {
    event.preventDefault()
    const query = this.customQueryTarget.value.trim()
    if (!query) return
    this.customTopicTarget.hidden = false
    this.customLabelTarget.textContent = query
    this.customStatusTarget.textContent = "Indlæser…"
    this.customChartTarget.innerHTML = ""
    try {
      // Free-text search uses the query itself as the stance subject.
      const data = await this.fetchTimeline(query, query)
      this.customStatusTarget.textContent = this.formatStatus(data)
      this.initChart(this.customChartTarget, data)
    } catch (e) {
      console.error(e)
      this.customStatusTarget.textContent = "Fejl ved indlæsning"
    }
  }

  async fetchTimeline(query, stanceSubject) {
    const body = { query }
    if (stanceSubject) body.stance_subject = stanceSubject
    const response = await fetch(this.timelineUrlValue, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-CSRF-Token": this.csrfToken(),
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Timeline request failed: ${response.status}`)
    return await response.json()
  }

  formatStatus(data) {
    const shown = (data.docs || []).length
    const total = data.total_on_topic ?? data.num_found ?? shown
    if (!shown) return "Ingen udtalelser"
    const base = `${shown} af ${total} udtalelser`
    const s = data.stance_summary
    if (!s) return base
    const meanPct = Math.round(s.mean * 100)
    const meanSign = meanPct > 0 ? `+${meanPct}` : `${meanPct}`
    const consPct = Math.round(s.consistency * 100)
    // e.g. "10 af 1308 udtalelser · stand +24 · konsistens 78%"
    return `${base} · stand ${meanSign} · konsistens ${consPct}%`
  }

  // Initialize a chart from a fresh API response. State is cached so we
  // can re-anchor (similarity mode only) without a roundtrip.
  initChart(container, data) {
    const docs = (data.docs || []).map((d) => ({ ...d }))
    // stanceMode: per-doc NLI score available; y becomes absolute stance
    // and click-to-reanchor is disabled (anchoring is meaningless then).
    const stanceMode = docs.some((d) => typeof d.stance === "number")
    const originalAnchorId = data.anchor_id ?? (docs.find((d) => d.is_anchor) || {}).id ?? null
    this._chartState.set(container, {
      docs,
      originalAnchorId,
      currentAnchorId: originalAnchorId,
      stanceMode,
    })
    this.renderChart(container, docs, stanceMode)
  }

  // Recompute every doc's similarity relative to the doc with id=anchorId
  // and re-render the chart in place. No-op in stance mode.
  reanchorChart(container, anchorId) {
    const state = this._chartState.get(container)
    if (!state || state.stanceMode) return
    const anchor = state.docs.find((d) => d.id === anchorId)
    if (!anchor || !anchor.embedding) return
    const ae = anchor.embedding
    state.docs = state.docs.map((d) => {
      const sim = d.embedding ? dot(ae, d.embedding) : d.similarity
      return { ...d, similarity: sim, is_anchor: d.id === anchorId }
    })
    state.currentAnchorId = anchorId
    this.renderChart(container, state.docs, false)
  }

  resetChart(container) {
    const state = this._chartState.get(container)
    if (!state || state.currentAnchorId === state.originalAnchorId) return
    this.reanchorChart(container, state.originalAnchorId)
  }

  resetAllCharts() {
    if (!this._chartState) return
    const containers = [...this.chartTargets]
    if (this.hasCustomChartTarget) containers.push(this.customChartTarget)
    containers.forEach((c) => this.resetChart(c))
  }

  renderChart(container, docs, stanceMode = false) {
    container.innerHTML = ""
    const { WIDTH, HEIGHT, PADDING, X_FALLBACK_MIN, X_FALLBACK_MAX } = this.constructor
    const yValue = (d) => stanceMode ? (d.stance ?? 0) : d.similarity

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    svg.setAttribute("class", "discourse-chart-svg")
    svg.setAttribute("role", "img")

    const innerW = WIDTH - PADDING.left - PADDING.right
    const innerH = HEIGHT - PADDING.top - PADDING.bottom

    // Scale the x-axis so the kept (top-K) speeches span the chart.
    const times = docs.map((d) => new Date(d.meeting_date_dt).getTime()).filter((t) => !isNaN(t))
    let xMin, xMax
    if (times.length >= 2) {
      xMin = Math.min(...times)
      xMax = Math.max(...times)
      if (xMin === xMax) {
        // single distinct date — pad ±6 months so the point isn't at the edge
        const halfYear = 1000 * 60 * 60 * 24 * 183
        xMin -= halfYear
        xMax += halfYear
      } else {
        const pad = (xMax - xMin) * 0.04
        xMin -= pad
        xMax += pad
      }
    } else {
      xMin = X_FALLBACK_MIN
      xMax = X_FALLBACK_MAX
    }

    const xScale = (iso) => {
      const t = new Date(iso).getTime()
      const clamped = Math.max(xMin, Math.min(xMax, t))
      return PADDING.left + ((clamped - xMin) / (xMax - xMin)) * innerW
    }
    // y in [-1, 1] → pixel; +1 at top, -1 at bottom
    const yScale = (sim) => PADDING.top + ((1 - sim) / 2) * innerH

    // axes ------------------------------------------------------------
    // baseline at y = 0
    const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line")
    baseline.setAttribute("x1", PADDING.left)
    baseline.setAttribute("x2", WIDTH - PADDING.right)
    baseline.setAttribute("y1", yScale(0))
    baseline.setAttribute("y2", yScale(0))
    baseline.setAttribute("class", "discourse-chart-baseline")
    svg.appendChild(baseline)

    for (const yVal of [-1, 1]) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text")
      label.setAttribute("x", PADDING.left - 6)
      label.setAttribute("y", yScale(yVal) + 4)
      label.setAttribute("text-anchor", "end")
      label.setAttribute("class", "discourse-chart-tick")
      if (stanceMode) {
        label.textContent = yVal > 0 ? "for" : "imod"
      } else {
        label.textContent = yVal.toString()
      }
      svg.appendChild(label)
    }
    const leftYear = new Date(xMin).getFullYear()
    const rightYear = new Date(xMax).getFullYear()
    const yearLabels = leftYear === rightYear
      ? [[leftYear, "middle", (PADDING.left + WIDTH - PADDING.right) / 2]]
      : [[leftYear, "start", PADDING.left], [rightYear, "end", WIDTH - PADDING.right]]
    for (const [year, anchor, x] of yearLabels) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text")
      label.setAttribute("x", x)
      label.setAttribute("y", HEIGHT - 4)
      label.setAttribute("text-anchor", anchor)
      label.setAttribute("class", "discourse-chart-tick")
      label.textContent = year.toString()
      svg.appendChild(label)
    }

    // year-binned mean ± std dispersion band (stance mode, ≥2 bins) -
    // NOTE: this is a *dispersion* band (spread of segments within a year),
    // not a confidence interval around the mean.
    if (stanceMode) {
      const bins = binByYear(docs)
      if (bins.length >= 2) {
        const bandColor = this.partyColor(docs[0].party_s)
        const midX = (b) => xScale(`${b.year}-07-01`)
        const upper = bins.map((b) => `${midX(b)},${yScale(clamp(b.mean + b.std, -1, 1))}`)
        const lower = bins.slice().reverse().map((b) => `${midX(b)},${yScale(clamp(b.mean - b.std, -1, 1))}`)
        const band = document.createElementNS("http://www.w3.org/2000/svg", "path")
        band.setAttribute("d", `M${upper.join(" L")} L${lower.join(" L")} Z`)
        band.setAttribute("class", "discourse-chart-band")
        band.setAttribute("fill", bandColor)
        band.setAttribute("aria-label", "Spredning: ±1 standardafvigelse pr. år")
        const bandTitle = document.createElementNS("http://www.w3.org/2000/svg", "title")
        bandTitle.textContent = "Spredningsbånd: årlig middelværdi ±1 standardafvigelse (ikke et konfidensinterval)"
        band.appendChild(bandTitle)
        svg.appendChild(band)
        const meanPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
        meanPath.setAttribute("d", bins.map((b, i) => `${i === 0 ? "M" : "L"}${midX(b)},${yScale(b.mean)}`).join(" "))
        meanPath.setAttribute("class", "discourse-chart-mean")
        meanPath.setAttribute("stroke", bandColor)
        const meanTitle = document.createElementNS("http://www.w3.org/2000/svg", "title")
        meanTitle.textContent = "Årlig gennemsnitlig stand"
        meanPath.appendChild(meanTitle)
        svg.appendChild(meanPath)
      }
    }

    // line through points (chronological order — docs already sorted) -
    if (docs.length > 1) {
      const d = docs
        .map((doc, i) => `${i === 0 ? "M" : "L"}${xScale(doc.meeting_date_dt)},${yScale(yValue(doc))}`)
        .join(" ")
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", d)
      path.setAttribute("class", "discourse-chart-line")
      // colour by the first doc's party (a politician's own colour rarely
      // changes across speeches — and we want one line colour per chart)
      path.setAttribute("stroke", this.partyColor(docs[0].party_s))
      svg.appendChild(path)
    }

    // points ----------------------------------------------------------
    docs.forEach((doc) => {
      const y = yValue(doc)
      const isAnchor = !stanceMode && doc.is_anchor
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      circle.setAttribute("cx", xScale(doc.meeting_date_dt))
      circle.setAttribute("cy", yScale(y))
      circle.setAttribute("r", isAnchor ? 6 : 4)
      circle.setAttribute("class", isAnchor ? "discourse-chart-point discourse-chart-point--anchor" : "discourse-chart-point")
      circle.setAttribute("fill", this.partyColor(doc.party_s))
      circle.setAttribute("tabindex", "0")
      const date = (doc.meeting_date_dt || "").slice(0, 10)
      const yLabel = stanceMode ? `stand ${y.toFixed(2)}` : `similarity ${y.toFixed(2)}`
      circle.setAttribute("aria-label", `${date}, ${yLabel}`)
      circle.addEventListener("click", () => {
        if (!stanceMode) this.reanchorChart(container, doc.id)
        this.openDetails(doc, stanceMode)
      })
      circle.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault()
          if (!stanceMode) this.reanchorChart(container, doc.id)
          this.openDetails(doc, stanceMode)
        }
      })
      svg.appendChild(circle)
    })

    container.appendChild(svg)
  }

  async openDetails(doc, stanceMode = false) {
    this.detailsTarget.hidden = false
    this.installOutsideClickClose()
    const metric = stanceMode
      ? `stand ${(doc.stance ?? 0).toFixed(3)}`
      : `similarity ${doc.similarity.toFixed(3)}`
    this.detailsBodyTarget.innerHTML = `
      <p class="discourse-details__meta">
        <strong>${escapeHtml(doc.speaker_name_s || "")}</strong>
        (${escapeHtml(doc.party_s || "—")}) —
        ${escapeHtml((doc.meeting_date_dt || "").slice(0, 10))}
        · ${metric}
      </p>
      <blockquote class="discourse-details__text">${escapeHtml(doc.text_t || "")}</blockquote>
      <p class="discourse-details__loading">Henter lignende og modsatte udtalelser…</p>
    `
    try {
      const response = await fetch(this.nearestUrlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-CSRF-Token": this.csrfToken(),
        },
        body: JSON.stringify({ doc_id: doc.id }),
      })
      if (!response.ok) throw new Error(`Nearest request failed: ${response.status}`)
      const data = await response.json()
      this.detailsBodyTarget.querySelector(".discourse-details__loading").remove()
      this.detailsBodyTarget.insertAdjacentHTML("beforeend", this.renderNearest(data))
    } catch (e) {
      console.error(e)
      const loading = this.detailsBodyTarget.querySelector(".discourse-details__loading")
      if (loading) loading.textContent = "Fejl ved indlæsning"
    }
  }

  closeDetails() {
    this.detailsTarget.hidden = true
    this.detailsBodyTarget.innerHTML = ""
    this.removeOutsideClickClose()
  }

  installOutsideClickClose() {
    if (this._outsideClickHandler) return
    this._outsideClickHandler = (ev) => {
      // Ignore the same click that opened the panel.
      if (this.detailsTarget.hidden) return
      if (this.detailsTarget.contains(ev.target)) return
      // Ignore clicks on chart points (they re-open / switch the panel).
      if (ev.target.closest(".discourse-chart-point")) return
      this.closeDetails()
    }
    // Defer to next tick so the opening click doesn't immediately close it.
    setTimeout(() => document.addEventListener("click", this._outsideClickHandler), 0)
  }

  removeOutsideClickClose() {
    if (!this._outsideClickHandler) return
    document.removeEventListener("click", this._outsideClickHandler)
    this._outsideClickHandler = null
  }

  disconnect() {
    this.removeOutsideClickClose()
  }

  renderNearest(data) {
    const section = (title, items) => {
      if (!items || items.length === 0) return ""
      const list = items.map((d) => `
        <li>
          <p class="discourse-details__meta">
            <strong>${escapeHtml(d.speaker_name_s || "")}</strong>
            (${escapeHtml(d.party_s || "—")}) —
            ${escapeHtml((d.meeting_date_dt || "").slice(0, 10))}
            · ${d.similarity.toFixed(3)}
          </p>
          <blockquote class="discourse-details__text">${escapeHtml(d.text_t || "")}</blockquote>
        </li>
      `).join("")
      return `<section><h4>${escapeHtml(title)}</h4><ul class="discourse-details__list">${list}</ul></section>`
    }
    return section("Mest lignende udtalelser", data.most_similar) +
           section("Mest modsatte udtalelser", data.most_different)
  }

  partyColor(party) {
    // Mirror of app/helpers/politician_helper.rb so the line/point colours
    // match what Rails renders elsewhere.
    const map = {
      A: "#A82721", S: "#A82721", V: "#0B4F8C", K: "#7B9F4D", KF: "#7B9F4D",
      DF: "#EAC73E", SF: "#E07EA8", RV: "#733280", EL: "#E6332A",
      ALT: "#2B8C5D", M: "#512B7C", NB: "#127B7F", LA: "#12830B",
      DD: "#003E5C",
    }
    return map[(party || "").toUpperCase()] || "#7B7B7B"
  }

  csrfToken() {
    const meta = document.querySelector("meta[name='csrf-token']")
    return meta ? meta.getAttribute("content") : ""
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// Embeddings are already L2-normalized server-side, so a plain dot product
// equals cosine similarity.
function dot(a, b) {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

// Group docs by calendar year and return [{ year, mean, std, n }] sorted
// chronologically. Only years with ≥1 stance value are returned; bins with
// n=1 get std=0 (degenerate, but renders as a thin band).
function binByYear(docs) {
  const buckets = new Map()
  for (const d of docs) {
    if (typeof d.stance !== "number") continue
    const y = new Date(d.meeting_date_dt).getFullYear()
    if (!Number.isFinite(y)) continue
    if (!buckets.has(y)) buckets.set(y, [])
    buckets.get(y).push(d.stance)
  }
  const out = []
  for (const [year, values] of buckets) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    out.push({ year, mean, std: Math.sqrt(variance), n: values.length })
  }
  out.sort((a, b) => a.year - b.year)
  return out
}
