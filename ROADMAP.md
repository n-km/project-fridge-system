# Roadmap

Geplante Weiterentwicklung von PFS. Jede Stufe wird als eigene, stabile Version veröffentlicht
(siehe [CHANGELOG](CHANGELOG.md) und [Semantic Versioning](README.md#versionen--releases)).

**Stand:** v1.1.0 fertig, v1.0.0 veröffentlicht (23.11.2026)

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
| **1.1.0** | Politur, Einstellungen, Geräte-Editor, erweiterter Modus (2,5D, Raster, Platzieren) | ✅ fertig |
| **1.2.0** | Extras für den erweiterten Modus | Ideen |

Ursprünglich waren die Inhalte von 1.1.0 auf die Versionen 1.1.0 bis 1.5.0 verteilt;
sie wurden auf Wunsch gemeinsam in 1.1.0 umgesetzt (Details im [CHANGELOG](CHANGELOG.md)).

### Umgesetzt in 1.1.0

- [x] Hover-, Fokus- und Druckzustände, Tür-Öffnen-Übergang, Wischgesten, Ladeplatzhalter, dunkles Design,
  „Bewegung reduzieren“
- [x] Einstellungen für Haushalt (Kategorien, Einheiten, Bald-fällig-Schwelle) und Benutzer
  (Design, Dichte, Startseite, Standardgerät, Darstellung, erweiterter Modus)
- [x] Geräte-Editor mit Bauform-Vorlagen, Fach-Arten, Gefrierbereich, Raster und Stapelhöhe
- [x] 2,5D-Ansicht: Tür/Deckel öffnen, Schubladen herausziehen, Türfächer, Truhe von oben, Ampel, Suche
- [x] Platzieren im Raster: Ziehen & Ablegen (Maus, Touch, Tastatur), Größe ändern, Stapeln,
  Kollisionsprüfung, „Alle einsortieren“, Platzwahl beim Einlegen

**Abweichung vom Plan:** Statt `@dnd-kit` nutzt das Ziehen eine eigene, kleine Lösung mit
`document.elementsFromPoint`. Sie funktioniert zuverlässig auf den perspektivisch gekippten Flächen und
braucht keine zusätzliche Abhängigkeit.

## 1.2.0 – Extras (Ideen, noch nicht festgelegt)

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
