const REEFMANAGER_HOST = "http://192.168.178.91";
const MULTIMATE_HOST = "http://192.168.178.92";

class ReefmanagerCardBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._error = null;
    this._loading = false;
    this._timer = null;
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
    this._config = {
      ...config,
      host: String(config.host || this._defaultHost()).replace(/\/+$/, ""),
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
    return {
      host: this._defaultHost(),
      title: this._defaultTitle(),
    };
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

  _startPolling() {
    window.clearInterval(this._timer);
    this._refresh();
    this._timer = window.setInterval(() => this._refresh(), 30_000);
  }

  async _fetchJson(path) {
    const response = await fetch(`${this._config.host}${path}`, {
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
    try {
      const endpoints =
        this._deviceType() === "reefmanager"
          ? ["/api/temperature/status", "/api/containers"]
          : ["/api/kh/status", "/api/containers"];
      const [status, containers] = await Promise.all(
        endpoints.map((path) => this._fetchJson(path)),
      );
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

  _reefmanagerContent() {
    const fragment = document.createDocumentFragment();
    const temperature = this._section("Temperatur");
    const controls = this._data.status.controls ?? [];
    if (controls.length === 0) {
      temperature.append(this._element("p", "muted", "Keine Temperaturdaten verfügbar."));
    } else {
      for (const control of controls) {
        temperature.append(
          this._metric(
            control.name || "Temperatur",
            Number.isFinite(control.currentTemp)
              ? control.currentTemp.toFixed(1)
              : "—",
            " °C",
          ),
        );
      }
    }
    fragment.append(temperature);

    const containers = this._section("Dosierbehälter");
    const items = this._data.containers.containers ?? [];
    if (items.length === 0) {
      containers.append(this._element("p", "muted", "Keine Behälterdaten verfügbar."));
    }
    for (const item of items) {
      containers.append(
        this._container(item.name || `Behälter ${item.port}`, item.current, item.max, "ml"),
      );
      if (Number.isFinite(item.days_left) && item.days_left >= 0) {
        containers.append(
          this._element("p", "detail", `${item.days_left.toFixed(1)} Tage verbleibend`),
        );
      }
    }
    fragment.append(containers);
    return fragment;
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
    const card = this._element("article", "card");
    card.append(this._element("header", "", title));

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
      host: this._config.host || this.constructor.defaultHost,
      title: this._config.title || this.constructor.defaultTitle,
    };
    this._form.schema = [
      { name: "host", selector: { text: {} } },
      { name: "title", selector: { text: {} } },
    ];
    this._form.computeLabel = (schema) =>
      schema.name === "host" ? "Geräteadresse" : "Kartentitel";
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
  },
  {
    type: "multimate-diy-card",
    name: "Multimate DIY Card",
    description: "Zeigt KH-Wert sowie Reagenz- und Abwasserstand.",
  },
);
