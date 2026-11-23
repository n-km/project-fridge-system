# Changelog

Alle nennenswerten Änderungen an PFS werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/):

- **MAJOR** (`2.0.0`) – Änderungen, nach denen etwas Bestehendes nicht mehr wie vorher funktioniert
  (z. B. API-Umbau, manuelle Schritte beim Update nötig)
- **MINOR** (`1.1.0`) – neue Funktionen, abwärtskompatibel; Datenbank-Migrationen laufen automatisch
- **PATCH** (`1.0.1`) – Fehlerbehebungen

## [Unveröffentlicht]

## [1.1.0] – 2026-11-23

### Hinzugefügt

- **Erweiterter Modus** (in den Einstellungen einschaltbar) mit **2,5D-Ansicht** der Kühlgeräte:
  - Tür bzw. Truhendeckel öffnet sich perspektivisch, Fächer werden als gekippte Böden gezeigt
  - **Schubladen herausziehen** (antippen), Türfächer an der Innenseite der Tür, Körbe der Truhe anheben
  - Artikel liegen als Kacheln in einem **Raster**; gestapelte Artikel sind versetzt dargestellt
  - **Ziehen & Ablegen** mit Maus und Touch (langes Drücken), auch zwischen Fächern;
    **Größe ändern** über die Ecke der Kachel; Vorschau zeigt grün/rot, ob der Platz frei ist
  - **Tastatur:** Pfeiltasten verschieben, Umschalt+Pfeil ändert die Größe
  - Ampel-Markierung im Gerät, **„Wo ist …?“-Suche** hebt Treffer hervor und öffnet ihre Schubladen
  - Ablage **„Noch nicht platziert“** mit „Alle einsortieren“
  - Beim Einlegen Platz wählen: automatisch, selbst wählen oder später; Platz im Artikel-Sheet ändern
- **Geräte-Editor:** Bauform-Vorlagen (Kühlschrank, Kühl-Gefrier-Kombi, Gefrierschrank, Gefriertruhe,
  Getränkekühlschrank), Bauform stehend/Truhe, Türfarbe, Fächer sortieren; je Fach Art (Ablage, Schublade,
  Türfach, Korb, Flaschenablage), Bereich (Kühl-/Gefrierbereich), Breite × Tiefe, Stapelhöhe, Höhe
- **Gefrierbereich in Kühlschränken** (z. B. Kombi): MHD-Vorschlag nutzt dort die Tiefkühl-Haltbarkeit
- **Einstellungen für dich:** Design hell/dunkel/automatisch, Dichte, Foto oder Symbol, Animationen reduzieren,
  Wischgesten, Standard-Kühlgerät, Startseite (Bereiche ein-/ausblenden und sortieren), Optionen des
  erweiterten Modus (Perspektive, Darstellung, Feldgröße, Namen, Haltbarkeit, Startansicht) mit Live-Vorschau
- **Einstellungen für den Haushalt:** „Bald fällig“-Schwelle, eigene Kategorien mit Symbol und Farbe,
  Standardkategorien ausblenden oder umgestalten, eigene Einheiten
- **Dunkles Design**
- **Wischgesten** in Listen: nach links entnehmen, nach rechts bearbeiten
- Startseite: neue Bereiche „Zuletzt eingelegt“ und „Kurzstatistik“
- Vorlagen merken sich ihre Größe im Raster
- API: `GET/PATCH /api/settings/me`, `GET/PATCH /api/settings/household`,
  `POST /api/settings/household/categories`, `PATCH /api/items/:id/placement`,
  `GET /api/compartments/:id/free`, `PUT /api/appliances/:id/compartments/order`
- `ROADMAP.md`

### Geändert

- Überall Hover-, Fokus- und Druckzustände; Türen heben sich beim Überfahren an
- Übergang beim Öffnen eines Kühlgeräts (View Transitions), Ladeplatzhalter statt Kreisel
- Bestehende Fächer werden bei der Migration eingeordnet (Gemüsefach/Schubladen → Schublade, Tür → Türfach)

## [1.0.0] – 2026-11-23

Erste Version.

### Hinzugefügt

- **Haushalte & Konten:** Registrierung, Login per Session-Cookie, Beitritt per Einladungscode,
  Mitgliederliste, Code neu erzeugen
- **Kühlgeräte:** Kühlschränke und Tiefkühler mit Name und Standort; Fächer werden vorgeschlagen
  und lassen sich umbenennen, ergänzen und löschen
- **Artikel einlegen:** aus 30 Standard-Vorlagen oder frei; Foto mit der Handykamera oder aus der Galerie;
  Fach, genauer Platz, Menge, Einlege-/Einfrierdatum, MHD und Notiz
- **MHD-Vorschlag** aus der Vorlage, abhängig von Kühlschrank oder Tiefkühler; Schnellwahl +3 Tage bis +3 Monate
- **Haltbarkeits-Ampel** und Liste „Muss bald weg“ auf der Übersicht; Suche über alle Geräte
- **Entnehmen** mit Grund (verbraucht, weggeworfen, verschenkt, sonstiges), auch als Teilmenge,
  mit „Rückgängig“
- **Archiv:** entnommene Artikel zurücklegen oder endgültig löschen
- **Eigene Vorlagen** anlegen, bearbeiten, löschen; „Als Vorlage speichern“ beim Einlegen
- **Statistik:** Bestand, bald fällig, abgelaufen, Wegwerfquote (90 Tage), Entnahmen pro Monat
  (mit Tabellenansicht), Bestand nach Kategorie, am häufigsten weggeworfen
- **Fotos:** werden auf dem Server verkleinert (1200 px + Vorschaubild), EXIF/GPS wird entfernt;
  nicht mehr benutzte Fotos werden automatisch gelöscht
- Responsive Oberfläche für Handy, Tablet und Desktop; PWA-Manifest
- Betrieb mit Docker Compose; Migrationen und Standard-Vorlagen werden beim Start automatisch angelegt
- Versionsanzeige in den Einstellungen und unter `/api/health`
- CI auf GitHub Actions: Typprüfung, Integrationstests gegen PostgreSQL, Build

[Unveröffentlicht]: https://github.com/n-km/project-fridge-system/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/n-km/project-fridge-system/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/n-km/project-fridge-system/releases/tag/v1.0.0
