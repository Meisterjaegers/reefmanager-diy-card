const REEFMANAGER_HOST = "192.168.178.91";
const MULTIMATE_HOST = "192.168.178.92";
const DEFAULT_REFRESH_INTERVAL = 30;
const MIN_REFRESH_INTERVAL = 5;
const MAX_REFRESH_INTERVAL = 3600;
const DEFAULT_HISTORY_DAYS = 7;
const MIN_HISTORY_DAYS = 1;
const MAX_HISTORY_DAYS = 7;
const DEFAULT_TEMPERATURE_GRADIENT = [
  { value: 23, color: "#A2D2FF" },
  { value: 24.5, color: "#A8E6CF" },
  { value: 25, color: "#B8E994" },
  { value: 25.5, color: "#FFF3B0" },
  { value: 27, color: "#FFADAD" },
];
const DEFAULT_KH_GRADIENT = [
  { value: 6.5, color: "#A2D2FF" },
  { value: 7, color: "#A8E6CF" },
  { value: 7.5, color: "#B8E994" },
  { value: 8, color: "#FFF3B0" },
  { value: 8.5, color: "#FFADAD" },
];

class ReefmanagerCardBase extends HTMLElement {
  static getStubConfig() {
    const config = {
      host: this.defaultHost,
      title: this.defaultTitle,
      refresh_interval: DEFAULT_REFRESH_INTERVAL,
      ...(this.device !== "multimate"
        ? { history_days: DEFAULT_HISTORY_DAYS }
        : {}),
    };
    if (this.device !== "multimate") {
      DEFAULT_TEMPERATURE_GRADIENT.forEach((stop, index) => {
        config[`temperature_gradient_${index + 1}_value`] = stop.value;
        config[`temperature_gradient_${index + 1}_color`] = stop.color;
      });
    }
    return config;
  }

  static getConfigForm() {
    const schema = [
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
            min: 0,
            max: MAX_REFRESH_INTERVAL,
            step: 1,
            unit_of_measurement: "s",
            mode: "box",
          },
        },
      },
    ];
    if (this.device !== "multimate") {
      schema.push({
        name: "history_days",
        default: DEFAULT_HISTORY_DAYS,
        selector: {
          number: {
            min: MIN_HISTORY_DAYS,
            max: MAX_HISTORY_DAYS,
            step: 1,
            unit_of_measurement: "d",
            mode: "box",
          },
        },
      });
      DEFAULT_TEMPERATURE_GRADIENT.forEach((stop, index) => {
        const point = index + 1;
        schema.push(
          {
            name: `temperature_gradient_${point}_value`,
            default: stop.value,
            selector: {
              number: {
                min: -10,
                max: 60,
                step: 0.1,
                unit_of_measurement: "°C",
                mode: "box",
              },
            },
          },
          {
            name: `temperature_gradient_${point}_color`,
            default: stop.color,
            selector: { text: {} },
          },
        );
      });
    }

    return {
      schema,
      computeLabel: (schema) =>
        ({
          host: "IP-Adresse",
          title: "Kartentitel",
          refresh_interval: "Aktualisierungsintervall",
          history_days: "Temperaturhistorie (Tage)",
          ...Object.fromEntries(
            DEFAULT_TEMPERATURE_GRADIENT.flatMap((_, index) => [
              [
                `temperature_gradient_${index + 1}_value`,
                `Farbpunkt ${index + 1}: Temperatur`,
              ],
              [
                `temperature_gradient_${index + 1}_color`,
                `Farbpunkt ${index + 1}: Farbe (#RRGGBB)`,
              ],
            ]),
          ),
        })[schema.name],
      computeHelper: (schema) =>
        ({
          host: "Nur die IP-Adresse eingeben, ohne http://.",
          refresh_interval:
            "0 lädt die Werte einmal beim Öffnen der Karte; 5 bis 3600 aktualisiert regelmäßig.",
          history_days: "Zeigt die Messwerte der letzten 1 bis 7 Tage.",
          ...Object.fromEntries(
            DEFAULT_TEMPERATURE_GRADIENT.map((_, index) => [
              `temperature_gradient_${index + 1}_value`,
              "Die Temperaturpunkte müssen aufsteigend sortiert sein.",
            ]),
          ),
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
    this._khHistory = [];
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
    const historyDays = config.history_days ?? DEFAULT_HISTORY_DAYS;
    const temperatureGradient =
      this._device === "reefmanager"
        ? this._getTemperatureGradient(config)
        : undefined;
    if (
      typeof refreshInterval !== "number" ||
      !Number.isFinite(refreshInterval) ||
      (refreshInterval !== 0 &&
        refreshInterval < MIN_REFRESH_INTERVAL) ||
      refreshInterval > MAX_REFRESH_INTERVAL
    ) {
      throw new Error(
        `refresh_interval muss 0 oder zwischen 5 und ${MAX_REFRESH_INTERVAL} Sekunden liegen.`,
      );
    }
    if (
      this._device === "reefmanager" &&
      (!Number.isInteger(historyDays) ||
        historyDays < MIN_HISTORY_DAYS ||
        historyDays > MAX_HISTORY_DAYS)
    ) {
      throw new Error(
        `history_days muss eine ganze Zahl zwischen ${MIN_HISTORY_DAYS} und ${MAX_HISTORY_DAYS} sein.`,
      );
    }
    this._config = {
      ...config,
      host: this._normalizeHost(config.host || this._defaultHost()),
      refresh_interval: refreshInterval,
      ...(this._device === "reefmanager" ? { history_days: historyDays } : {}),
    };
    if (temperatureGradient) this._temperatureGradient = temperatureGradient;
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

  getStubConfig() {
    return this.constructor.getStubConfig();
  }

  _getTemperatureGradient(config) {
    const gradient = DEFAULT_TEMPERATURE_GRADIENT.map((stop, index) => ({
      value:
        config[`temperature_gradient_${index + 1}_value`] ?? stop.value,
      color:
        config[`temperature_gradient_${index + 1}_color`] ?? stop.color,
    }));
    if (
      gradient.some(
        (stop, index) =>
          typeof stop.value !== "number" ||
          !Number.isFinite(stop.value) ||
          stop.value < -10 ||
          stop.value > 60 ||
          typeof stop.color !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(stop.color) ||
          (index > 0 && stop.value <= gradient[index - 1].value),
      )
    ) {
      throw new Error(
        "Die Temperatur-Farbpunkte müssen gültige Hex-Farben haben und aufsteigend sortiert sein.",
      );
    }
    return gradient;
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
    this._timer = null;
    this._refresh();
    if (this._config.refresh_interval === 0) return;
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
      const historyRequest = (
        isReefmanager
          ? this._fetchTemperatureHistory()
          : this._fetchKhHistory()
      )
        .then((history) => ({ history }))
        .catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        }));
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
      } else if (!isReefmanager && historyResult.history) {
        this._khHistory = historyResult.history;
      } else if (!isReefmanager && historyResult.error) {
        this._khHistory = [];
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

  async _fetchKhHistory() {
    const history = await this._fetchJson("/api/kh/history");
    if (!Array.isArray(history)) {
      throw new Error("/api/kh/history: ungültiges Datenformat.");
    }
    return history
      .filter(
        (point) =>
          point !== null &&
          typeof point === "object" &&
          Number.isFinite(point.t) &&
          point.t > 0 &&
          Number.isFinite(point.v),
      )
      .map((point) => ({ timestamp: point.t, value: point.v }))
      .sort((a, b) => a.timestamp - b.timestamp);
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
    const value = Number.isFinite(control.currentTemp)
      ? control.currentTemp.toFixed(2)
      : "—";
    const reading = this._element("div", "temperature-reading");
    reading.append(
      this._element("span", "temperature-value", value),
      this._element("span", "temperature-unit", "°C"),
    );
    tile.append(
      this._sectionLabel("Temperatur"),
      reading,
      this._temperatureSparkline(control),
    );
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
    const key = String(control.port ?? control.name ?? "temperature");
    const historyDays = this._config.history_days ?? DEFAULT_HISTORY_DAYS;
    const windowSeconds = historyDays * 24 * 60 * 60;
    const endTimestamp = Date.now() / 1000;
    const startTimestamp = endTimestamp - windowSeconds;
    const history = (this._temperatureHistory.get(key) ?? []).filter(
      (point) =>
        point.timestamp >= startTimestamp && point.timestamp <= endTimestamp,
    );
    return this._historySparkline(
      history,
      this._temperatureGradient ?? DEFAULT_TEMPERATURE_GRADIENT,
      `Temperaturverlauf der letzten ${historyDays} Tage`,
    );
  }

  _khSparkline() {
    return this._historySparkline(
      this._khHistory,
      DEFAULT_KH_GRADIENT,
      "KH-Verlauf",
    );
  }

  _sectionLabel(label) {
    return this._element("h2", "tile-section-label", label);
  }

  _historySparkline(history, gradient, label) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "sparkline");
    svg.setAttribute("viewBox", "0 0 200 40");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    if (history.length === 0) return svg;
    const values = history.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coordinates = history.map((point, index) => ({
      x: history.length === 1 ? 100 : (index / (history.length - 1)) * 200,
      y: 36 - ((point.value - min) / range) * 32,
      value: point.value,
    }));
    if (coordinates.length === 1) {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", String(coordinates[0].x));
      dot.setAttribute("cy", String(coordinates[0].y));
      dot.setAttribute("r", "2");
      dot.setAttribute("fill", this._gradientColor(coordinates[0].value, gradient));
      svg.append(dot);
      return svg;
    }

    for (let index = 1; index < coordinates.length; index += 1) {
      const previous = coordinates[index - 1];
      const current = coordinates[index];
      const segment = document.createElementNS("http://www.w3.org/2000/svg", "line");
      segment.setAttribute("x1", String(previous.x));
      segment.setAttribute("y1", String(previous.y));
      segment.setAttribute("x2", String(current.x));
      segment.setAttribute("y2", String(current.y));
      segment.setAttribute(
        "stroke",
        this._gradientColor((previous.value + current.value) / 2, gradient),
      );
      segment.setAttribute("stroke-width", "2");
      segment.setAttribute("stroke-linecap", "round");
      svg.append(segment);
    }
    return svg;
  }

  _gradientColor(value, gradient) {
    if (value <= gradient[0].value) return gradient[0].color;
    if (value >= gradient[gradient.length - 1].value) {
      return gradient[gradient.length - 1].color;
    }

    const nextIndex = gradient.findIndex((stop) => stop.value >= value);
    const lower = gradient[nextIndex - 1];
    const upper = gradient[nextIndex];
    const ratio = (value - lower.value) / (upper.value - lower.value);
    const easedRatio = ratio * ratio * (3 - 2 * ratio);
    const lowerRgb = lower.color
      .match(/[a-f\d]{2}/gi)
      .map((part) => parseInt(part, 16));
    const upperRgb = upper.color
      .match(/[a-f\d]{2}/gi)
      .map((part) => parseInt(part, 16));
    const rgb = lowerRgb.map((component, index) =>
      Math.round(component + (upperRgb[index] - component) * easedRatio),
    );
    return `#${rgb.map((component) => component.toString(16).padStart(2, "0")).join("")}`;
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
    gauge.setAttribute("viewBox", "0 0 100 100");
    gauge.setAttribute("role", "img");
    gauge.setAttribute(
      "aria-label",
      percentage === null ? `${label}: kein Füllstand` : `${label}: ${Math.round(percentage * 100)} %`,
    );

    const circumference = 2 * Math.PI * 42;
    const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    track.setAttribute("class", "gauge-track");
    track.setAttribute("cx", "50");
    track.setAttribute("cy", "50");
    track.setAttribute("r", "42");
    gauge.append(track);

    if (percentage !== null) {
      const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      arc.setAttribute(
        "class",
        `gauge-value${percentage < 0.25 ? " low" : percentage < 0.5 ? " medium" : ""}`,
      );
      arc.setAttribute("cx", "50");
      arc.setAttribute("cy", "50");
      arc.setAttribute("r", "42");
      arc.setAttribute("stroke-dasharray", String(circumference));
      arc.setAttribute(
        "stroke-dashoffset",
        String(circumference * (1 - percentage)),
      );
      arc.setAttribute("transform", "rotate(-90 50 50)");
      gauge.append(arc);
    }

    const reading = document.createElementNS("http://www.w3.org/2000/svg", "text");
    reading.classList.add("gauge-reading");
    reading.textContent = `${this._number(current)}`;
    reading.setAttribute("x", "50");
    reading.setAttribute("y", "48");
    reading.setAttribute("text-anchor", "middle");
    gauge.append(reading);
    const unit = document.createElementNS("http://www.w3.org/2000/svg", "text");
    unit.classList.add("gauge-unit");
    unit.textContent = "ml";
    unit.setAttribute("x", "50");
    unit.setAttribute("y", "61");
    unit.setAttribute("text-anchor", "middle");
    gauge.append(unit);
    tile.append(gauge, this._element("div", "gauge-label", label));

    if (Number.isFinite(item.days_left) && item.days_left === -1) {
      tile.append(this._element("div", "gauge-detail", "∞ Tage"));
    } else if (Number.isFinite(item.days_left) && item.days_left >= 0) {
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
    grid.append(this._sectionLabel("Verbrauchsbehälter"));
    if (items.length === 0) {
      grid.append(this._element("article", "tile muted", "Keine Behälterdaten verfügbar."));
    }
    for (const item of items) {
      grid.append(this._containerTile(item));
    }
    return grid;
  }

  _multimateContent() {
    const grid = this._element("div", "reefmanager-grid");
    const value = this._data.status.last_kh;
    const khTile = this._element("article", "tile kh-tile");
    khTile.setAttribute("aria-label", "KH-Wert");
    const reading = this._element("div", "temperature-reading");
    reading.append(
      this._element(
        "span",
        "temperature-value",
        Number.isFinite(value) ? value.toFixed(2) : "—",
      ),
      this._element("span", "temperature-unit", "dKH"),
    );
    khTile.append(
      this._sectionLabel("KH"),
      reading,
      this._khSparkline(),
    );
    if (this._historyError) {
      khTile.append(
        this._element(
          "div",
          "history-error",
          `KH-Verlauf nicht verfügbar: ${this._historyError}`,
        ),
      );
    }
    grid.append(khTile);

    grid.append(this._sectionLabel("Verbrauchsbehälter"));
    const items = [
      ["Reagenz", this._data.containers.reagent],
      ["Abwasser", this._data.containers.waste],
    ];
    for (const [label, item] of items) {
      if (item) {
        grid.append(this._containerTile({ ...item, name: label }));
      } else {
        grid.append(
          this._element("article", "tile muted", `${label}: keine Behälterdaten verfügbar.`),
        );
      }
    }
    return grid;
  }

  _number(value) {
    return Number.isFinite(value)
      ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : "—";
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const title = this._config.title || this._defaultTitle();
    const showDeviceTiles = this._data && !this._error;
    const card = this._element(
      showDeviceTiles ? "div" : "article",
      showDeviceTiles ? "device-layout" : "card",
    );
    if (showDeviceTiles) {
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
      .device-layout { display: block; }
      .layout-title { color: var(--secondary-text-color); font-size: 1rem; font-weight: 500; margin: 0 0 10px; }
      .tile {
        background: var(--ha-card-background, var(--card-background-color, white));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px #0002);
        box-sizing: border-box;
        min-width: 0;
        padding: 14px 16px;
      }
      .tile-section-label { color: var(--secondary-text-color); font-size: .9rem; font-weight: 500; margin: 0 0 8px; }
      .reefmanager-grid > .tile-section-label { grid-column: 1 / -1; margin: 4px 0 -4px; }
      .temperature-tile { grid-column: 1 / -1; }
      .kh-tile { grid-column: 1 / -1; }
      .temperature-reading { align-items: baseline; display: flex; gap: 4px; margin: 12px 0 2px; }
      .temperature-value { font-size: 1.7rem; font-weight: 400; }
      .temperature-unit { color: var(--secondary-text-color); font-size: .9rem; }
      .sparkline { display: block; height: 34px; margin-top: 6px; width: 100%; }
      .sparkline line { stroke-linecap: round; }
      .history-error { color: var(--secondary-text-color); font-size: .75rem; margin-top: 6px; }
      .container-tile { align-items: center; display: flex; flex-direction: column; justify-content: center; }
      .container-gauge { aspect-ratio: 1; display: block; height: auto; overflow: visible; width: min(100%, 84px); }
      .gauge-track, .gauge-value { fill: none; stroke-linecap: round; stroke-width: 8; }
      .gauge-track { stroke: var(--disabled-color, #e8e8ec); }
      .gauge-value { stroke: #B8E994; }
      .gauge-value.medium { stroke: #FFF3B0; }
      .gauge-value.low { stroke: #FFADAD; }
      .gauge-reading { fill: var(--primary-text-color); font-size: 14px; font-weight: 500; }
      .gauge-unit { fill: var(--secondary-text-color); font-size: 9px; }
      .gauge-label { font-size: .9rem; margin-top: 3px; text-align: center; }
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

}

customElements.define("reefmanager-diy-card", ReefmanagerDiyCard);
customElements.define("multimate-diy-card", MultimateDiyCard);

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
