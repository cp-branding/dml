# Marketing-Kurs · Deployment Guide

## Was drin ist

```
/
├── api/
│   ├── chat.js       ← Anthropic API Proxy (Key bleibt serverseitig)
│   ├── login.js      ← Login mit Kurs-Passwort
│   ├── logout.js     ← Session löschen
│   └── auth.js       ← Session prüfen
├── public/
│   ├── marketing-kurs-komplett.html  ← Hauptapp (geschützt)
│   ├── problem-kompass.html          ← Kompass (standalone, geschützt)
│   └── login.html                   ← Login-Seite (öffentlich)
├── vercel.json       ← Routing: ohne Cookie → /login
├── .env.example      ← Vorlage für Umgebungsvariablen
└── .gitignore
```

---

## Deploy in 5 Schritten

### 1. GitHub Repo anlegen

- Geh zu [github.com/new](https://github.com/new)
- Name z.B. `marketing-kurs`
- Private Repository (empfohlen)
- Alle Dateien aus diesem Ordner hochladen (oder `git push`)

### 2. Vercel verbinden

- Geh zu [vercel.com](https://vercel.com) → New Project
- GitHub Repo auswählen → Import
- **Framework Preset:** Other
- **Root Directory:** `.` (Wurzel des Repos)
- Noch nicht deployen — erst Schritt 3

### 3. Environment Variables in Vercel eintragen

Unter **Settings → Environment Variables** diese eintragen:

| Name | Wert |
|------|------|
| `ANTHROPIC_API_KEY` | Dein Key von console.anthropic.com |
| `USERS` | JSON-Array mit Nutzern (siehe unten) |
| `SESSION_SECRET` | Ein langer zufälliger String* |

*Session Secret generieren: einfach [zufallsgenerator.de](https://zufallsgenerator.de) oder im Terminal: `openssl rand -hex 32`

**USERS-Format:**
```json
[
  {"email": "max@beispiel.de",  "password": "geheim123"},
  {"email": "anna@firma.de",    "password": "sicher456"}
]
```
Alles in eine Zeile, als Wert der Env Var `USERS` eintragen.

---

## Nutzer verwalten

**Neuen Nutzer hinzufügen:**
1. Vercel → Projekt → Settings → Environment Variables
2. `USERS` anklicken → bearbeiten
3. Neues Objekt in den Array einfügen: `{"email": "neu@beispiel.de", "password": "passwort"}`
4. Speichern → Vercel deployt automatisch neu (~30 Sekunden)

**Nutzer entfernen:**
Einfach das entsprechende Objekt aus dem Array löschen → speichern.

**Passwort ändern:**
Den `password`-Wert des Nutzers anpassen → speichern.

Kein Code-Änderung, kein Git-Push — nur Env Var editieren.

### 4. Deploy

- Auf **Deploy** klicken
- Vercel baut das Projekt (~30 Sekunden)
- Du bekommst eine URL wie `marketing-kurs-xyz.vercel.app`

### 5. Testen

- URL öffnen → Login-Seite erscheint
- Kurs-Passwort eingeben → Kurs öffnet sich
- Modul anklicken → Claude antwortet ✓

---

## Eigene Domain

In Vercel unter **Settings → Domains** kannst du eine eigene Domain wie `kurs.deine-domain.de` eintragen. Vercel gibt dir die DNS-Einträge die du bei deinem Domain-Anbieter setzen musst.

---

## Passwort ändern

Einfach in Vercel unter **Settings → Environment Variables** den Wert von `COURSE_PASSWORD` ändern → Redeploy.

---

## Kosten

- Vercel Free Tier: kostenlos für bis zu 100GB Bandwidth/Monat — reicht für hunderte Teilnehmer
- Anthropic API: ca. 0,003€ pro Modul-Session (claude-sonnet-4)
