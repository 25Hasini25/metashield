# MetaShield

A zero-backend Chrome extension (Manifest V3) that acts as a pre-flight privacy check for file uploads.
When you pick a photo on any website, MetaShield pauses the upload, reads the hidden metadata locally,
explains the privacy risk in plain English, and lets you cancel, upload the original, or strip the metadata
and upload a clean copy.

Nothing leaves your device: no servers, no analytics, no map tiles.

## Features
- Detects GPS location, GPS altitude, device make/model, capture time, author, editing software and serial number
- Risk score (0-100) with severity tags and a plain-English explanation for each finding
- Offline Bengaluru map with the exact pin, plus an altitude graphic
- One-click "Strip metadata & upload clean" using the `DataTransfer` API

## Run it
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
5. Open `demo/portal.html` (or any website with an upload button) and choose a geotagged JPEG.
   To use local files such as `portal.html`, open the extension's **Details** and enable **Allow access to file URLs**.

`demo/standalone-demo.html` is a self-contained demo that works without installing the extension.

## Project structure
| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest; injects the scripts on all pages at `document_start` |
| `content.js` | EXIF parser, risk scoring, Shadow-DOM popup, strip + file swap |
| `bengaluru-map.js` | Offline vector map of Bengaluru (no network) |
| `demo/portal.html` | Plain upload page for testing the extension |
| `demo/standalone-demo.html` | Demo page with the popup built in |

## Limitations
- Only JPEG EXIF is scanned. PNG, HEIC, PDF and DOCX are not handled yet.
- Drag-and-drop and paste uploads are not intercepted (file pickers only).
- Stripping re-encodes the image through a canvas (quality 0.92).
- The map is an approximate offline drawing of Bengaluru only. For street-level accuracy, bundle an
  OpenStreetMap vector-tile extract (for example PMTiles) in the extension and render it locally with MapLibre.
- Fonts fall back to system fonts unless you bundle font files with the extension.

## Roadmap
HEIC and PNG support, PDF/DOCX metadata, drag-and-drop interception, bundled street-level offline map, extension icons.

## License
MIT
