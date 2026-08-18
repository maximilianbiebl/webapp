# Liegestütze – Webversion

Die Webseite zur [Liegestütze-App](https://github.com/maximilianbiebl/Liegestutzen).
Sie benutzt dieselbe Firebase-Datenbank wie die App: Wer sich hier mit
demselben Google-Konto anmeldet, sieht dieselben Gruppen und Freunde — keine
Kopie, dieselben Daten.

Läuft unter **https://maximilianbiebl.github.io/webapp/**

## Inhalt

| Pfad | Zweck |
|---|---|
| `index.html` | Startseite, Download, Code-Eingabe |
| `g/` | Gruppeneinladung |
| `f/` | Freundschaftseinladung |
| `app/` | Die Webversion: Gruppen, Bestenlisten, Direktvergleich |
| `logic.js` | Auswertung von Gruppen und Vergleichen |
| `levels.js` | Die 40 Level — **erzeugt** aus `domain/Levels.kt` der App |
| `stats.js` | Die persönlichen Zahlen: Serie, Summen, Trainingstage |
| `app/training.js` | Der Trainingsbildschirm |
| `logic.test.mjs` | Prüfungen dazu: `node --test logic.test.mjs` |
| `.well-known/assetlinks.json` | Für Android-App-Links, siehe unten |

Die Seite kann inzwischen dasselbe wie die App, mit einer Ausnahme: Gezählt
wird nur durch Tippen — einen Näherungssensor gibt es im Browser nicht, und
eine tägliche Erinnerung kann eine Webseite nicht schicken. Trainieren, Level
wechseln, Ziel setzen, Verlauf, Gruppen, Bestenlisten, Direktvergleich und
Einladungen sind alle da. Was hier trainiert wird, steht auf dem Telefon, und
umgekehrt: dieselbe Datenbank, kein Abgleich zwischen zwei Programmen.

Kein Bauschritt, keine Abhängigkeiten außer dem Firebase-SDK, das direkt von
Google geladen wird. Was hier liegt, ist, was ausgeliefert wird.

Die Datei `.nojekyll` schaltet die Jekyll-Verarbeitung von GitHub Pages ab.
Ohne sie würde `.well-known` nicht ausgeliefert — Jekyll überspringt alles, was
mit einem Punkt beginnt.

## GitHub Pages einschalten

Repository → Settings → Pages → Source: *Deploy from a branch*, Branch: `main`,
Ordner `/ (root)`. Nach ein bis zwei Minuten ist die Seite da.

## Was hier nicht funktioniert

**Einladungslinks öffnen die App nicht automatisch.** Android sucht die Datei
`assetlinks.json` ausschließlich unter `https://<host>/.well-known/`, also an
der *Wurzel* von `maximilianbiebl.github.io`. Diese Wurzel gehört einem
Repository namens `maximilianbiebl.github.io`, nicht diesem hier.

Kaputt ist deswegen nichts: Der Link öffnet den Browser, die Seite zeigt den
Code und bietet an, ihn zu kopieren. Wer die App hat, fügt ihn dort ein.

Zwei Wege, das zu ändern:

1. **Dieses Repository in `maximilianbiebl.github.io` umbenennen.** Dann liegt
   die Seite an der Wurzel, `assetlinks.json` wird gefunden, und Links öffnen
   die App direkt. Die Adresse wird dabei zu
   `https://maximilianbiebl.github.io/`.
2. **Auf Firebase Hosting ausliefern** (`liegestutzen.web.app`), ebenfalls
   kostenlos. Der passende Intent-Filter ist in der App schon vorbereitet.

In beiden Fällen ist in der App nur `Links.BASE` zu ändern.

## Zugangsdaten

`firebase-config.js` enthält den Web-API-Schlüssel des Projekts. Das ist kein
Geheimnis — er steht in jeder Firebase-Web-App offen im Browser und
identifiziert nur das Projekt. Was jemand damit tun darf, entscheiden allein die
Security Rules, die im App-Repository unter `firestore.rules` liegen.

Sinnvoll ist trotzdem, den Schlüssel in der Google-Cloud-Konsole auf die eigene
Domain zu beschränken (APIs & Dienste → Anmeldedaten → HTTP-Verweis-URLs). Das
schützt keine Daten, hält aber fremde Seiten davon ab, das Kontingent des
Projekts zu verbrauchen.
