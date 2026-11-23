# Roadmap

Geplante Weiterentwicklung von PFS. Jede Stufe wird als eigene, stabile Version veröffentlicht
(siehe [CHANGELOG](CHANGELOG.md) und [Semantic Versioning](README.md#versionen--releases)).

**Stand:** v1.0.0 veröffentlicht (23.11.2026)

## Leitlinien

- **Die normale Ansicht hat Vorrang.** Sie bleibt minimalistisch und schnell; Verbesserungen machen sie
  lebendiger, nicht voller.
- **Der erweiterte Modus ist eine zusätzliche Ansicht**, kein Ersatz. Er wird in den Einstellungen
  eingeschaltet; die Listenansicht bleibt immer verfügbar.
- **2,5D statt echtem 3D:** perspektivische Darstellung mit CSS-3D-Transformationen. Leicht, flüssig auf
  Handys, schont den Akku, Inhalte bleiben normaler, zugänglicher Text.
- **Platzieren im Raster:** Jedes Fach ist ein Raster aus Zellen; Artikel belegen ganze Zellen.
  Ordentlich, auf Touch-Geräten gut bedienbar, einfach zu speichern.
- **Alles mit sinnvollen Standardwerten.** Wer nichts einstellt, merkt keinen Unterschied.
  Fortgeschrittenes steht hinter „Mehr anzeigen“.
- **Barrierefreiheit:** Jede Aktion geht auch per Tastatur; „Bewegung reduzieren“ wird respektiert.

## Übersicht

| Version | Inhalt | Status |
|---|---|---|
| **1.0.0** | Erste Version | ✅ veröffentlicht |
| **1.1.0** | Politur der normalen Ansicht | geplant |
| **1.2.0** | Einstellungen für Haushalt und Benutzer | geplant |
| **1.3.0** | Geräte-Editor und Raster-Datenmodell | geplant |
| **1.4.0** | Erweiterter Modus: 2,5D-Ansicht | geplant |
| **1.5.0** | Erweiterter Modus: Platzieren im Raster | geplant |
| **1.6.0** | Extras für den erweiterten Modus | Ideen |

---

## 1.1.0 – Politur der normalen Ansicht

Ziel: Die App fühlt sich hochwertiger an, ohne neue Bildschirme oder Schalter.

- [ ] **Hover-, Fokus- und Druckzustände** für alle bedienbaren Elemente
  (Kühlgerät-Türen heben sich leicht an, Zeilen und Kacheln reagieren, Knöpfe geben beim Drücken nach)
- [ ] **Tür-Öffnen-Übergang:** Antippen eines Kühlgeräts dreht die Tür kurz auf und führt in die Geräteansicht
  (View Transitions API, mit Rückfall auf einfaches Überblenden)
- [ ] **Wischgesten** auf Touch-Geräten: Artikel nach links wischen → entnehmen, nach rechts → bearbeiten;
  bleibt per Knopf erreichbar
- [ ] **Ladeplatzhalter** (Skeletons) statt Kreisel für Listen und Türen
- [ ] **Bestätigende Mikro-Animationen:** Artikel gleitet beim Entnehmen aus der Liste, Zähler zählen hoch
- [ ] **Dunkles Design** (folgt der Systemeinstellung)
- [ ] **Bewegung reduzieren** respektieren: alle Animationen abschaltbar über die Systemeinstellung

**Fertig, wenn:** alle Interaktionen sichtbares Feedback geben, Lighthouse-Barrierefreiheit ≥ 95,
keine Animation länger als 250 ms, flüssig (60 fps) auf einem Mittelklasse-Handy.

## 1.2.0 – Einstellungen für Haushalt und Benutzer

Grundlage für „so viel wie möglich anpassbar“.

**Haushalt** (gilt für alle Mitglieder):
- [ ] Eigene Kategorien mit Symbol und Farbe (Standardkategorien ausblendbar)
- [ ] Eigene Einheiten und Entnahmegründe
- [ ] Ab wie vielen Tagen ein Artikel „bald fällig“ ist
- [ ] Standard-Haltbarkeit pro Kategorie, falls keine Vorlage gewählt wurde

**Benutzer** (gilt nur für mich):
- [ ] Erweiterter Modus an/aus (vorbereitet, Inhalt folgt ab 1.4.0)
- [ ] Design: hell / dunkel / automatisch
- [ ] Dichte: komfortabel / kompakt
- [ ] Startseite: Bereiche ein-/ausblenden und sortieren („Muss bald weg“, Kühlgeräte, zuletzt eingelegt …)
- [ ] Standard-Kühlgerät beim Einlegen
- [ ] Darstellung von Artikeln: Foto / Symbol

**Technik:** Tabellen `household_settings` und `user_settings` (JSONB, per zod validiert, mit Standardwerten
im Code); API `GET/PATCH /api/settings/household` und `/api/settings/me`.

## 1.3.0 – Geräte-Editor und Raster-Datenmodell

Kühlgeräte so beschreiben, wie sie wirklich aufgebaut sind. In der normalen Ansicht weiterhin nutzbar
(Fächer erscheinen dort wie bisher als Liste).

- [ ] **Bauform-Vorlagen:** Standard-Kühlschrank, Kühl-Gefrier-Kombi, Side-by-Side, Gefrierschrank mit
  Schubladen, Gefriertruhe mit Körben, Getränke-/Weinkühlschrank
- [ ] **Bereiche:** Ein Gerät kann mehrere Bereiche haben (z. B. Kombi = Kühlteil + Gefrierteil),
  jeder mit eigenem Typ für den MHD-Vorschlag
- [ ] **Fach-Typen:** Glasboden, Schublade, Türfach, Korb, Flaschenablage
- [ ] **Fach-Raster:** Breite × Tiefe in Zellen (z. B. 6 × 3), Höhe in Stufen, maximale Stapelhöhe
- [ ] **Editor:** Fächer per Ziehen sortieren, Größe per Regler, Live-Vorschau
- [ ] Farbe pro Gerät

**Datenmodell (alle neuen Felder optional, bestehende Daten bleiben gültig):**

```
appliance_sections (id, appliance_id, name, type: fridge|freezer, sort_order)
compartments       + section_id, kind: shelf|drawer|door|basket|bottle,
                     grid_cols, grid_rows, height, max_stack
items              + grid_x, grid_y, grid_w, grid_h, stack_level   (null = nicht platziert)
```

Eine Migration legt für jedes bestehende Gerät automatisch einen Bereich an.

## 1.4.0 – Erweiterter Modus: 2,5D-Ansicht

Zum Ansehen und Finden. Platzieren folgt in 1.5.0.

- [ ] **Geschlossene Tür** mit Etikett wie in der normalen Ansicht; Antippen öffnet sie perspektivisch
- [ ] **Innenraum:** Fächer übereinander in leichter Perspektive, Artikel als Kacheln im Raster
  (Foto, Symbol oder Block in Kategoriefarbe)
- [ ] **Schubladen und Körbe herausziehen** (Antippen oder Ziehen); herausgezogen von oben sichtbar
- [ ] **Truhe:** Ansicht von oben, Körbe herausheben
- [ ] **Ampel im Raum:** Abgelaufenes und bald Fälliges ist farbig markiert (mit Symbol, nicht nur Farbe)
- [ ] **„Wo ist das?“:** Treffer der Suche werden im Gerät hervorgehoben, das Fach öffnet sich
- [ ] Artikel ohne Rasterplatz erscheinen in einer Ablage „Noch nicht platziert“
- [ ] Gesamte Ansicht per Tastatur bedienbar; Screenreader lesen Fach für Fach vor

## 1.5.0 – Erweiterter Modus: Platzieren im Raster

- [ ] **Drag & Drop** von Artikeln auf Rasterzellen; Maus, Touch (langes Drücken) und Tastatur (Pfeiltasten)
- [ ] **Größe anpassen:** Ecke ziehen oder Schnellwahl (1 × 1, 2 × 1, 2 × 2 …); Vorlagen merken sich
  die Standardgröße
- [ ] **Stapeln** bis zur maximalen Stapelhöhe des Fachs
- [ ] **Umlagern** zwischen Fächern und Geräten per Ziehen
- [ ] **Kollisionsprüfung** im Backend: belegte Zellen werden abgelehnt, Vorschlag für freien Platz
- [ ] **Beim Einlegen** direkt einen Platz im Raster wählen („Wo ist noch Platz?“)
- [ ] Rückgängig für Verschieben

**Technik:** Drag & Drop mit `@dnd-kit` (barrierefrei, Touch-fähig);
API `PATCH /api/items/:id/placement`.

## 1.6.0 – Extras (Ideen, noch nicht festgelegt)

- **Füllstand** pro Fach und Gerät
- **Wer zuerst rein, kommt zuerst raus:** ältere Artikel werden nach vorne vorgeschlagen
- **Temperaturzonen** als Info (Gemüsefach, Null-Grad-Zone) mit passenden Vorschlägen beim Einlegen
- **Inventur-Modus:** Fach für Fach durchtippen – noch da / weg
- **Zeitreise:** Schieberegler, wie das Gerät zu einem früheren Zeitpunkt gefüllt war

## Später (außerhalb dieser Reihe)

- Push-Benachrichtigungen bei bald fälligen Artikeln
- Barcode-Scan mit Open Food Facts
- QR-Etiketten für Gefrierdosen
- MHD per Texterkennung vom Foto lesen
- Einkaufsliste, Rezeptideen aus bald fälligen Artikeln
- Mehrsprachigkeit
- Anleitung für Betrieb mit HTTPS (Caddy) und Backups
