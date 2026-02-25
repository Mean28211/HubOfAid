# Projekt: FirstAid Map & Management App

## Ziel
Entwicklung einer plattformübergreifenden App (iOS, Android, Web) zur Verwaltung von:
- Defibrillatoren (AED)
- Verbandskästen
- Weiterem Erste-Hilfe-Material

Die App soll Standorte auf einer Karte anzeigen und ein QR-/NFC-basiertes Entnahmesystem enthalten.

---

## Tech Stack

Frontend:
- Ionic Framework
- HTML, CSS, TypeScript
- Capacitor (für native Funktionen)

Backend:
- Supabase (PostgreSQL, Auth, Storage)

Features:
- OpenStreetMap Integration
- QR-Code Scanner
- NFC-Unterstützung
- Push Notifications
- Offline-Modus
- Heatmap Analyse
- Ablaufdatum-Tracking
- Mindestbestandsüberwachung
- Fotodokumentation
- Rollen & Rechte (Admin, Verantwortlicher, Nutzer)

---

## Kernfunktionen

### 1. Kartenansicht
- Anzeige aller AEDs und Verbandskästen
- Filter nach Materialtyp
- Statusanzeige (OK, Niedrig, Nachfüllen nötig)

### 2. QR-Code Scan
- Scan öffnet Detailseite
- Auswahl entnommener Artikel
- Mengenangabe
- Zeitstempel
- Speicherung in Datenbank
- Push-Benachrichtigung an Verantwortlichen

### 3. Bestandsüberwachung
- Mindestbestand pro Artikel
- Automatische Warnung bei Unterschreitung

### 4. Ablaufdatum-Tracking
- Warnung 90 / 30 Tage vorher
- Statusanzeige „Abgelaufen“

### 5. Fotodokumentation
- Foto bei Wartung oder Entnahme
- Speicherung im Cloud-Storage

### 6. NFC Unterstützung
- Alternative zum QR-Code
- Direkter Zugriff auf Objektseite

### 7. Heatmap
- Visualisierung der häufigsten Entnahme-Orte
- Analyse zur Standortoptimierung

---

## Benutzerrollen
- Admin (voller Zugriff)
- Verantwortlicher (Verwaltung & Benachrichtigungen)
- Nutzer (Scan & Eintrag)

---

## Zusätzliche Anforderungen
- DSGVO-konform
- Cloud-basiert
- Offline-fähig mit Synchronisierung
- Responsive Design
- Mehrsprachigkeit (DE / EN)

---

## Ziel
Erstellung eines professionellen MVP mit skalierbarer Architektur.
