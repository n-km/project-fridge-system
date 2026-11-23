# Changelog

Alle nennenswerten Änderungen an PFS werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionsnummern folgen [Semantic Versioning](https://semver.org/lang/de/):

- **MAJOR** (`2.0.0`) – Änderungen, nach denen etwas Bestehendes nicht mehr wie vorher funktioniert
  (z. B. API-Umbau, manuelle Schritte beim Update nötig)
- **MINOR** (`1.1.0`) – neue Funktionen, abwärtskompatibel; Datenbank-Migrationen laufen automatisch
- **PATCH** (`1.0.1`) – Fehlerbehebungen

## [Unveröffentlicht]

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

[Unveröffentlicht]: https://github.com/n-km/project-fridge-system/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/n-km/project-fridge-system/releases/tag/v1.0.0
