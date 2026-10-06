# Echo Web Unlocker – Spezifikation

Ein Browser-Tool (ähnlich ESP Web Tools / GrapheneOS Web Installer), das die Unlock-/Root-/TWRP-/Unbrick-Prozeduren für vier Amazon-Echo-Geräte ohne lokale Installation (kein Python, kein ADB/Fastboot, keine Treiber unter macOS/Linux) per **WebUSB** und **WebSerial** ausführt.

Stand: 06.10.2026 – basiert auf den XDA-Threads von Rortiz2 / bengris32 und den Quell-Repos von R0rt1z2.

---

## 1. Ziel & Abgrenzung

**Ziel**
- Geführter Assistent: Gerät wählen → Modus herstellen → Exploit → TWRP → FireOS flashen → optional Root.
- Läuft in Chrome/Edge (Desktop) unter macOS, Linux, Windows, ChromeOS.
- Bildet die bestehenden Shell-/Python-Skripte 1:1 nach – **keine neuen Exploits**, keine Änderungen an den Payloads.

**Nicht im Umfang**
- Hardware-Vorbereitung (Löten, Testpunkt, Pogo-Jig) – nur Anleitung mit Bildern.
- Hosten von FireOS-Images (der Nutzer lädt sie selbst von FTVDB und wählt die Datei aus).
- Firefox/Safari (kein WebUSB/WebSerial).
- Flashen kritischer Partitionen (preloader, lk_a/lk_b, tee1, tz) – wird aktiv blockiert.

---

## 2. Unterstützte Geräte

| Codename | Gerät | Modell | SoC | Exploit | Paket | Wege |
|---|---|---|---|---|---|---|
| `biscuit` | Echo Dot 2. Gen (2016) | RS03QR | MT8163 | amonet | `amonet-biscuit-v2.0.0` | A: fastbrick · B: BROM (Testpunkt) |
| `radar` | Echo 2. Gen (2017) | XC56PY | MT8163 | amonet | `amonet-radar-v1.0.0` | A: fastbrick · B: BROM (Testpunkt) – USB nur über gelötete D+/D-/GND-Pads |
| `cupcake` | Echo Input (2018) | C1125P | MT8516 | kamakiri | `kamakiri-cupcake-v1.0.0` | nur BROM (Uber-Taste beim Einstecken) |
| `donut` | Echo Dot 3. Gen (2018) | D9N29T | MT8516 | kamakiri | `kamakiri-donut-v1.0.0` | nur BROM (Uber-Taste) – USB nur über versteckte Pads |

> ⚠️ `donut` ≠ `crumpet` (Echo Dot 3 Refresh, C78MP8) – muss in der UI explizit ausgeschlossen werden.

Quellen:
- https://github.com/R0rt1z2/amonet/tree/mt8163-biscuit
- https://github.com/R0rt1z2/amonet/tree/mt8163-radar
- https://github.com/R0rt1z2/kamakiri/tree/mt8516-cupcake
- https://github.com/R0rt1z2/kamakiri/tree/mt8516-donut
- https://github.com/R0rt1z2/kaeru · https://github.com/amazon-oss/android_bootable_recovery

---

## 3. Technische Bausteine

| Aufgabe | Browser-API | Bibliothek (Vorschlag) |
|---|---|---|
| Fastboot (getvar, flash, reboot) | WebUSB | `android-fastboot` (kdrag0n, genutzt vom GrapheneOS Web Installer) |
| ADB (push, shell, reboot) | WebUSB | `@yume-chan/adb` + `@yume-chan/adb-daemon-webusb` (Tango / ya-webadb) |
| amonet BROM (MT8163) | WebSerial (115200 Baud) | eigene Portierung von `modules/*.py` |
| kamakiri BROM (MT8516) | WebUSB (Control-Transfers) | eigene Portierung von `modules/*.py` |
| ZIP-Handling (Pakete, Firmware) | – | `fflate` / `zip.js` |

**USB-IDs**
- MediaTek BROM: `0e8d:0003` · Preloader: `0e8d:2000`
- Fastboot / ADB: Amazon/Lab126 `1949:*` – genaue PIDs pro Gerät beim Testen erfassen und in `requestDevice`-Filter eintragen.

**Stack**: Vite + TypeScript, statisch hostbar (GitHub Pages / Cloudflare Pages), HTTPS Pflicht (WebUSB). Kein Backend.

---

## 4. Ablauf im Tool (UI-Flow)

1. **Start / Disclaimer** – Risiko-Hinweis, Checkbox „Ich habe verstanden“, Browser-Check (`navigator.usb`, `navigator.serial`).
2. **Gerät wählen** – Karten mit Foto, Modellnummer (Unterseite des Geräts), Ausschluss `crumpet`.
3. **Weg wählen** (nur biscuit/radar) – „Gerät startet / Fastboot erreichbar“ → Weg A, sonst Weg B.
4. **Vorbereitung** – Gerätespezifische Anleitung mit Bildern (Pads, Testpunkt, Tasten). Bei Linux Hinweis auf ModemManager, bei Windows Treiber-Hinweis.
5. **Exploit** – Live-Log, Fortschritt, LED-Erklärung („grün = Fastboot“, „Regenbogen = gehackter Fastboot“, „weiß = TWRP“).
6. **TWRP installieren** (nur Weg B / kamakiri).
7. **FireOS flashen** – Datei-Auswahl (`.bin` von FTVDB), Prüfung Dateiname enthält Codename + „NS6…“ (FireOS 6), Flash in beide Slots.
8. **Optional: Root** – `boot-root.zip` flashen.
9. **Fertig** – Zusammenfassung, Hinweis auf Tastenkombis (Vol− = Fastboot, Vol+ = TWRP, MUTE = USBDL).

Zusätzlich ein **Werkzeug-Tab** für bereits entsperrte Geräte: In TWRP booten, In Fastboot booten, FireOS flashen, Root flashen, Werksreset (`twrp wipe data`), Slot anzeigen/wechseln.

---

## 5. Umsetzung je Schritt (was der Code genau tun muss)

### 5.1 Weg A – amonet-fastbrick (biscuit, radar)

Nachbau von `fastbrick.sh` + `fastbrick/<device>/profile.sh`:

```
1. Fastboot-Gerät verbinden (WebUSB requestDevice)
2. getvar product        → muss "BISCUIT" bzw. "RADAR" sein, sonst Abbruch
3. getvar unlock_status  → "true" ⇒ bereits entsperrt, Abbruch mit Hinweis
4. getvar lk_build_desc  → Payload wählen:
      biscuit: "63cb91b-20221007_072309*" → fastbrick-20221007.img, sonst fastbrick.img
      radar:   "59779ca-20220524_183401*" → fastbrick-20220524.img, sonst fastbrick.img
5. Bestätigung: Nutzer tippt "YES"
6. Schleife:
      flash "brick" <payload>   mit 8 s Timeout
      - Antwort enthält "eMMC-RO"         → Abbruch: eMMC defekt (Hardware), boots=N anzeigen
      - Antwort enthält "Device mismatch" → Abbruch: falsches Gerät/Payload
      - Timeout                          → ERFOLG ("Exploit most likely successful")
      - sonst 2 s warten, erneut versuchen
7. Hinweis: NICHT trennen, bis zu 1 min warten, LED wird grün → bootet in TWRP (weiß)
```

Akzeptanz: Timeout gilt als Erfolg – die Fastboot-Lib muss einen Timeout sauber abbrechen können, ohne zu werfen/hängen.

### 5.2 Weg B – amonet BROM (biscuit, radar)

Portierung von `modules/main.py`, `common.py`, `handshake*.py`, `load_payload.py`, `gpt.py` nach TS über **WebSerial**:

- Port-Filter `{usbVendorId: 0x0e8d}`, 115200 Baud, Timeout 5 s.
- Modus über PID unterscheiden (`0x0003` BROM, `0x2000` Preloader).
- Handshake, Upload `brom-payload/build/payload.bin` + `pl.bin`, Schreiben von `preloader.img`, `lk.bin`, `tz.img`, `tee-payload.bin`, `<device>-kaeru.bin` exakt wie im Python-Original (Reihenfolge, Offsets, GPT-Handling).
- UI: „Testpunkt jetzt mit GND kurzschließen + USB einstecken“ → Script meldet „loslassen“ → Nutzer klickt „Weiter“.
- Danach bootet das Gerät in gehackten Fastboot (Regenbogen) → **5.4**.

Hinweis: WebSerial erfordert eine Nutzer-Geste für `requestPort()`. Da das BROM-Fenster kurz ist, muss vorher per `getPorts()` / `connect`-Event auf das Auftauchen von `0e8d:0003` gewartet werden (Port einmalig vorab genehmigen lassen).

### 5.3 kamakiri BROM (cupcake, donut)

Portierung von `modules/main.py`, `common.py`, `device.py`, `load_payload.py`, `check_sig.py` nach TS über **WebUSB**:

- Gerät `0e8d:0003`, Interfaces 0 + 1 claimen.
- Exploit nutzt präparierte Control-Transfers:
  - `controlTransferOut({requestType:'class', recipient:'interface', request:0x20 /*SET_LINE_CODING*/, value:0, index:0}, linecode + addr)`
  - `controlTransferIn({requestType:'standard', recipient:'device', request:0x06 /*GET_DESCRIPTOR*/, value:0x0200, index:0}, 9)`
  - erwartete USB-Fehler (Stall) müssen wie im Python-Code toleriert werden.
- Upload `stage1.bin`, `stage2.bin`, danach Payload-/Partitions-Schritte wie im Original.
- UI: „Uber-Taste (○) gedrückt halten und USB einstecken“.

**Risiko / offen**: Das BROM ist ein CDC-ACM-Gerät. Wenn das OS den CDC-Treiber bindet, schlägt `claimInterface` fehl:
- macOS: vermutlich OK – testen.
- Linux: `cdc_acm` bindet → evtl. udev-Regel / `unbind` nötig – testen, Workaround dokumentieren.
- Windows: WinUSB per Zadig für `0e8d:0003` nötig – Anleitung im Tool.

### 5.4 Fastboot-Step (alle Geräte nach BROM)

Nachbau von `fastboot-step.sh`:

```
flash recovery bin/twrp.img            (amonet)
flash recovery bin/twrp-cupcake.img    (kamakiri – laut Repo auch für donut, prüfen!)
reboot recovery
```

Recovery wird von kaeru intern auf die `swdl`-Partition umgemappt – Tool sendet nur `recovery`.

### 5.5 FireOS flashen (alle Geräte, in TWRP per ADB)

```
shell: twrp wipe cache
shell: twrp wipe data
push  <firmware.bin> → /sdcard/update.zip       (Fortschrittsbalken, Dateien ~300–500 MB)
shell: twrp install /sdcard/update.zip           (Exit-Code/Output prüfen)
shell: s=$(bcbtool get_active); case $s in a) bcbtool set_active b;; b) bcbtool set_active a;; *) echo "unexpected: $s";; esac
reboot recovery  → auf ADB-Reconnect warten (WebUSB-Gerät neu wählen / getDevices)
shell: twrp install /sdcard/update.zip
```

Validierungen vor dem Flash:
- Dateiname enthält `kindle-<codename>` (bei biscuit/radar/donut `<codename>_puffin`) → sonst Warnung/Block.
- biscuit/radar: nur FireOS 6 (`NS6…`) zulassen.
- Nur **Full**-Updates (keine Incrementals).

### 5.6 Root (optional)

```
push boot-root.zip → /sdcard/boot-root.zip
shell: twrp install /sdcard/boot-root.zip
reboot
```
Hinweis anzeigen: Falls ADB danach nicht erscheint → Stromkabel kurz trennen.

---

## 6. Sicherheitsregeln im Code

- **Blockliste** für Fastboot-`flash`/`erase` im Werkzeug-Tab: `preloader`, `lk`, `lk_a`, `lk_b`, `tee1`, `tee2`, `tz`, `expdb`, `swdl` (ausgenommen intern genutzte Befehle aus 5.1/5.4).
- Gerätecheck (`getvar product` bzw. `getprop ro.product.device`) vor **jedem** schreibenden Schritt.
- Kein Abbruch-Button nach Beginn der kritischen Phase; `beforeunload`-Warnung während Exploit/Flash.
- Payload-Dateien per SHA-256 gegen Manifest prüfen.
- Klare Fehlertexte aus den Original-Skripten übernehmen (eMMC-RO, Device mismatch).

---

## 7. Payloads & Lizenz

- Release-ZIPs (`amonet-*`, `kamakiri-*`, `boot-root.zip`) **nicht** ungefragt rehosten → zuerst Rortiz2 / bengris32 kontaktieren und Erlaubnis bzw. offizielle Download-URL klären.
- Alternative ohne Rehosting: Nutzer wählt das heruntergeladene Release-ZIP im Tool aus, das Tool entpackt es im Browser und liest `bin/*`, `brom-payload/*`, `profile.sh`.
- Code des Tools unter GPL-2.0 (amonet ist GPL2/MIT), Credits an k4y0z, xyz`, Rortiz2, bengris32 sichtbar im Tool.
- `manifest.json` pro Gerät: Paketversion, erwartete Dateien, SHA-256, Fastbrick-Image-Map.

---

## 8. Projektstruktur (Vorschlag)

```
echo-web-unlocker/
├─ src/
│  ├─ devices/            biscuit.ts radar.ts cupcake.ts donut.ts  (Metadaten, Image-Map, Bilder)
│  ├─ transport/          fastboot.ts adb.ts serial.ts usb.ts
│  ├─ exploits/
│  │  ├─ fastbrick.ts     (5.1)
│  │  ├─ amonet-brom/     (5.2 – Portierung Python)
│  │  └─ kamakiri-brom/   (5.3 – Portierung Python)
│  ├─ steps/              twrp.ts firmware.ts root.ts
│  ├─ ui/                 Wizard, Log-Konsole, LED-Hilfe
│  └─ package-loader.ts   ZIP einlesen + Manifest prüfen
├─ public/img/            Pad-/Testpunkt-Fotos (eigene Fotos!)
└─ manifests/*.json
```

---

## 9. Phasen & Meilensteine

| Phase | Inhalt | Ergebnis / Abnahme |
|---|---|---|
| **0 – Recherche** | USB-PIDs je Modus erfassen, ADB/Fastboot unter macOS/Linux/Windows per WebUSB testen, Autoren anschreiben | Tabelle der IDs, Go/No-Go je Plattform |
| **1 – Fastboot + ADB** | 5.1 Fastbrick, 5.4, 5.5, 5.6, Werkzeug-Tab | biscuit/radar komplett aus dem Browser entsperrt + FireOS + Root; TWRP-Werkzeuge für alle 4 |
| **2 – amonet BROM** | 5.2 per WebSerial | gebrickter biscuit/radar per Testpunkt wiederbelebt |
| **3 – kamakiri BROM** | 5.3 per WebUSB | cupcake/donut aus dem Browser entsperrt (je Plattform dokumentiert) |
| **4 – Feinschliff** | Bilder, i18n (DE/EN), Fehlertexte, Telemetrie-frei | Release |

---

## 10. Testplan

- Testgeräte: mind. 1× pro Codename, ideal je 2 (einer als „Opfer“).
- Jede Phase auf macOS, Linux (Ubuntu, mit/ohne ModemManager) und Windows 11 testen.
- Vergleich: Log-Ausgabe Tool vs. Original-Skript (gleiche Schritte, gleiche Byte-Mengen).
- Fehlerfälle: falsches Gerät, bereits entsperrt, USB-Abbruch vor/nach Grace-Period, falsche Firmware-Datei, Incremental-Update, ADB verschwindet nach Reboot.
- UART-Mitschnitt (biscuit/radar: Pad C7, donut: TM59) beim Debuggen der BROM-Portierung.

---

## 11. Offene Fragen

1. Erlaubnis der Autoren zum Rehosten / Einbinden der Payloads?
2. Ist `twrp-cupcake.img` im donut-Paket wirklich korrekt (Repo-Script verweist darauf)?
3. Lässt sich das MT8516-BROM unter Linux/macOS ohne Treiber-Umweg per WebUSB claimen?
4. Reicht die JS-Latenz für das Timing des kamakiri-Exploits?
5. Exakte Fastboot-/ADB-USB-PIDs pro Gerät.
6. Radar-Thread: Unstimmigkeiten („Echo Dot“, „ab v2.0“, „Screen“) mit Autor klären.
