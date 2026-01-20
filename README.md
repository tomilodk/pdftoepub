# PDF to EPUB Converter

Convert PDF files to fixed-layout EPUB format. Includes both a **browser-based web app** and a **Node.js CLI tool**.

## Features

- 🖼️ Preserves exact PDF layout as high-quality images
- 📱 Creates fixed-layout EPUB3 compatible with most e-readers
- 🌐 Browser version runs entirely client-side (no server uploads)
- 🔧 Node.js version for batch processing and automation
- 📖 Supports custom metadata (title, author, language)
- ⚡ Configurable DPI (72, 150, or 300)

---

## Option 1: Browser-Based Web App

### Quick Start

Simply open `index.html` in any modern browser. No installation required!

### Features

- Drag & drop PDF files
- Preview pages before conversion
- Set book title, author, and language
- Choose output quality (DPI)
- Download EPUB directly

### Hosting

To host the web app, simply upload `index.html` to any static hosting service:

- GitHub Pages
- Netlify
- Vercel
- Any web server

```bash
# Example: serve locally with Python
python -m http.server 8000
# Then open http://localhost:8000
```

---

## Option 2: Node.js CLI Tool

### Installation

```bash
# Clone or download this folder, then:
cd pdf-to-epub
npm install
```

### Requirements

- Node.js 18+
- For the `canvas` package, you may need system dependencies:

**Ubuntu/Debian:**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

**macOS:**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Windows:**
See [node-canvas wiki](https://github.com/Automattic/node-canvas/wiki/Installation:-Windows)

### Usage

```bash
# Basic usage
node pdf-to-epub.js input.pdf output.epub

# With metadata
node pdf-to-epub.js book.pdf book.epub --title "My Book" --author "John Doe"

# High quality (300 DPI)
node pdf-to-epub.js book.pdf book.epub --dpi 300

# Russian language book
node pdf-to-epub.js book.pdf book.epub --language ru --title "Моя Книга"
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--title` | Book title | Filename |
| `--author` | Author name | "Unknown" |
| `--language` | Language code (en, ru, es, etc.) | "en" |
| `--dpi` | Output quality (72, 150, 300) | 150 |

### Using as a Module

```javascript
import { convertPDFToEPUB } from './pdf-to-epub.js';

await convertPDFToEPUB('input.pdf', 'output.epub', {
  title: 'My Book',
  author: 'Author Name',
  language: 'en',
  dpi: 150
});
```

---

## TypeScript Version

A TypeScript version (`pdf-to-epub.ts`) is also included for type-safe development:

```bash
# Install TypeScript dependencies
npm install -D typescript ts-node @types/node

# Run directly with ts-node
npx ts-node pdf-to-epub.ts input.pdf output.epub

# Or compile first
npx tsc pdf-to-epub.ts
node pdf-to-epub.js input.pdf output.epub
```

---

## Output Format

The converter generates **fixed-layout EPUB3** files with:

- Each PDF page rendered as a PNG image
- Full metadata support
- Table of contents (NCX and NAV)
- Compatible with:
  - Amazon Kindle (via Send to Kindle or Calibre)
  - Apple Books
  - Google Play Books
  - Kobo
  - Most EPUB readers

---

## File Structure

```
pdf-to-epub/
├── index.html          # Browser-based web app (standalone)
├── pdf-to-epub.js      # Node.js CLI (JavaScript)
├── pdf-to-epub.ts      # Node.js CLI (TypeScript)
├── package.json        # NPM dependencies
└── README.md           # This file
```

---

## Technical Details

### EPUB Structure Generated

```
book.epub
├── mimetype
├── META-INF/
│   └── container.xml
└── OEBPS/
    ├── content.opf
    ├── toc.ncx
    ├── nav.xhtml
    ├── styles/
    │   └── fixed-layout.css
    ├── xhtml/
    │   ├── page_001.xhtml
    │   ├── page_002.xhtml
    │   └── ...
    └── images/
        ├── page_001.png
        ├── page_002.png
        └── ...
```

### Dependencies

**Browser version:**
- PDF.js (Mozilla)
- JSZip

**Node.js version:**
- pdfjs-dist
- canvas (node-canvas)
- jszip

---

## License

MIT License - feel free to use, modify, and distribute.
