/**
 * PDF to EPUB Converter
 * 
 * A TypeScript/Node.js script that converts PDF files to fixed-layout EPUB format.
 * 
 * Usage:
 *   npx ts-node pdf-to-epub.ts input.pdf output.epub --title "Book Title" --author "Author Name"
 * 
 * Or compile and run:
 *   tsc pdf-to-epub.ts
 *   node pdf-to-epub.js input.pdf output.epub
 * 
 * Dependencies:
 *   npm install pdfjs-dist canvas jszip commander
 *   npm install -D @types/node
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

// For Node.js, we need to use canvas for rendering
// npm install pdfjs-dist canvas
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

interface EPUBOptions {
  title: string;
  author: string;
  language: string;
  dpi: number;
}

interface PageData {
  imageData: Buffer;
  width: number;
  height: number;
  pageNum: number;
}

class EPUBGenerator {
  private title: string;
  private author: string;
  private language: string;
  private uuid: string;
  private pages: PageData[] = [];

  constructor(options: Partial<EPUBOptions> = {}) {
    this.title = options.title || 'Untitled';
    this.author = options.author || 'Unknown';
    this.language = options.language || 'en';
    this.uuid = this.generateUUID();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  addPage(imageData: Buffer, width: number, height: number, pageNum: number): void {
    this.pages.push({ imageData, width, height, pageNum });
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getMimetype(): string {
    return 'application/epub+zip';
  }

  private getContainer(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  private getContentOPF(): string {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const maxWidth = Math.max(...this.pages.map((p) => p.width));
    const maxHeight = Math.max(...this.pages.map((p) => p.height));

    let manifest = `    <item id="css" href="styles/fixed-layout.css" media-type="text/css"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;

    this.pages.forEach((_, i) => {
      const num = String(i + 1).padStart(3, '0');
      manifest += `    <item id="page${num}" href="xhtml/page_${num}.xhtml" media-type="application/xhtml+xml"/>\n`;
    });

    this.pages.forEach((_, i) => {
      const num = String(i + 1).padStart(3, '0');
      const props = i === 0 ? ' properties="cover-image"' : '';
      manifest += `    <item id="img${num}" href="images/page_${num}.png" media-type="image/png"${props}/>\n`;
    });

    let spine = '';
    this.pages.forEach((_, i) => {
      const num = String(i + 1).padStart(3, '0');
      spine += `    <itemref idref="page${num}" properties="rendition:layout-pre-paginated rendition:spread-none"/>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" prefix="rendition: http://www.idpf.org/vocab/rendition/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">urn:uuid:${this.uuid}</dc:identifier>
    <dc:title>${this.escapeXML(this.title)}</dc:title>
    <dc:language>${this.language}</dc:language>
    <dc:creator>${this.escapeXML(this.author)}</dc:creator>
    <meta property="dcterms:modified">${now}</meta>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:orientation">portrait</meta>
    <meta property="rendition:spread">none</meta>
    <meta name="fixed-layout" content="true"/>
    <meta name="original-resolution" content="${maxWidth}x${maxHeight}"/>
  </metadata>
  
  <manifest>
${manifest}  </manifest>
  
  <spine toc="ncx" page-progression-direction="ltr">
${spine}  </spine>
  
  <guide>
    <reference type="cover" title="Cover" href="xhtml/page_001.xhtml"/>
  </guide>
</package>`;
  }

  private getNCX(): string {
    let navPoints = '';
    this.pages.forEach((_, i) => {
      const num = String(i + 1).padStart(3, '0');
      navPoints += `    <navPoint id="navpoint${i + 1}" playOrder="${i + 1}">
      <navLabel>
        <text>Page ${i + 1}</text>
      </navLabel>
      <content src="xhtml/page_${num}.xhtml"/>
    </navPoint>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${this.uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="${this.pages.length}"/>
    <meta name="dtb:maxPageNumber" content="${this.pages.length}"/>
  </head>
  <docTitle>
    <text>${this.escapeXML(this.title)}</text>
  </docTitle>
  <navMap>
${navPoints}  </navMap>
</ncx>`;
  }

  private getNav(): string {
    let toc = '';
    let pageList = '';
    this.pages.forEach((_, i) => {
      const num = String(i + 1).padStart(3, '0');
      toc += `      <li><a href="xhtml/page_${num}.xhtml">Page ${i + 1}</a></li>\n`;
      pageList += `      <li><a href="xhtml/page_${num}.xhtml">${i + 1}</a></li>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${this.language}">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="styles/fixed-layout.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${toc}    </ol>
  </nav>
  <nav epub:type="page-list">
    <ol>
${pageList}    </ol>
  </nav>
</body>
</html>`;
  }

  private getCSS(): string {
    return `@charset "UTF-8";

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  background-color: #ffffff;
}

.page-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

div.page-container {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
}`;
  }

  private getPageXHTML(pageNum: number, width: number, height: number): string {
    const num = String(pageNum).padStart(3, '0');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${this.language}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=${width}, height=${height}"/>
  <title>Page ${pageNum}</title>
  <link rel="stylesheet" type="text/css" href="../styles/fixed-layout.css"/>
  <style type="text/css">
    html, body {
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <img src="../images/page_${num}.png" alt="Page ${pageNum}" class="page-image"/>
  </div>
</body>
</html>`;
  }

  async generate(): Promise<Buffer> {
    const zip = new JSZip();

    // Add mimetype (must be first and uncompressed)
    zip.file('mimetype', this.getMimetype(), { compression: 'STORE' });

    // Add container
    zip.file('META-INF/container.xml', this.getContainer());

    // Add OEBPS content
    zip.file('OEBPS/content.opf', this.getContentOPF());
    zip.file('OEBPS/toc.ncx', this.getNCX());
    zip.file('OEBPS/nav.xhtml', this.getNav());
    zip.file('OEBPS/styles/fixed-layout.css', this.getCSS());

    // Add pages and images
    for (const page of this.pages) {
      const num = String(page.pageNum).padStart(3, '0');
      zip.file(
        `OEBPS/xhtml/page_${num}.xhtml`,
        this.getPageXHTML(page.pageNum, page.width, page.height)
      );
      zip.file(`OEBPS/images/page_${num}.png`, page.imageData);
    }

    return await zip.generateAsync({ type: 'nodebuffer' });
  }
}

// PDF to EPUB conversion function
async function convertPDFToEPUB(
  inputPath: string,
  outputPath: string,
  options: Partial<EPUBOptions> = {}
): Promise<void> {
  const dpi = options.dpi || 150;
  const scale = dpi / 72;

  console.log(`Loading PDF: ${inputPath}`);
  const pdfData = new Uint8Array(fs.readFileSync(inputPath));
  
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const totalPages = pdf.numPages;
  
  console.log(`Total pages: ${totalPages}`);
  console.log(`Output DPI: ${dpi}`);

  const title = options.title || path.basename(inputPath, '.pdf');
  const epub = new EPUBGenerator({
    title,
    author: options.author || 'Unknown',
    language: options.language || 'en',
  });

  for (let i = 1; i <= totalPages; i++) {
    process.stdout.write(`\rConverting page ${i}/${totalPages}...`);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Render the page
    await page.render({
      canvasContext: context as any,
      viewport,
    }).promise;

    // Get PNG buffer
    const pngBuffer = canvas.toBuffer('image/png');
    epub.addPage(pngBuffer, Math.round(viewport.width), Math.round(viewport.height), i);
  }

  console.log('\nGenerating EPUB...');
  const epubBuffer = await epub.generate();

  fs.writeFileSync(outputPath, epubBuffer);
  console.log(`EPUB saved to: ${outputPath}`);
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
PDF to EPUB Converter

Usage:
  npx ts-node pdf-to-epub.ts <input.pdf> <output.epub> [options]

Options:
  --title "Book Title"    Set the book title
  --author "Author Name"  Set the author name
  --language en           Set the language code (default: en)
  --dpi 150              Set output DPI (72, 150, or 300)

Examples:
  npx ts-node pdf-to-epub.ts book.pdf book.epub
  npx ts-node pdf-to-epub.ts book.pdf book.epub --title "My Book" --author "John Doe"
  npx ts-node pdf-to-epub.ts book.pdf book.epub --dpi 300 --language ru
`);
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];
  
  const options: Partial<EPUBOptions> = {};
  
  for (let i = 2; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--title':
        options.title = value;
        break;
      case '--author':
        options.author = value;
        break;
      case '--language':
        options.language = value;
        break;
      case '--dpi':
        options.dpi = parseInt(value, 10);
        break;
    }
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  try {
    await convertPDFToEPUB(inputPath, outputPath, options);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Export for use as a module
export { convertPDFToEPUB, EPUBGenerator, EPUBOptions };

// Run CLI if executed directly
main().catch(console.error);
