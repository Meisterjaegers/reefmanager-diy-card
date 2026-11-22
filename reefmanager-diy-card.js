const REEFMANAGER_HOST = "192.168.178.91";
const MULTIMATE_HOST = "192.168.178.92";
const DEFAULT_REFRESH_INTERVAL = 30;
const MIN_REFRESH_INTERVAL = 5;
const MAX_REFRESH_INTERVAL = 3600;

class ReefmanagerCardBase extends HTMLElement {
  static getStubConfig() {
    return {
      host: this.defaultHost,
      title: this.defaultTitle,
      refresh_interval: DEFAULT_REFRESH_INTERVAL,
    };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "host",
          required: true,
          default: this.defaultHost,
          selector: { text: {} },
        },
        {
          name: "title",
          default: this.defaultTitle,
          selector: { text: {} },
        },
        {
          name: "refresh_interval",
          default: DEFAULT_REFRESH_INTERVAL,
          selector: {
            number: {
              min: MIN_REFRESH_INTERVAL,
              max: MAX_REFRESH_INTERVAL,
              step: 1,
              unit_of_measurement: "s",
              mode: "box",
            },
          },
        },
      ],
      computeLabel: (schema) =>
        ({
          host: "IP-Adresse",
          title: "Kartentitel",
          refresh_interval: "Aktualisierungsintervall",
        })[schema.name],
      computeHelper: (schema) =>
        ({
          host: "Nur die IP-Adresse eingeben, ohne http://.",
          refresh_interval: "Zwischen 5 Sekunden und 1 Stunde.",
        })[schema.name],
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._error = null;
    this._historyError = null;
    this._loading = false;
    this._timer = null;
    this._temperatureHistory = new Map();
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Die Kartenkonfiguration fehlt.");
    }

    this._device =
      this.constructor.device === "reefmanager" &&
      config.device === "multimate"
        ? "multimate"
        : this.constructor.device;
    const refreshInterval = config.refresh_interval ?? DEFAULT_REFRESH_INTERVAL;
    if (
      typeof refreshInterval !== "number" ||
      !Number.isFinite(refreshInterval) ||
      refreshInterval < MIN_REFRESH_INTERVAL ||
      refreshInterval > MAX_REFRESH_INTERVAL
    ) {
      throw new Error(
        `refresh_interval muss zwischen ${MIN_REFRESH_INTERVAL} und ${MAX_REFRESH_INTERVAL} Sekunden liegen.`,
      );
    }
    this._config = {
      ...config,
      host: this._normalizeHost(config.host || this._defaultHost()),
      refresh_interval: refreshInterval,
    };
    this._render();
    if (this.isConnected) this._startPolling();
  }

  connectedCallback() {
    if (this._config) this._startPolling();
  }

  disconnectedCallback() {
    window.clearInterval(this._timer);
  }

  getCardSize() {
    return this._device === "reefmanager" ? 4 : 3;
  }

  getConfigElement() {
    return document.createElement(this.constructor.editorTag);
  }

  getStubConfig() {
    return this.constructor.getStubConfig();
  }

  _deviceType() {
    return this._device || this.constructor.device;
  }

  _deviceHost() {
    if (this._device === "multimate") return MULTIMATE_HOST;
    return this.constructor.defaultHost;
  }

  _deviceTitle() {
    if (this._device === "multimate") return "Multimate";
    return this.constructor.defaultTitle;
  }

  _defaultHost() {
    return this._deviceHost();
  }

  _defaultTitle() {
    return this._deviceTitle();
  }

  _normalizeHost(host) {
    return String(host)
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
  }

  _startPolling() {
    window.clearInterval(this._timer);
    this._refresh();
    this._timer = window.setInterval(
      () => this._refresh(),
      this._config.refresh_interval * 1000,
    );
  }

  async _fetchJson(path) {
    const response = await fetch(`http://${this._config.host}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`${path}: HTTP ${response.status}`);
    }
    return response.json();
  }

  async _refresh() {
    if (!this._config || this._loading) return;
    this._loading = true;
    this._error = null;
    this._historyError = null;
    try {
      const isReefmanager = this._deviceType() === "reefmanager";
      const historyRequest = isReefmanager
        ? this._fetchTemperatureHistory()
            .then((history) => ({ history }))
            .catch((error) => ({
              error: error instanceof Error ? error.message : String(error),
            }))
        : Promise.resolve({ history: null });
      const requests = [
        this._fetchJson(
          isReefmanager ? "/api/temperature/status" : "/api/kh/status",
        ),
        this._fetchJson("/api/containers"),
        historyRequest,
      ];
      const [status, containers, historyResult] = await Promise.all(requests);
      if (isReefmanager && historyResult.history) {
        const control = status.controls?.[0];
        const key = String(control?.port ?? control?.name ?? "temperature");
        this._temperatureHistory.set(key, historyResult.history);
      } else if (isReefmanager && historyResult.error) {
        this._temperatureHistory.clear();
        this._historyError = historyResult.error;
      }
      this._data = { status, containers };
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._loading = false;
      this._render();
    }
  }

  _element(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  _section(title) {
    const section = this._element("section");
    section.append(this._element("h2", "", title));
    return section;
  }

  _metric(label, value, unit = "") {
    const row = this._element("div", "metric");
    row.append(
      this._element("span", "label", label),
      this._element("span", "value", `${value}${unit}`),
    );
    return row;
  }

  async _fetchTemperatureHistory() {
    const response = await fetch(
      `http://${this._config.host}/api/temperature/history.bin`,
      { headers: { Accept: "application/octet-stream" } },
    );
    if (!response.ok) {
      throw new Error(`/api/temperature/history.bin: HTTP ${response.status}`);
    }
    return this._parseTemperatureHistory(await response.arrayBuffer());
  }

  _parseTemperatureHistory(buffer) {
    const recordSize = 8;
    if (buffer.byteLength % recordSize !== 0) {
      throw new Error("Temperaturverlauf hat ein ungültiges Binärformat.");
    }

    const view = new DataView(buffer);
    const history = [];
    for (let offset = 0; offset < buffer.byteLength; offset += recordSize) {
      const timestamp = view.getUint32(offset, true);
      const temperature = view.getUint16(offset + 6, true);
      if (timestamp === 0 || temperature === 0x8000) continue;
      history.push({ timestamp, value: temperature / 100 });
    }
    history.sort((a, b) => a.timestamp - b.timestamp);
    return history;
  }

  _temperatureTile(control) {
    const tile = this._element("article", "tile temperature-tile");
    const label = control.name || "Temperatur";
    const value = Number.isFinite(control.currentTemp)
      ? control.currentTemp.toFixed(2)
      : "—";
    const heading = this._element("div", "tile-heading");
    heading.append(
      this._element("span", "tile-label", label),
      this._element("span", "thermometer", "♨"),
    );
    tile.append(heading);

    const reading = this._element("div", "temperature-reading");
    reading.append(
      this._element("span", "temperature-value", value),
      this._element("span", "temperature-unit", "°C"),
    );
    tile.append(reading, this._temperatureSparkline(control));
    if (this._historyError) {
      tile.append(
        this._element(
          "div",
          "history-error",
          `Temperaturverlauf nicht verfügbar: ${this._historyError}`,
        ),
      );
    }
    return tile;
  }

  _temperatureSparkline(control) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "sparkline");
    svg.setAttribute("viewBox", "0 0 200 40");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Temperaturverlauf aus der Gerätehistorie");

    const key = String(control.port ?? control.name ?? "temperature");
    const history = this._temperatureHistory.get(key) ?? [];
    if (history.length === 0) return svg;
    const values = history.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = history
      .map((point, index) => {
        const x = (index / Math.max(history.length - 1, 1)) * 200;
        const y = 36 - ((point.value - min) / range) * 32;
        return `${x},${y}`;
      })
      .join(" ");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("points", points);
    svg.append(line);
    return svg;
  }

  _containerTile(item) {
    const current = item.current;
    const max = item.max;
    const percentage =
      Number.isFinite(current) && Number.isFinite(max) && max > 0
        ? Math.max(0, Math.min(1, current / max))
        : null;
    const label = item.name || `Behälter ${item.port}`;
    const tile = this._element("article", "tile container-tile");
    tile.setAttribute("aria-label", label);

    const gauge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    gauge.setAttribute("class", "container-gauge");
    gauge.setAttribute("viewBox", "0 0 120 72");
    gauge.setAttribute("role", "img");
    gauge.setAttribute(
      "aria-label",
      percentage === null ? `${label}: kein Füllstand` : `${label}: ${Math.round(percentage * 100)} %`,
    );

    const track = document.createElementNS("http://www.w3.org/2000/svg", "path");
    track.setAttribute("class", "gauge-track");
    track.setAttribute("d", "M 12 60 A 48 48 0 0 1 108 60");
    gauge.append(track);

    if (percentage !== null) {
      const angle = Math.PI * (1 - percentage);
      const x = 60 + 48 * Math.cos(angle);
      const y = 60 - 48 * Math.sin(angle);
      const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
      arc.setAttribute("class", `gauge-value${percentage <= 0.4 ? " low" : ""}`);
      arc.setAttribute(
        "d",
        `M 12 60 A 48 48 0 ${percentage > 0.5 ? 1 : 0} 1 ${x} ${y}`,
      );
      gauge.append(arc);
    }

    const reading = document.createElementNS("http://www.w3.org/2000/svg", "text");
    reading.classList.add("gauge-reading");
    reading.textContent = `${this._number(current)} ml`;
    reading.setAttribute("x", "60");
    reading.setAttribute("y", "57");
    reading.setAttribute("text-anchor", "middle");
    gauge.append(reading);
    tile.append(gauge, this._element("div", "gauge-label", label));

    if (Number.isFinite(item.days_left) && item.days_left >= 0) {
      tile.append(
        this._element("div", "gauge-detail", `${item.days_left.toFixed(1)} Tage`),
      );
    }
    return tile;
  }

  _reefmanagerContent() {
    const grid = this._element("div", "reefmanager-grid");
    const controls = this._data.status.controls ?? [];
    if (controls.length === 0) {
      grid.append(this._temperatureTile({ name: "Temperatur" }));
    } else {
      for (const control of controls) {
        grid.append(this._temperatureTile(control));
      }
    }

    const items = this._data.containers.containers ?? [];
    if (items.length === 0) {
      grid.append(this._element("article", "tile muted", "Keine Behälterdaten verfügbar."));
    }
    for (const item of items) {
      grid.append(this._containerTile(item));
    }
    return grid;
  }

  _multimateContent() {
    const fragment = document.createDocumentFragment();
    const kh = this._section("KH-Wert");
    const value = this._data.status.last_kh;
    kh.append(
      this._metric(
        "Letzte Messung",
        Number.isFinite(value) ? value.toFixed(2) : "—",
        " dKH",
      ),
    );
    fragment.append(kh);

    const containers = this._section("Verbrauchsbehälter");
    for (const [label, item, unit] of [
      ["Reagenz", this._data.containers.reagent, "ml"],
      ["Abwasser", this._data.containers.waste, "ml"],
    ]) {
      if (item) containers.append(this._container(label, item.current, item.max, unit));
    }
    fragment.append(containers);
    return fragment;
  }

  _container(label, current, max, unit) {
    const wrapper = this._element("div", "container");
    const values = this._element("div", "metric");
    values.append(
      this._element("span", "label", label),
      this._element(
        "span",
        "value",
        `${this._number(current)} / ${this._number(max)} ${unit}`,
      ),
    );
    wrapper.append(values);

    if (Number.isFinite(current) && Number.isFinite(max) && max > 0) {
      const progress = this._element("progress");
      progress.max = max;
      progress.value = Math.max(0, Math.min(current, max));
      progress.setAttribute("aria-label", `${label}: ${this._number(current)} ${unit}`);
      wrapper.append(progress);
    }
    return wrapper;
  }

  _number(value) {
    return Number.isFinite(value)
      ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : "—";
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const title = this._config.title || this._defaultTitle();
    const showReefmanagerTiles =
      this._deviceType() === "reefmanager" && this._data && !this._error;
    const card = this._element(
      showReefmanagerTiles ? "div" : "article",
      showReefmanagerTiles ? "reefmanager-layout" : "card",
    );
    if (showReefmanagerTiles) {
      card.append(this._element("h1", "layout-title", title));
    } else {
      card.append(this._element("header", "", title));
    }

    if (this._error) {
      card.append(
        this._element(
          "p",
          "error",
          `Daten konnten nicht geladen werden: ${this._error}. Prüfe Geräte-IP, CORS- und HTTPS-Freigabe.`,
        ),
      );
    } else if (!this._data) {
      card.append(this._element("p", "muted", "Lade Gerätedaten …"));
    } else {
      card.append(
        this._deviceType() === "reefmanager"
          ? this._reefmanagerContent()
          : this._multimateContent(),
      );
    }

    this.shadowRoot.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; color: var(--primary-text-color); }
      .reefmanager-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 110px), 1fr));
      }
      .reefmanager-layout { display: block; }
      .layout-title { color: var(--secondary-text-color); font-size: 1rem; font-weight: 500; margin: 0 0 10px; }
      .tile {
        background: var(--ha-card-background, var(--card-background-color, white));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px #0002);
        box-sizing: border-box;
        min-width: 0;
        padding: 14px 16px;
      }
      .temperature-tile { grid-column: 1 / -1; }
      .tile-heading { align-items: center; display: flex; justify-content: space-between; }
      .tile-label { color: var(--secondary-text-color); font-size: .9rem; }
      .thermometer { color: var(--primary-color); font-size: 1.2rem; }
      .temperature-reading { align-items: baseline; display: flex; gap: 4px; margin: 12px 0 2px; }
      .temperature-value { font-size: 1.7rem; font-weight: 400; }
      .temperature-unit { color: var(--secondary-text-color); font-size: .9rem; }
      .sparkline { display: block; height: 34px; margin-top: 6px; width: 100%; }
      .sparkline polyline { fill: none; stroke: var(--success-color, #9bdc9b); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
      .history-error { color: var(--secondary-text-color); font-size: .75rem; margin-top: 6px; }
      .container-tile { align-items: center; display: flex; flex-direction: column; justify-content: center; }
      .container-gauge { display: block; overflow: visible; width: min(100%, 160px); }
      .gauge-track, .gauge-value { fill: none; stroke-linecap: butt; stroke-width: 10; }
      .gauge-track { stroke: var(--disabled-color, #e8e8ec); }
      .gauge-value { stroke: var(--success-color, #a9df89); }
      .gauge-value.low { stroke: var(--warning-color, #f3d95b); }
      .gauge-reading { fill: var(--primary-text-color); font-size: 13px; }
      .gauge-label { font-size: .9rem; margin-top: -1px; text-align: center; }
      .gauge-detail { color: var(--secondary-text-color); font-size: .75rem; margin-top: 3px; }
      .card {
        background: var(--ha-card-background, var(--card-background-color, white));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px #0002);
        padding: 16px;
      }
      header { font-size: 1.25rem; font-weight: 500; margin-bottom: 16px; }
      section + section { border-top: 1px solid var(--divider-color); margin-top: 14px; padding-top: 12px; }
      h2 { color: var(--secondary-text-color); font-size: .9rem; font-weight: 500; margin: 0 0 8px; }
      .metric { align-items: baseline; display: flex; justify-content: space-between; gap: 12px; }
      .label, .muted, .detail { color: var(--secondary-text-color); }
      .value { font-size: 1.1rem; font-weight: 500; text-align: right; }
      .container + .container { margin-top: 12px; }
      progress { accent-color: var(--primary-color); height: 6px; margin-top: 6px; width: 100%; }
      .detail { font-size: .8rem; margin: 2px 0 0; text-align: right; }
      .error { color: var(--error-color, #b3261e); }
    `;
    this.shadowRoot.append(style, card);
  }
}

class ReefmanagerDiyCard extends ReefmanagerCardBase {
  static get device() {
    return "reefmanager";
  }

  static get defaultHost() {
    return REEFMANAGER_HOST;
  }

  static get defaultTitle() {
    return "Reefmanager";
  }

  static get editorTag() {
    return "reefmanager-diy-card-editor";
  }
}

class MultimateDiyCard extends ReefmanagerCardBase {
  static get device() {
    return "multimate";
  }

  static get defaultHost() {
    return MULTIMATE_HOST;
  }

  static get defaultTitle() {
    return "Multimate";
  }

  static get editorTag() {
    return "multimate-diy-card-editor";
  }
}

class ReefmanagerDiyCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  static get defaultHost() {
    return REEFMANAGER_HOST;
  }

  static get defaultTitle() {
    return "Reefmanager";
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this._config) return;
    this._form = document.createElement("ha-form");
    this._form.hass = this._hass;
    this._form.data = {
      host: String(this._config.host || this.constructor.defaultHost)
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/, ""),
      title: this._config.title || this.constructor.defaultTitle,
      refresh_interval:
        this._config.refresh_interval ?? DEFAULT_REFRESH_INTERVAL,
    };
    this._form.schema = [
      { name: "host", selector: { text: {} } },
      { name: "title", selector: { text: {} } },
      {
        name: "refresh_interval",
        selector: {
          number: {
            min: MIN_REFRESH_INTERVAL,
            max: MAX_REFRESH_INTERVAL,
            step: 1,
            unit_of_measurement: "s",
            mode: "box",
          },
        },
      },
    ];
    this._form.computeLabel = (schema) =>
      ({
        host: "IP-Adresse",
        title: "Kartentitel",
        refresh_interval: "Aktualisierungsintervall",
      })[schema.name];
    this._form.computeHelper = (schema) =>
      ({
        host: "Nur die IP-Adresse eingeben, ohne http://.",
        refresh_interval: "Zwischen 5 Sekunden und 1 Stunde.",
      })[schema.name];
    this._form.addEventListener("value-changed", (event) => {
      const config = { ...this._config, ...event.detail.value };
      this._config = config;
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config },
          bubbles: true,
          composed: true,
        }),
      );
    });
    this.shadowRoot.replaceChildren(this._form);
  }
}

class MultimateDiyCardEditor extends ReefmanagerDiyCardEditor {
  static get defaultHost() {
    return MULTIMATE_HOST;
  }

  static get defaultTitle() {
    return "Multimate";
  }
}

customElements.define("reefmanager-diy-card", ReefmanagerDiyCard);
customElements.define("multimate-diy-card", MultimateDiyCard);
customElements.define("reefmanager-diy-card-editor", ReefmanagerDiyCardEditor);
customElements.define("multimate-diy-card-editor", MultimateDiyCardEditor);

window.customCards = window.customCards || [];
window.customCards.push(
  {
    type: "reefmanager-diy-card",
    name: "Reefmanager DIY Card",
    description: "Zeigt Temperatur und Dosierbehälter des Reefmanagers.",
    preview: false,
  },
  {
    type: "multimate-diy-card",
    name: "Multimate DIY Card",
    description: "Zeigt KH-Wert sowie Reagenz- und Abwasserstand.",
    preview: false,
  },
);
