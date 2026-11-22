# Reefmanager DIY Card

Eine HACS-Custom-Lovelace-Karte für Reefmanager und Multimate. Die Karten rufen die Daten direkt über die HTTP-API der Geräte ab; eine Home-Assistant-Integration ist nicht erforderlich.

## Installation über HACS

1. Öffne in Home Assistant **HACS → Dashboards**.
2. Wähle **Benutzerdefinierte Repositories** und füge dieses GitHub-Repository als Typ **Dashboard** hinzu.
3. Installiere **Reefmanager DIY Card** und lade Home Assistant beziehungsweise den Browser neu, falls HACS dazu auffordert.
4. Füge im Dashboard eine Karte hinzu und wähle **Reefmanager DIY Card** oder **Multimate DIY Card**. Alternativ kannst du die Karte per YAML konfigurieren.

Falls HACS die Ressource nicht automatisch registriert, füge unter **Einstellungen → Dashboards → Ressourcen** folgende URL als Ressource vom Typ **JavaScript-Modul** hinzu:

```text
/hacsfiles/reefmanager-diy-card/reefmanager-diy-card.js
```

## Reefmanager-Karte

Die Reefmanager-Karte zeigt die aktuelle Temperatur und den Temperaturverlauf sowie jeden Dosierbehälter als eigene Kachel. Der Verlauf wird über `/api/temperature/history.bin` geladen und standardmäßig auf die letzten sieben Tage begrenzt.

Standard-IP-Adresse: `192.168.178.91`

```yaml
type: custom:reefmanager-diy-card
host: 192.168.178.91
refresh_interval: 30
history_days: 7
```

Die Verlaufskurve verwendet standardmäßig diese Temperatur-Farbpunkte. Zwischen den Farben wird weich interpoliert:

| Temperatur | Farbe |
|---:|:---|
| 23 °C | `#A2D2FF` |
| 24,5 °C | `#A8E6CF` |
| 25 °C | `#B8E994` |
| 25,5 °C | `#FFF3B0` |
| 27 °C | `#FFADAD` |

Die fünf Temperaturwerte und zugehörigen Farben lassen sich im visuellen Editor oder per YAML anpassen. Temperaturwerte müssen aufsteigend sortiert sein; Farben müssen im Format `#RRGGBB` angegeben werden. Beispiel:

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

Die Multimate-Karte verwendet denselben Kachelstil wie die Reefmanager-Karte. Sie zeigt den letzten KH-Messwert ohne Verlauf sowie Reagenz- und Abwasserstand als eigene Füllstandsringe aus `/api/kh/status` und `/api/containers`. Für die Ringe gilt dieselbe Farbskala: ab 50 % grün, unter 50 % gelb und unter 25 % rot.

Standard-IP-Adresse: `192.168.178.92`

```yaml
type: custom:multimate-diy-card
host: 192.168.178.92
refresh_interval: 30
```

## Konfiguration

Beide Karten unterstützen den visuellen Editor und YAML. Dort kannst du die IP-Adresse, den Kartentitel und das Aktualisierungsintervall festlegen. Bei der Reefmanager-Karte sind außerdem die Anzahl der angezeigten Verlaufstage und die Temperatur-Farbpunkte einstellbar. Mit `refresh_interval: 0` werden die Werte einmal beim Öffnen der Karte geladen und danach nicht automatisch aktualisiert.

| Option | Karten | Standard | Werte |
|---|---|---:|---|
| `host` | Reefmanager, Multimate | gerätespezifische Standard-IP | IP-Adresse ohne `http://` |
| `title` | Reefmanager, Multimate | `Reefmanager` oder `Multimate` | Freitext |
| `refresh_interval` | Reefmanager, Multimate | `30` Sekunden | `0` = nur einmal beim Öffnen; sonst 5–3600 Sekunden |
| `history_days` | Reefmanager | `7` Tage | 1–7 Tage |
| `temperature_gradient_1_value` bis `temperature_gradient_5_value` | Reefmanager | siehe Farbskala oben | aufsteigende Temperaturwerte in °C |
| `temperature_gradient_1_color` bis `temperature_gradient_5_color` | Reefmanager | siehe Farbskala oben | Farben im Format `#RRGGBB` |

Die Karte ergänzt `http://` automatisch. Der Browser, in dem Home Assistant läuft, muss die Geräte-IP erreichen können. Die Geräte-API muss außerdem Anfragen von Home Assistant erlauben (CORS). Bei einem per HTTPS aufgerufenen Home Assistant kann der Browser HTTP-Anfragen an die Geräte als Mixed Content blockieren.
