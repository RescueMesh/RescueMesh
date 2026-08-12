"use strict";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const HEALTH_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 5_000;
const LANGUAGE = document.documentElement.lang === "en" ? "en" : "es";
const IS_LOCAL_RUNTIME = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(window.location.hostname);
const COPY = {
  es: {
    publicSite: "Sitio público del proyecto",
    healthOk: "Nodo local operativo",
    healthError: "Nodo local no disponible",
    unknown: "desconocida",
    locked: "bloqueada",
    review: "revisar",
    invalidInteger: "Revisa los campos señalados: deben contener enteros dentro del intervalo permitido.",
    invalidRate: "El precio marginal debe ser un número positivo con un máximo de tres decimales.",
    invalidTotal: "La suma supera el intervalo que puede calcularse de forma exacta.",
    accepted: "Plantilla económicamente aceptable",
    rejected: "La plantilla no cubre el coste marginal",
    gain: "Ganancia neta estimada",
    opportunity: "coste de oportunidad",
    charge: "cargo adicional al propietario",
    evaluationError: "No se pudo completar la evaluación",
    unavailable: "El servicio local no respondió. Ningún dato se ha guardado ni transmitido a terceros.",
  },
  en: {
    publicSite: "Public project site",
    healthOk: "Local node operational",
    healthError: "Local node unavailable",
    unknown: "unknown",
    locked: "locked",
    review: "review",
    invalidInteger: "Review the marked fields: they must contain integers within the permitted range.",
    invalidRate: "The marginal rate must be a positive number with no more than three decimal places.",
    invalidTotal: "The total exceeds the range that can be calculated exactly.",
    accepted: "Template is economically acceptable",
    rejected: "Template does not cover marginal cost",
    gain: "Estimated net gain",
    opportunity: "opportunity cost",
    charge: "additional owner charge",
    evaluationError: "The evaluation could not be completed",
    unavailable: "The local service did not respond. No data was stored or sent to a third party.",
  },
}[LANGUAGE];

function byId(id) {
  return document.getElementById(id);
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("application/json")) throw new Error("Unexpected response type");
    const payload = await response.json();
    if (!response.ok) throw new Error("Request rejected");
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function text(id, value) {
  byId(id).textContent = String(value);
}

async function refreshHealth() {
  const pill = byId("health-pill");
  if (!IS_LOCAL_RUNTIME) {
    pill.className = "health-pill public";
    text("health-label", COPY.publicSite);
    text("network", "regtest");
    text("mainnet", COPY.locked);
    text("nodes", "—");
    text("jobs", "—");
    return;
  }
  try {
    const health = await fetchJson("/health");
    pill.className = "health-pill ok";
    text("health-label", COPY.healthOk);
    text("network", typeof health.network === "string" ? health.network : COPY.unknown);
    text("mainnet", health.mainnetLocked === true ? COPY.locked : COPY.review);
    text("nodes", Number.isSafeInteger(health.announcements) ? health.announcements : 0);
    text("jobs", Number.isSafeInteger(health.publicJobs) ? health.publicJobs : 0);
  } catch {
    pill.className = "health-pill error";
    text("health-label", COPY.healthError);
  }
}

function parseIntegerField(form, name, { minimum = 0, maximum = MAX_SAFE } = {}) {
  const field = form.elements.namedItem(name);
  const value = String(field.value).trim();
  const valid = /^(0|[1-9][0-9]*)$/.test(value);
  const number = valid ? Number(value) : Number.NaN;
  const accepted = Number.isSafeInteger(number) && number >= minimum && number <= maximum;
  field.closest(".field").classList.toggle("invalid", !accepted);
  field.setAttribute("aria-invalid", String(!accepted));
  if (!accepted) throw new TypeError(COPY.invalidInteger);
  return number;
}

function parseRateField(form) {
  const field = form.elements.namedItem("marginalRate");
  const value = String(field.value).trim().replace(",", ".");
  const valid = /^(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(value);
  const number = valid ? Number(value) : Number.NaN;
  const accepted = Number.isFinite(number) && number >= 0 && number <= 1_000_000;
  field.closest(".field").classList.toggle("invalid", !accepted);
  field.setAttribute("aria-invalid", String(!accepted));
  if (!accepted) throw new TypeError(COPY.invalidRate);
  return Math.round(number * 1000);
}

function formatSats(value) {
  if (!Number.isSafeInteger(value)) return "—";
  return new Intl.NumberFormat(LANGUAGE === "en" ? "en-US" : "es-ES", { maximumFractionDigits: 0 }).format(value);
}

function evaluateLocally(input) {
  const displacedVbytes = Math.max(0, input.rescueVsize - input.freeSpaceVbytes);
  const opportunityCostSats = Number(
    (BigInt(displacedVbytes) * BigInt(input.marginalRateMilliSatsPerVbyte) + 999n) / 1000n,
  );
  const grossBenefitSats = input.rescueFeeSats + input.auxiliaryRevenueSats + input.infrastructureSavingsSats;
  if (!Number.isSafeInteger(grossBenefitSats)) throw new TypeError(COPY.invalidTotal);
  const netGainSats = grossBenefitSats - opportunityCostSats;
  if (!Number.isSafeInteger(netGainSats)) throw new TypeError(COPY.invalidTotal);
  return {
    accepted: netGainSats >= 0,
    netGainSats,
    opportunityCostSats,
    userAdditionalChargeSats: 0,
  };
}

function renderResult(result, evaluation) {
  const accepted = evaluation && evaluation.accepted === true;
  result.hidden = false;
  result.className = `result ${accepted ? "good" : "bad"}`;
  const heading = document.createElement("strong");
  heading.textContent = accepted ? COPY.accepted : COPY.rejected;
  const details = document.createElement("span");
  details.textContent = `${COPY.gain}: ${formatSats(evaluation.netGainSats)} sats · ${COPY.opportunity}: ${formatSats(evaluation.opportunityCostSats)} sats · ${COPY.charge}: ${formatSats(evaluation.userAdditionalChargeSats)} sats.`;
  result.replaceChildren(heading, details);
}

function renderError(result, message) {
  result.hidden = false;
  result.className = "result bad";
  const heading = document.createElement("strong");
  heading.textContent = COPY.evaluationError;
  const details = document.createElement("span");
  details.textContent = message;
  result.replaceChildren(heading, details);
}

const simulator = byId("simulator-form");
simulator.addEventListener("input", (event) => {
  const wrapper = event.target.closest(".field");
  if (wrapper) wrapper.classList.remove("invalid");
  event.target.removeAttribute("aria-invalid");
});

simulator.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = byId("result");
  const button = form.querySelector("button[type='submit']");
  try {
    const body = {
      rescueVsize: parseIntegerField(form, "rescueVsize", { minimum: 1, maximum: 1_000_000 }),
      rescueFeeSats: parseIntegerField(form, "rescueFeeSats"),
      freeSpaceVbytes: parseIntegerField(form, "freeSpaceVbytes", { maximum: 1_000_000 }),
      marginalRateMilliSatsPerVbyte: parseRateField(form),
      auxiliaryRevenueSats: parseIntegerField(form, "auxiliaryRevenueSats"),
      infrastructureSavingsSats: parseIntegerField(form, "infrastructureSavingsSats"),
      minimumNetGainSats: 0,
    };
    button.disabled = true;
    const payload = IS_LOCAL_RUNTIME
      ? await fetchJson("/v1/simulate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-rescuemesh-client": "local-web-v1",
        },
        body: JSON.stringify(body),
      })
      : { evaluation: evaluateLocally(body) };
    renderResult(result, payload.evaluation);
  } catch (error) {
    const message = error instanceof TypeError
      ? error.message
      : COPY.unavailable;
    renderError(result, message);
  } finally {
    button.disabled = false;
  }
});

refreshHealth();
if (IS_LOCAL_RUNTIME) window.setInterval(refreshHealth, HEALTH_INTERVAL_MS);
