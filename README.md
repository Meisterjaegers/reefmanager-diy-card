# Reefmanager DIY Card

Eine HACS-Custom-Lovelace-Karte für Reefmanager und Multimate. Die Karte liest die Gerätedaten direkt über deren HTTP-API aus; es wird keine Home-Assistant-Integration benötigt.

## Installation

1. Dieses Repository in HACS als benutzerdefiniertes Repository vom Typ **Dashboard** hinzufügen und installieren.
2. Die Ressource `/hacsfiles/reefmanager-diy-card/reefmanager-diy-card.js` als JavaScript-Modul laden. Bei aktivierter automatischer Ressourceneinrichtung in HACS ist dieser Schritt bereits erledigt.
3. Für jedes Gerät eine eigene Karte hinzufügen. `host` ist die Geräte-IP mit Schema, zum Beispiel `http://192.168.1.10` (ohne abschließenden Schrägstrich).

## Karten konfigurieren

Reefmanager: zeigt Temperatur und alle Dosierbehälter inklusive verbleibender Tage.

```yaml
type: custom:reefmanager-diy-card
device: reefmanager
host: http://192.168.1.10
title: Reefmanager
```

Multimate: zeigt den letzten KH-Messwert sowie Reagenz- und Abwasserstand.

```yaml
type: custom:reefmanager-diy-card
device: multimate
host: http://192.168.1.11
title: Multimate
```

Die Daten werden alle 30 Sekunden aktualisiert. Der Browser muss die Geräte-IP erreichen können. Falls die Geräte-API keine Cross-Origin-Anfragen (CORS) von Home Assistant erlaubt oder Home Assistant per HTTPS auf ein Gerät per HTTP zugreift (Mixed Content), blockiert der Browser den Abruf. In diesem Fall müssen die Geräte entsprechend konfiguriert oder über einen passenden HTTPS-/CORS-fähigen Proxy erreichbar gemacht werden.