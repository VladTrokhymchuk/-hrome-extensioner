// Fetch usage limits from Claude's internal API (session is already active)

const REFRESH_INTERVAL_MS = 60_000; // refresh every 60s while page is open

async function fetchUsage() {
  try {
    // Step 1: get list of organizations (includes usage info)
    const orgsResp = await fetch("/api/organizations", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!orgsResp.ok) return;

    const orgs = await orgsResp.json();
    const org = Array.isArray(orgs) ? orgs[0] : orgs;
    if (!org) return;

    const orgId = org.uuid || org.id;

    // Step 2: try a dedicated usage endpoint (path may vary — try both)
    let usageData = extractUsage(org);

    if (orgId) {
      for (const path of [
        `/api/organizations/${orgId}/usage`,
        `/api/organizations/${orgId}/limits`,
        `/api/usage`,
      ]) {
        try {
          const r = await fetch(path, { credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            const extracted = extractUsage(d);
            if (extracted) { usageData = { ...usageData, ...extracted }; break; }
          }
        } catch (_) {}
      }
    }

    if (usageData) {
      chrome.storage.local.set({ usageData, lastUpdated: Date.now() });
    }
  } catch (_) {}
}

/** Recursively search a JSON object for known usage fields */
function extractUsage(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return null;

  const FIELDS = [
    "message_limit", "messages_limit", "messages_remaining",
    "daily_limit", "weekly_limit", "monthly_limit",
    "usage", "limits", "rate_limit", "plan_limit",
    "messages_used", "requests_remaining", "requests_used",
    "next_reset_at", "reset_at", "resets_at",
  ];

  const result = {};

  for (const key of Object.keys(obj)) {
    const lk = key.toLowerCase();
    if (FIELDS.some((f) => lk.includes(f.replace(/_/g, "")) || lk === f)) {
      result[key] = obj[key];
    }
    if (typeof obj[key] === "object") {
      const nested = extractUsage(obj[key], depth + 1);
      if (nested && Object.keys(nested).length) Object.assign(result, nested);
    }
  }

  return Object.keys(result).length ? result : null;
}

// Run immediately and then on a timer
fetchUsage();
setInterval(fetchUsage, REFRESH_INTERVAL_MS);

// Also watch DOM for any visible limit banners
const USAGE_RE = [
  /(\d[\d,]*)\s*(?:messages?|conversations?)\s*(?:remaining|left)/i,
  /(\d[\d,]*)\s*of\s*(\d[\d,]*)\s*(?:messages?|conversations?)/i,
  /(?:reached|hit)\s+(?:your\s+)?(?:usage\s+)?limit/i,
  /limit[:\s]+(\d[\d,]+)/i,
];

let lastText = "";
const domObserver = new MutationObserver(() => {
  const text = document.body?.innerText ?? "";
  if (text === lastText) return;
  lastText = text;
  for (const re of USAGE_RE) {
    const m = text.match(re);
    if (m) { chrome.storage.local.set({ domBanner: m[0] }); return; }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  domObserver.observe(document.body, { childList: true, subtree: true });
});
