const main = document.getElementById("main");
const statusBadge = document.getElementById("status");
const tsEl = document.getElementById("ts");

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)  return "щойно";
  if (s < 60) return `${s}с тому`;
  if (s < 3600) return `${Math.floor(s / 60)}хв тому`;
  return `${Math.floor(s / 3600)}год тому`;
}

function timeUntil(isoString) {
  if (!isoString) return null;
  const diff = new Date(isoString) - Date.now();
  if (diff <= 0) return "скоро";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}год ${m}хв` : `${m}хв`;
}

function bar(used, total, color = "#d97706") {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return `
    <div class="bar-wrap">
      <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <div class="bar-label">
      <span>${used.toLocaleString()} / ${total.toLocaleString()}</span>
      <span>${pct}%</span>
    </div>`;
}

// ── field normalisation ───────────────────────────────────────────────────────
// Claude's API shape varies — we try to normalise the extracted fields.

function normalise(raw) {
  if (!raw) return null;
  const r = { ...raw };

  // Used / remaining / total
  const usedKeys   = ["messages_used",   "requests_used",   "usage"];
  const remKeys    = ["messages_remaining","requests_remaining","remaining"];
  const limitKeys  = ["message_limit","messages_limit","daily_limit","weekly_limit","monthly_limit","plan_limit","requests_limit","rate_limit"];
  const resetKeys  = ["next_reset_at","reset_at","resets_at"];

  const pick = (keys) => {
    for (const k of keys) {
      for (const rk of Object.keys(r)) {
        if (rk.toLowerCase().includes(k.replace(/_/g,"")) || rk === k) {
          const v = typeof r[rk] === "object" ? null : r[rk];
          if (v !== null && v !== undefined) return v;
        }
      }
    }
    return null;
  };

  const used      = Number(pick(usedKeys))    || null;
  const remaining = Number(pick(remKeys))     || null;
  const limit     = Number(pick(limitKeys))   || null;
  const resetAt   = pick(resetKeys);

  // Derive missing values
  const total  = limit || (used != null && remaining != null ? used + remaining : null);
  const usedFinal = used ?? (total != null && remaining != null ? total - remaining : null);

  return { used: usedFinal, remaining, total, resetAt, _raw: r };
}

// ── render ────────────────────────────────────────────────────────────────────

function render({ usageData, domBanner, lastUpdated }) {
  if (!lastUpdated) {
    statusBadge.textContent = "очікування";
    main.innerHTML = `
      <div class="empty">
        Відкрийте <a href="https://claude.ai" target="_blank">claude.ai</a>
        — розширення автоматично отримає дані про ліміти.
      </div>`;
    return;
  }

  tsEl.textContent = `Оновлено: ${timeAgo(lastUpdated)}`;
  statusBadge.textContent = "активно";

  const n = normalise(usageData);
  let html = "";

  // ── main usage card ──
  if (n && (n.used !== null || n.remaining !== null)) {
    const used      = n.used      ?? (n.total != null && n.remaining != null ? n.total - n.remaining : 0);
    const total     = n.total     ?? 0;
    const remaining = n.remaining ?? (total ? total - used : null);
    const pctLeft   = total ? Math.round(((remaining ?? 0) / total) * 100) : null;
    const color     = pctLeft !== null && pctLeft < 20 ? "#dc2626" : "#d97706";
    const until     = timeUntil(n.resetAt);

    html += `
      <div class="section">
        <div class="label">Залишок повідомлень</div>
        <div class="big-stat" style="color:${color}">
          ${remaining !== null ? remaining.toLocaleString() : "—"}
          <span class="big-sub">/ ${total ? total.toLocaleString() : "—"}</span>
        </div>
        ${total ? bar(used, total, color) : ""}
        ${until ? `<div class="reset-row">Скидання через <strong>${until}</strong></div>` : ""}
      </div>`;
  }

  // ── DOM banner ──
  if (domBanner) {
    html += `
      <div class="section">
        <div class="label">Повідомлення зі сторінки</div>
        <div class="banner">⚠️ ${domBanner}</div>
      </div>`;
  }

  // ── raw API fields (fallback) ──
  if ((!n || (n.used === null && n.remaining === null)) && usageData) {
    const entries = Object.entries(usageData).filter(([k]) => k !== "_raw");
    if (entries.length) {
      html += `
        <div class="section">
          <div class="label">Дані з API</div>
          <div class="kv-list">
            ${entries.map(([k, v]) => `
              <div class="kv-row">
                <span class="kk">${k}</span>
                <span class="kv">${JSON.stringify(v)}</span>
              </div>`).join("")}
          </div>
        </div>`;
    }
  }

  if (!html) {
    html = `<div class="empty">Дані отримано, але поля лімітів не знайдено.<br>Спробуйте перезавантажити claude.ai.</div>`;
  }

  main.innerHTML = html;
}

// ── init ──────────────────────────────────────────────────────────────────────

function load() {
  chrome.storage.local.get(["usageData", "domBanner", "lastUpdated"], render);
}

document.getElementById("clearBtn").addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    tsEl.textContent = "Дані очищено";
    statusBadge.textContent = "—";
    main.innerHTML = "";
    setTimeout(load, 200);
  });
});

load();
// Auto-refresh popup every 30s
setInterval(load, 30_000);
