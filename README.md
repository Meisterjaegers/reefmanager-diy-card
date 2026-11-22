# Reefmanager DIY Card

Eine HACS-Custom-Lovelace-Karte für Reefmanager und Multimate. Die Karte liest die Gerätedaten direkt über deren HTTP-API aus; es wird keine Home-Assistant-Integration benötigt.

## Installation

1. Dieses Repository in HACS als benutzerdefiniertes Repository vom Typ **Dashboard** hinzufügen und installieren.
2. Die Ressource `/hacsfiles/reefmanager-diy-card/reefmanager-diy-card.js` als JavaScript-Modul laden. Bei aktivierter automatischer Ressourceneinrichtung in HACS ist dieser Schritt bereits erledigt.
3. Für jedes Gerät den passenden Kartentyp hinzufügen. Die Geräteadresse ist bereits voreingestellt und kann im visuellen Editor geändert werden.

## Zwei getrennte Karten

Der visuelle Editor ist für beide Karten verfügbar. Er bietet Felder für die Geräteadresse und den optionalen Kartentitel. Die Adressen sind bereits mit den folgenden Standardwerten vorbelegt und können im Editor geändert werden.

### Reefmanager

Zeigt Temperatur und alle Dosierbehälter inklusive verbleibender Tage. Der Standard-Host ist `http://192.168.178.91`.

```yaml
type: custom:reefmanager-diy-card
host: http://192.168.178.91
```

### Multimate

Zeigt den letzten KH-Messwert sowie Reagenz- und Abwasserstand. Der Standard-Host ist `http://192.168.178.92`.

```yaml
type: custom:multimate-diy-card
host: http://192.168.178.92
```

In YAML können `host` und `title` angepasst werden. Wird `host` weggelassen, verwendet die jeweilige Karte ihre Standardadresse. Die Daten werden alle 30 Sekunden aktualisiert. Der Browser muss die Geräte-IP erreichen können. Falls die Geräte-API keine Cross-Origin-Anfragen (CORS) von Home Assistant erlaubt oder Home Assistant per HTTPS auf ein Gerät per HTTP zugreift (Mixed Content), blockiert der Browser den Abruf. In diesem Fall müssen die Geräte entsprechend konfiguriert oder über einen passenden HTTPS-/CORS-fähigen Proxy erreichbar gemacht werden.