# Reefmanager DIY Card

Eine HACS-Custom-Lovelace-Karte für Reefmanager und Multimate. Die Karte liest die Gerätedaten direkt über deren HTTP-API aus; es wird keine Home-Assistant-Integration benötigt.

## Installation

1. Dieses Repository in HACS als benutzerdefiniertes Repository vom Typ **Dashboard** hinzufügen und installieren.
2. Die Ressource `/hacsfiles/reefmanager-diy-card/reefmanager-diy-card.js` als JavaScript-Modul laden. Bei aktivierter automatischer Ressourceneinrichtung in HACS ist dieser Schritt bereits erledigt.
3. Für jedes Gerät den passenden Kartentyp hinzufügen. Die Geräteadresse ist bereits voreingestellt und kann im visuellen Editor geändert werden.

## Zwei getrennte Karten

Beide Kartentypen werden separat im Karten-Auswahldialog registriert und unterstützen den visuellen Editor. Dort lassen sich Geräteadresse, optionaler Kartentitel und Aktualisierungsintervall einstellen. Die Geräteadressen sind mit den folgenden Standardwerten vorbelegt.

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

In YAML können `host`, `title` und `refresh_interval` angepasst werden. Das Aktualisierungsintervall wird in Sekunden angegeben, ist standardmäßig `30` und darf zwischen `5` und `3600` Sekunden liegen. Beispiel:

```yaml
type: custom:reefmanager-diy-card
refresh_interval: 60
```

Wird `host` weggelassen, verwendet die jeweilige Karte ihre Standardadresse. Der Browser muss die Geräte-IP erreichen können. Falls die Geräte-API keine Cross-Origin-Anfragen (CORS) von Home Assistant erlaubt oder Home Assistant per HTTPS auf ein Gerät per HTTP zugreift (Mixed Content), blockiert der Browser den Abruf. In diesem Fall müssen die Geräte entsprechend konfiguriert oder über einen passenden HTTPS-/CORS-fähigen Proxy erreichbar gemacht werden.