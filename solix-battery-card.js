/*!
 * Solix Battery Card
 * Animierte Glas-Batterieanzeige (Wellen, Blasen, Lade-Glow) für Anker Solix & Co.
 * Lizenz: MIT
 */
const SBC_VERSION = "1.0.0";
let SBC_UID = 0;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const numState = (hass, id) => {
  if (!id || !hass || !hass.states[id]) return NaN;
  const v = parseFloat(hass.states[id].state);
  return Number.isFinite(v) ? v : NaN;
};

// Farbverlauf nach Ladestand (gleiche Stufen wie in deinen button-card-Batterien)
const levelColors = (p) => {
  if (p > 80) return ["#49e3ff", "#14cfff", "#00b7ff", "#0587d9"];
  if (p > 60) return ["#5dff9a", "#35e67b", "#1bbf5d", "#119944"];
  if (p > 40) return ["#ffe66d", "#ffd43b", "#f4b400", "#d18d00"];
  if (p > 20) return ["#ffb36b", "#ff9830", "#ff7b00", "#d45f00"];
  return ["#ff7b7b", "#ff5252", "#ff2d2d", "#cc0000"];
};

const fmtDuration = (hours) => {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h >= 48) return `${Math.round(hours / 24)} Tage`;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

const wavePath = (y, amp, periods) => {
  let d = `M0 ${y} `;
  for (let i = 0; i < periods; i++) d += `q30 ${-amp * 2} 60 0 `;
  return `${d}L${periods * 60} 220 L0 220 Z`;
};

const CSS = `
  :host { display: block; }
  ha-card { display: block; height: 100%; background: none; box-shadow: none; border: none; container-type: inline-size; }
  .glass {
    position: relative; overflow: hidden; box-sizing: border-box; height: 100%; min-height: 250px;
    border-radius: 28px; padding: 16px 18px;
    background: linear-gradient(145deg, rgba(255,255,255,.22), rgba(255,255,255,.06));
    border: 1px solid rgba(255,255,255,.28);
    -webkit-backdrop-filter: blur(18px) saturate(160%); backdrop-filter: blur(18px) saturate(160%);
    box-shadow: 0 10px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.4);
    color: var(--primary-text-color, #fff); cursor: pointer;
    display: flex; flex-direction: column; gap: 10px;
  }
  .glass::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 40%;
    background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0)); pointer-events: none;
  }
  .glow {
    position: absolute; width: 160px; height: 160px; left: 8px; bottom: -40px; border-radius: 50%;
    filter: blur(46px); opacity: .0; pointer-events: none; transition: opacity .6s, background .6s;
  }
  .glass.charging .glow { opacity: .35; animation: glowpulse 2.6s ease-in-out infinite; }
  .head { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .brand { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; opacity: .5; white-space: nowrap; }
  .body { position: relative; display: flex; align-items: center; gap: 18px; flex: 1; min-height: 0; }
  .batt { flex: none; width: 112px; }
  .batt svg { display: block; width: 100%; height: auto; overflow: visible; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .status { display: flex; align-items: center; gap: 8px; }
  .pill {
    display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 11px 0 8px;
    border-radius: 999px; font-size: 13px; font-weight: 500; border: 1px solid transparent; white-space: nowrap;
  }
  .pill ha-icon { --mdc-icon-size: 16px; }
  .sub { font-size: 12px; opacity: .65; }
  .energy { font-size: 22px; font-weight: 500; line-height: 1.1; }
  .energy small { font-size: 12px; font-weight: 400; opacity: .6; margin-left: 3px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px 0 6px; border-radius: 999px;
    font-size: 12px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18);
  }
  .chip ha-icon { --mdc-icon-size: 14px; opacity: .85; }
  .hidden { display: none !important; }

  @container (max-width: 270px) {
    .body { flex-direction: column; align-items: center; text-align: center; }
    .status, .chips { justify-content: center; }
    .info { align-items: center; }
  }

  .wave1 { animation: wave 5.5s linear infinite; }
  .wave2 { animation: wave 8s linear infinite reverse; }
  .bub { opacity: 0; }
  .charging .bub { animation: rise 3.4s ease-in infinite; }
  .charging .bolt { animation: bolt 1.8s ease-in-out infinite; }
  .charging .shell { animation: shellglow 2.6s ease-in-out infinite; }
  .liquid { transition: transform 1.4s cubic-bezier(.3,.7,.2,1); }
  .low .pct { animation: warn 1.6s ease-in-out infinite; }

  @keyframes wave { from { transform: translateX(0); } to { transform: translateX(-60px); } }
  @keyframes rise {
    0% { opacity: 0; transform: translateY(0); }
    15% { opacity: .75; }
    100% { opacity: 0; transform: translateY(-150px); }
  }
  @keyframes bolt { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  @keyframes glowpulse { 0%,100% { opacity: .22; } 50% { opacity: .45; } }
  @keyframes shellglow { 0%,100% { filter: drop-shadow(0 0 3px var(--c, #35e67b)); } 50% { filter: drop-shadow(0 0 12px var(--c, #35e67b)); } }
  @keyframes warn { 0%,100% { opacity: 1; } 50% { opacity: .55; } }

  .noanim .wave1, .noanim .wave2, .noanim .bub, .noanim .bolt, .noanim .shell, .noanim .glow, .noanim .pct { animation: none !important; }
  @media (prefers-reduced-motion: reduce) {
    .wave1, .wave2, .bub, .bolt, .shell, .glow, .pct { animation: none !important; }
    .liquid { transition: none; }
  }
`;

class SolixBatteryCard extends HTMLElement {
  static getStubConfig(hass) {
    const ids = Object.keys((hass && hass.states) || {});
    const soc = ids.find((id) => id.startsWith("sensor.") && hass.states[id].attributes.device_class === "battery") || "";
    return { name: "Solarbank", soc };
  }

  static getConfigElement() {
    return document.createElement("solix-battery-card-editor");
  }

  setConfig(config) {
    if (!config || (!config.soc && !(config.energy && config.capacity_wh))) {
      throw new Error("Bitte 'soc' (Ladestand in %) oder 'energy' zusammen mit 'capacity_wh' angeben.");
    }
    this._config = {
      name: "Solarbank",
      brand: "Anker Solix",
      animations: true,
      power_charging_positive: true,
      idle_threshold: 5,
      ...config,
    };
    this._uid = ++SBC_UID;
    this._build();
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 };
  }

  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const u = this._uid;
    const bubbles = [
      [34, 0, 5, 0], [52, 1.1, 3.5, 0.5], [70, 2.0, 4.5, 1.2], [86, 0.6, 3, 2.0], [44, 2.5, 3, 2.6], [64, 1.6, 5, 0.9],
    ]
      .map(([x, , r, delay]) => `<circle class="bub" cx="${x + 12}" cy="205" r="${r}" fill="rgba(255,255,255,.55)" style="animation-delay:${delay}s"/>`)
      .join("");
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <ha-card>
        <div class="glass" id="root">
          <div class="glow" id="glow"></div>
          <div class="head"><span class="name" id="name"></span><span class="brand" id="brand"></span></div>
          <div class="body">
            <div class="batt">
              <svg viewBox="0 0 120 230" role="img" id="svg">
                <defs>
                  <linearGradient id="g${u}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" id="s0${u}"/><stop offset=".3" id="s1${u}"/><stop offset=".65" id="s2${u}"/><stop offset="1" id="s3${u}"/>
                  </linearGradient>
                  <linearGradient id="f${u}" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stop-color="#111"/><stop offset=".08" stop-color="#6f6f6f"/><stop offset=".16" stop-color="#e6e6e6"/>
                    <stop offset=".24" stop-color="#7c7c7c"/><stop offset=".34" stop-color="#1b1b1b"/><stop offset=".6" stop-color="#050505"/>
                    <stop offset=".82" stop-color="#2a2a2a"/><stop offset=".92" stop-color="#cfcfcf"/><stop offset="1" stop-color="#202020"/>
                  </linearGradient>
                  <linearGradient id="c${u}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#f7f7f7"/><stop offset=".5" stop-color="#a8a8a8"/><stop offset="1" stop-color="#5e5e5e"/>
                  </linearGradient>
                  <clipPath id="clip${u}"><rect x="12" y="22" width="96" height="196" rx="20"/></clipPath>
                </defs>
                <rect x="40" y="6" width="40" height="14" rx="6" fill="url(#c${u})"/>
                <g class="shell" id="shell">
                  <rect x="6" y="16" width="108" height="208" rx="26" fill="url(#f${u})"/>
                  <rect x="12" y="22" width="96" height="196" rx="20" fill="#071320"/>
                  <g clip-path="url(#clip${u})">
                    <g class="liquid" id="liquid" style="transform:translateY(196px)">
                      <g transform="translate(12,22)">
                        <g class="wave2" id="w2"><path d="${wavePath(8, 5, 5)}" fill="url(#g${u})" opacity=".45"/></g>
                        <g class="wave1" id="w1"><path d="${wavePath(10, 6, 5)}" fill="url(#g${u})"/></g>
                      </g>
                    </g>
                    ${bubbles}
                    <rect x="12" y="205" width="96" height="14" fill="rgba(0,0,0,.12)"/>
                  </g>
                  <rect x="18" y="30" width="12" height="150" rx="6" fill="rgba(255,255,255,.28)"/>
                  <rect x="98" y="38" width="5" height="110" rx="3" fill="rgba(255,255,255,.14)"/>
                  <text class="pct" id="pct" x="60" y="130" text-anchor="middle" font-size="30" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:rgba(0,0,0,.45);stroke-width:3px;"></text>
                  <path class="bolt hidden" id="bolt" d="M64 62 L50 90 H60 L56 112 L72 82 H62 Z" fill="#fff" opacity=".9"/>
                </g>
              </svg>
            </div>
            <div class="info">
              <div class="status"><span class="pill" id="pill"></span></div>
              <div id="eRow"><div class="energy" id="energy"></div><div class="sub" id="sub"></div></div>
              <div class="chips" id="chips"></div>
            </div>
          </div>
        </div>
      </ha-card>`;
    const $ = (id) => this.shadowRoot.getElementById(id);
    this._el = { root: $("root"), glow: $("glow"), name: $("name"), brand: $("brand"), svg: $("svg"), liquid: $("liquid"), pct: $("pct"), bolt: $("bolt"), shell: $("shell"), pill: $("pill"), eRow: $("eRow"), energy: $("energy"), sub: $("sub"), chips: $("chips"),
      stops: [$(`s0${u}`), $(`s1${u}`), $(`s2${u}`), $(`s3${u}`)] };
    this._el.root.addEventListener("click", () => {
      const id = this._config.soc || this._config.energy;
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
    });
    this._lastLevelKey = null;
  }

  _update() {
    if (!this._config || !this._hass || !this._el) return;
    const c = this._config;
    const h = this._hass;
    const e = this._el;

    const energy = numState(h, c.energy);
    let soc = numState(h, c.soc);
    if (!Number.isFinite(soc) && Number.isFinite(energy) && c.capacity_wh) soc = (energy / c.capacity_wh) * 100;
    const ok = Number.isFinite(soc);
    const p = ok ? Math.max(0, Math.min(100, soc)) : 0;

    let power = numState(h, c.power);
    if (Number.isFinite(power) && !c.power_charging_positive) power = -power;
    const hasPower = Number.isFinite(power);
    const th = c.idle_threshold;
    const charging = hasPower && power > th;
    const discharging = hasPower && power < -th;

    e.name.textContent = c.name;
    e.brand.textContent = c.brand || "";
    e.brand.classList.toggle("hidden", !c.brand);

    // Füllstand: 196 = leer, 0 = voll (Innenhöhe der Batterie)
    const y = 196 - (p / 100) * 196;
    e.liquid.style.transform = `translateY(${y.toFixed(1)}px)`;
    const colors = levelColors(p);
    if (colors[0] !== this._lastColor) {
      e.stops.forEach((s, i) => s.setAttribute("stop-color", colors[i]));
      this._lastColor = colors[0];
    }
    const accent = colors[1];
    e.shell.style.setProperty("--c", accent);
    e.glow.style.background = accent;
    e.pct.textContent = ok ? `${Math.round(p)} %` : "–";

    e.root.classList.toggle("charging", charging);
    e.root.classList.toggle("low", ok && p <= 15 && !charging);
    e.root.classList.toggle("noanim", c.animations === false);
    e.bolt.classList.toggle("hidden", !charging);

    // Status-Pille
    let icon = "mdi:battery-check", label = "Bereit", rgb = "152,162,179", col = "#c3cad6";
    if (charging) { icon = "mdi:battery-charging"; label = `Lädt · ${Math.round(power)} W`; rgb = "52,199,89"; col = "#7ee69a"; }
    else if (discharging) { icon = "mdi:battery-arrow-down"; label = `Entlädt · ${Math.round(-power)} W`; rgb = "255,159,10"; col = "#ffc266"; }
    else if (!hasPower) { icon = "mdi:battery"; label = ok ? "Ladestand" : "Nicht verfügbar"; }
    e.pill.style.cssText = `background:rgba(${rgb},.22);border-color:rgba(${rgb},.5);color:${col}`;
    e.pill.innerHTML = `<ha-icon icon="${icon}"></ha-icon>${esc(label)}`;

    // Energie + Restzeit
    let sub = "";
    if (Number.isFinite(energy)) {
      const cap = c.capacity_wh;
      e.energy.innerHTML = `${Math.round(energy).toLocaleString(h.language)}<small>Wh${cap ? ` / ${Number(cap).toLocaleString(h.language)}` : ""}</small>`;
      if (cap && hasPower) {
        if (charging) { const t = fmtDuration((cap - energy) / power); if (t) sub = `Voll in ca. ${t}`; }
        else if (discharging) { const t = fmtDuration(energy / -power); if (t) sub = `Leer in ca. ${t}`; }
      }
    } else if (c.capacity_wh && ok) {
      e.energy.innerHTML = `${Math.round((p / 100) * c.capacity_wh).toLocaleString(h.language)}<small>Wh / ${Number(c.capacity_wh).toLocaleString(h.language)}</small>`;
    } else {
      e.energy.textContent = "";
    }
    e.sub.textContent = sub;
    e.sub.classList.toggle("hidden", !sub);
    e.eRow.classList.toggle("hidden", !e.energy.innerHTML);

    // Chips (Solar, Abgabe, Temperatur)
    const chips = [];
    const sv = numState(h, c.solar);
    if (Number.isFinite(sv)) chips.push(["mdi:solar-power", `${Math.round(sv)} W`]);
    const ov = numState(h, c.output);
    if (Number.isFinite(ov)) chips.push(["mdi:home-lightning-bolt-outline", `${Math.round(ov)} W`]);
    const tv = numState(h, c.temperature);
    if (Number.isFinite(tv)) chips.push(["mdi:thermometer", `${tv.toLocaleString(h.language, { maximumFractionDigits: 1 })}°`]);
    const key = chips.map((x) => x.join("")).join("|");
    if (key !== this._chipKey) {
      this._chipKey = key;
      e.chips.innerHTML = chips.map(([i, t]) => `<span class="chip"><ha-icon icon="${i}"></ha-icon>${esc(t)}</span>`).join("");
    }
  }
}

const EDITOR_SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "brand", selector: { text: {} } },
  { name: "soc", selector: { entity: { domain: "sensor" } } },
  { name: "energy", selector: { entity: { domain: "sensor" } } },
  { name: "capacity_wh", selector: { number: { mode: "box", min: 0, unit_of_measurement: "Wh" } } },
  { name: "power", selector: { entity: { domain: "sensor", device_class: "power" } } },
  { name: "power_charging_positive", selector: { boolean: {} } },
  { name: "solar", selector: { entity: { domain: "sensor", device_class: "power" } } },
  { name: "output", selector: { entity: { domain: "sensor", device_class: "power" } } },
  { name: "temperature", selector: { entity: { domain: "sensor", device_class: "temperature" } } },
  { name: "animations", selector: { boolean: {} } },
];

const EDITOR_LABELS = {
  name: "Name",
  brand: "Zusatzzeile (leer = aus)",
  soc: "Ladestand (%)",
  energy: "Energie (Wh)",
  capacity_wh: "Kapazität (Wh)",
  power: "Lade-/Entladeleistung (W)",
  power_charging_positive: "Positive Leistung = Laden",
  solar: "Solarleistung (W)",
  output: "Abgabe an Haus (W)",
  temperature: "Temperatur",
  animations: "Animationen",
};

class SolixBatteryCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: ev.detail.value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = EDITOR_SCHEMA;
    this._form.data = { power_charging_positive: true, animations: true, ...this._config };
  }
}

if (!customElements.get("solix-battery-card")) customElements.define("solix-battery-card", SolixBatteryCard);
if (!customElements.get("solix-battery-card-editor")) customElements.define("solix-battery-card-editor", SolixBatteryCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "solix-battery-card")) {
  window.customCards.push({
    type: "solix-battery-card",
    name: "Solix Battery Card",
    description: "Animierte Glas-Batterieanzeige mit Wellen, Blasen und Lade-Glow.",
    preview: false,
  });
}

console.info(`%c SOLIX-BATTERY-CARD %c v${SBC_VERSION} `, "color:#fff;background:#14cfff;font-weight:700", "color:#14cfff;background:#222");
