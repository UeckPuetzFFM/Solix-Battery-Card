# Solix Battery Card

Animierte Glas-Batterieanzeige für Home Assistant, gedacht für Anker Solix (Solarbank) und jede andere Batterie mit Ladestand-Sensor.

- Flüssigkeit mit zwei wogenden Wellen, die sanft zum neuen Füllstand gleitet
- Beim Laden: aufsteigende Blasen, Blitz-Symbol und pulsierender Glow
- Farbe nach Ladestand (cyan, grün, gelb, orange, rot); unter 15 % pulsiert die Anzeige
- Status-Pille (Lädt, Entlädt, Bereit) mit Leistung und geschätzter Restzeit
- Optionale Chips für Solarleistung, Abgabe an das Haus und Temperatur
- Passt sich schmalen Kacheln an, respektiert „Bewegung reduzieren“
- Visueller Karten-Editor, keine weiteren Abhängigkeiten

## Installation über HACS

1. HACS → ⋮ → **Benutzerdefinierte Repositories**
2. Repository-URL eintragen, Kategorie **Dashboard** wählen
3. **Solix Battery Card** installieren und den Browser-Cache leeren

Manuell: `dist/solix-battery-card.js` nach `config/www/` kopieren und unter *Einstellungen → Dashboards → Ressourcen* als `/local/solix-battery-card.js` (JavaScript-Modul) eintragen.

## Verwendung

```yaml
type: custom:solix-battery-card
name: Solarbank 2 Pro
soc: sensor.solarbank_2_e1600_pro_ladestand
energy: sensor.solarbank_2_e1600_pro_akkuenergie
capacity_wh: 4300
power: sensor.meine_batterieleistung
solar: sensor.solarbank_2_e1600_pro_solarleistung
output: sensor.solarbank_2_e1600_pro_ac_hausabgabe
temperature: sensor.solarbank_2_e1600_pro_temperatur
```

Ein Beispiel mit beiden Solarbanks steht in [`examples/dashboard.yaml`](examples/dashboard.yaml).

## Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `soc` | – | Ladestand in % (oder `energy` zusammen mit `capacity_wh`) |
| `energy` | – | Gespeicherte Energie in Wh |
| `capacity_wh` | – | Kapazität in Wh, für Anzeige und Restzeit |
| `power` | – | Lade-/Entladeleistung in W, bestimmt den Status |
| `power_charging_positive` | `true` | `true`: positiver Wert = Laden. `false`, wenn dein Sensor umgekehrt zählt |
| `idle_threshold` | `5` | Unterhalb dieser Leistung (W) gilt die Batterie als „Bereit“ |
| `solar` | – | Chip mit Solarleistung (W) |
| `output` | – | Chip mit Abgabe an das Haus (W) |
| `temperature` | – | Chip mit Temperatur |
| `name` | `Solarbank` | Titel |
| `brand` | `Anker Solix` | Kleine Zusatzzeile oben rechts, leer = aus |
| `animations` | `true` | `false` schaltet alle Animationen ab |

Ein Tipp auf die Karte öffnet den Standard-Dialog des Ladestand-Sensors.

## Hinweise

- Ohne `power` kennt die Karte die Lade-Richtung nicht. Sie zeigt dann den Ladestand ohne Status und ohne Blasen. Bei Anker Solix gibt es je nach Integration einen Sensor für die Batterieleistung oder getrennte Sensoren für Laden und Entladen. In dem Fall kannst du dir mit einem Template-Sensor die Differenz bilden.
- Das Glas wirkt am besten über einem Hintergrundbild oder -verlauf, weil `backdrop-filter` dann etwas zum Weichzeichnen hat.

## Lizenz

MIT
