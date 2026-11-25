# Reefmanager DIY Card

![Reefmanager- und Multimate-Karte](images/reefmanager-multimate-cropped.png)

Eine HACS-Custom-Lovelace-Karte für Reefmanager und Multimate. Die Karten rufen die Daten direkt über die HTTP-API der Geräte ab; eine Home-Assistant-Integration ist nicht erforderlich.

## Installation über HACS

### Direkt aus dem HACS-Store

1. Öffne in Home Assistant **HACS → Dashboards** und wähle **Repository erkunden und herunterladen** (je nach HACS-Version kann die Bezeichnung abweichen).
2. Suche nach **Reefmanager DIY Card**, öffne den Eintrag und wähle **Herunterladen**.
3. Lade Home Assistant oder den Browser neu, falls HACS dazu auffordert.
4. Füge im Dashboard eine Karte hinzu und wähle **Reefmanager DIY Card** oder **Multimate DIY Card**. Alternativ kannst du die Karte per YAML konfigurieren.

### Falls die Karte im Store nicht erscheint

Füge sie einmalig als Custom Repository hinzu: Öffne **HACS → Dashboards → Benutzerdefinierte Repositories**, trage `https://github.com/meisterjaegers/reefmanager-diy-card` ein und wähle den Typ **Dashboard**. Danach kannst du die Karte in HACS installieren und wie oben zum Dashboard hinzufügen.

Falls HACS die Ressource nicht automatisch registriert, füge unter **Einstellungen → Dashboards → Ressourcen** folgende URL als Ressource vom Typ **JavaScript-Modul** hinzu:

```text
/hacsfiles/reefmanager-diy-card/reefmanager-diy-card.js
```

## Reefmanager-Karte

Die Reefmanager-Karte zeigt gemessene Temperaturwerte nur dann an, wenn sie größer als 0 sind. Der pH-Wert aus `/api/ph/live` wird nur bei `success: true` und einem Wert größer als 0 angezeigt. Der Temperaturverlauf sowie die Durchschnittstemperatur der letzten 24 Stunden und sieben Tage werden über `/api/temperature/history.bin` geladen; Temperaturwerte von 0 werden dabei ignoriert. Der Verlauf ist standardmäßig auf die letzten sieben Tage begrenzt. Der Titel „Reefmanager“ verlinkt auf die Weboberfläche des Geräts; die Verbrauchsbehälter-Kachel öffnet `/containers.html`.

Standard-IP-Adresse: `192.168.178.91`

```yaml
type: custom:reefmanager-diy-card
host: 192.168.178.91
refresh_interval: 30
history_days: 7
```

Die Verlaufskurve verwendet standardmäßig diese Temperatur-Farbpunkte. Zwischen den Farben wird weich interpoliert. Die Farbwerte sind im visuellen Editor in der einklappbaren Gruppe **Temperatur-Farbverlauf** konfigurierbar:

| Temperatur | Farbe |
|---:|:---|
| 23 °C | `#A2D2FF` |
| 24,5 °C | `#A8E6CF` |
| 25 °C | `#B8E994` |
| 25,5 °C | `#FFF3B0` |
| 27 °C | `#FFADAD` |

Temperaturwerte müssen aufsteigend sortiert sein; Farben müssen im Format `#RRGGBB` angegeben werden. Die YAML-Optionen heißen `temperature_gradient_1_value` bis `temperature_gradient_5_value` und `temperature_gradient_1_color` bis `temperature_gradient_5_color`.

```yaml
type: custom:reefmanager-diy-card
temperature_gradient_1_value: 23
temperature_gradient_1_color: "#A2D2FF"
temperature_gradient_2_value: 24.5
temperature_gradient_2_color: "#A8E6CF"
temperature_gradient_3_value: 25
temperature_gradient_3_color: "#B8E994"
temperature_gradient_4_value: 25.5
temperature_gradient_4_color: "#FFF3B0"
temperature_gradient_5_value: 27
temperature_gradient_5_color: "#FFADAD"
```

Die Füllstandsringe der Dosierbehälter zeigen den aktuellen Inhalt und färben sich abhängig vom Füllstand: ab 50 % grün (`#B8E994`), unter 50 % gelb (`#FFF3B0`) und unter 25 % rot (`#FFADAD`).

## Multimate-Karte

Die Multimate-Karte verwendet denselben Kachelstil wie die Reefmanager-Karte. Sie zeigt KH und PO₄ nur bei Messwerten größer als 0. Der pH-Wert aus `/api/kh/status` wird nur angezeigt, wenn zusätzlich `ph_enabled: true` ist. Der KH-Verlauf der konfigurierten letzten 1 bis 7 Tage und die Durchschnitte der letzten 24 Stunden und sieben Tage kommen aus `/api/kh/history`; KH-Verlaufswerte von 0 werden ignoriert. Reagenz- und Abwasserstand werden als Füllstandsringe aus `/api/containers` angezeigt. Auf schmalen Smartphone-Bildschirmen werden bis zu vier Behälter nebeneinander angeordnet. Der Titel „Multimate“ verlinkt auf die Weboberfläche des Geräts; die Verbrauchsbehälter-Kachel öffnet `/containers.html`. Die KH-Kurve interpoliert weich zwischen diesen Farbwerten:

| KH-Wert | Farbe |
|---:|:---|
| 6,5 | `#A2D2FF` |
| 7 | `#A8E6CF` |
| 7,5 | `#B8E994` |
| 8 | `#FFF3B0` |
| 8,5 | `#FFADAD` |

Der Reagenzring verwendet dieselbe Farbskala wie beim Reefmanager: ab 50 % grün, unter 50 % gelb und unter 25 % rot. Beim Abwasserbehälter bedeutet ein steigender Füllstand ein steigendes Risiko: bis einschließlich 50 % grün, über 50 % bis unter 75 % gelb und ab 75 % rot.

Die KH-Farbpunkte sind im visuellen Editor in der einklappbaren Gruppe **KH-Farbverlauf** einstellbar. Die fünf Werte müssen aufsteigend sortiert sein; Farben müssen im Format `#RRGGBB` angegeben werden. Per YAML heißen die Optionen `kh_gradient_1_value` bis `kh_gradient_5_value` und `kh_gradient_1_color` bis `kh_gradient_5_color`:

```yaml
type: custom:multimate-diy-card
kh_gradient_1_value: 6.5
kh_gradient_1_color: "#A2D2FF"
kh_gradient_2_value: 7
kh_gradient_2_color: "#A8E6CF"
kh_gradient_3_value: 7.5
kh_gradient_3_color: "#B8E994"
kh_gradient_4_value: 8
kh_gradient_4_color: "#FFF3B0"
kh_gradient_5_value: 8.5
kh_gradient_5_color: "#FFADAD"
```

Standard-IP-Adresse: `192.168.178.92`

```yaml
type: custom:multimate-diy-card
host: 192.168.178.92
refresh_interval: 30
history_days: 7
```

## Konfiguration

Beide Karten unterstützen den visuellen Editor und YAML. Dort kannst du die IP-Adresse, den Kartentitel und das Aktualisierungsintervall festlegen. Bei beiden Karten ist die Anzahl der angezeigten Verlaufstage einstellbar; zusätzlich lassen sich beim Reefmanager die Temperatur-Farbpunkte und bei Multimate der KH-Farbverlauf anpassen. Beide Farbverläufe sind im visuellen Editor einklappbar gruppiert. Mit `refresh_interval: 0` werden die Werte einmal beim Öffnen der Karte geladen und danach nicht automatisch aktualisiert.

| Option | Karten | Standard | Werte |
|---|---|---:|---|
| `host` | Reefmanager, Multimate | gerätespezifische Standard-IP | IP-Adresse ohne `http://` |
| `title` | Reefmanager, Multimate | `Reefmanager` oder `Multimate` | Freitext |
| `refresh_interval` | Reefmanager, Multimate | `30` Sekunden | `0` = nur einmal beim Öffnen; sonst 5–3600 Sekunden |
| `history_days` | Reefmanager, Multimate | `7` Tage | 1–7 Tage; begrenzt den angezeigten Temperatur- beziehungsweise KH-Verlauf |
| `temperature_gradient_1_value` bis `temperature_gradient_5_value` | Reefmanager | siehe Farbskala oben | aufsteigende Temperaturwerte in °C |
| `temperature_gradient_1_color` bis `temperature_gradient_5_color` | Reefmanager | siehe Farbskala oben | Farben im Format `#RRGGBB` |
| `kh_gradient_1_value` bis `kh_gradient_5_value` | Multimate | siehe KH-Farbskala oben | aufsteigende KH-Werte von 0 bis 20 dKH |
| `kh_gradient_1_color` bis `kh_gradient_5_color` | Multimate | siehe KH-Farbskala oben | Farben im Format `#RRGGBB` |

Die Karte ergänzt `http://` automatisch. Der Browser, in dem Home Assistant läuft, muss die Geräte-IP erreichen können. Die Geräte-API muss außerdem Anfragen von Home Assistant erlauben (CORS). Bei einem per HTTPS aufgerufenen Home Assistant kann der Browser HTTP-Anfragen an die Geräte als Mixed Content blockieren.
