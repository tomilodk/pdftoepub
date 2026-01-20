const { useState, useCallback, useRef } = React;

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// EPUB Generator Class
class EPUBGenerator {
  constructor(options = {}) {
    this.title = options.title || 'Untitled';
    this.author = options.author || 'Unknown';
    this.language = options.language || 'en';
    this.uuid = this.generateUUID();
    this.pages = [];
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  addPage(imageData, width, height, pageNum) {
    this.pages.push({ imageData, width, height, pageNum });
  }

  getMimetype() {
    return 'application/epub+zip';
  }

  getContainer() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  getContentOPF() {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const maxWidth = Math.max(...this.pages.map(p => p.width));
    const maxHeight = Math.max(...this.pages.map(p => p.height));

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

  getNCX() {
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

  getNav() {
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

  getCSS() {
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

  getPageXHTML(pageNum, width, height) {
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

  escapeXML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async generate() {
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
      zip.file(`OEBPS/xhtml/page_${num}.xhtml`, this.getPageXHTML(page.pageNum, page.width, page.height));

      // Convert data URL to blob
      const imageData = page.imageData.split(',')[1];
      zip.file(`OEBPS/images/page_${num}.png`, imageData, { base64: true });
    }

    return await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  }
}

// Main App Component
function App() {
  const [file, setFile] = useState(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [metadata, setMetadata] = useState({ title: '', author: '', language: 'en' });
  const [previewPages, setPreviewPages] = useState([]);
  const [dpi, setDpi] = useState(150);
  const fileInputRef = useRef(null);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer?.files[0] || e.target.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setMetadata(prev => ({
        ...prev,
        title: droppedFile.name.replace('.pdf', '')
      }));
      loadPreview(droppedFile);
    }
  }, []);

  const loadPreview = async (pdfFile) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const previews = [];

    for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
      const page = await pdf.getPage(i);
      const scale = 0.3;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise;

      previews.push(canvas.toDataURL('image/jpeg', 0.7));
    }

    setPreviewPages(previews);
    setProgress(prev => ({ ...prev, total: pdf.numPages }));
  };

  const convertToEPUB = async () => {
    if (!file) return;

    setConverting(true);
    setProgress({ current: 0, total: 0, status: 'Loading PDF...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      setProgress({ current: 0, total: totalPages, status: 'Preparing...' });

      const epub = new EPUBGenerator({
        title: metadata.title || file.name.replace('.pdf', ''),
        author: metadata.author || 'Unknown',
        language: metadata.language || 'en'
      });

      const scale = dpi / 72; // PDF is 72 DPI by default

      for (let i = 1; i <= totalPages; i++) {
        setProgress({ current: i, total: totalPages, status: `Converting page ${i} of ${totalPages}...` });

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport
        }).promise;

        const imageData = canvas.toDataURL('image/png');
        epub.addPage(imageData, Math.round(viewport.width), Math.round(viewport.height), i);
      }

      setProgress({ current: totalPages, total: totalPages, status: 'Generating EPUB...' });

      const epubBlob = await epub.generate();

      // Download
      const url = URL.createObjectURL(epubBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.title || 'converted'}.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress({ current: totalPages, total: totalPages, status: 'Complete!' });
    } catch (error) {
      console.error('Conversion error:', error);
      setProgress({ current: 0, total: 0, status: `Error: ${error.message}` });
    } finally {
      setConverting(false);
    }
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '0.5rem',
          background: 'linear-gradient(90deg, #e94560, #0f3460)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          PDF to EPUB Converter
        </h1>
        <p style={{ color: '#888', fontSize: '1.1rem' }}>
          Convert PDF files to fixed-layout EPUB — entirely in your browser
        </p>
      </header>

      {/* Drop Zone */}
      <div
        onDrop={handleFileDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #e94560',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'rgba(233, 69, 96, 0.05)',
          transition: 'all 0.3s ease',
          marginBottom: '2rem'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileDrop}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
        {file ? (
          <div>
            <p style={{ fontSize: '1.2rem', color: '#e94560' }}>{file.name}</p>
            <p style={{ color: '#888' }}>{(file.size / 1024 / 1024).toFixed(2)} MB • {progress.total} pages</p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '1.2rem' }}>Drop PDF here or click to select</p>
            <p style={{ color: '#888', marginTop: '0.5rem' }}>Supports any PDF file</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {previewPages.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#e94560' }}>Preview</h3>
          <div style={{
            display: 'flex',
            gap: '1rem',
            overflowX: 'auto',
            padding: '0.5rem'
          }}>
            {previewPages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Page ${i + 1}`}
                style={{
                  height: '200px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              />
            ))}
            {progress.total > 4 && (
              <div style={{
                height: '200px',
                minWidth: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#888'
              }}>
                +{progress.total - 4} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata Form */}
      {file && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#e94560' }}>Book Details</h3>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>Title</label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#1a1a2e',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>Author</label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => setMetadata(prev => ({ ...prev, author: e.target.value }))}
                placeholder="Unknown"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#1a1a2e',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>Language</label>
              <select
                value={metadata.language}
                onChange={(e) => setMetadata(prev => ({ ...prev, language: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#1a1a2e',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              >
                <option value="en">English</option>
                <option value="ru">Russian</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="ar">Arabic</option>
                <option value="pt">Portuguese</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>Quality (DPI)</label>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#1a1a2e',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              >
                <option value="72">72 DPI (Fast, smaller file)</option>
                <option value="150">150 DPI (Balanced)</option>
                <option value="300">300 DPI (High quality)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {converting && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            overflow: 'hidden',
            height: '8px',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #e94560, #0f3460)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p style={{ color: '#888', textAlign: 'center' }}>{progress.status}</p>
        </div>
      )}

      {/* Convert Button */}
      <button
        onClick={convertToEPUB}
        disabled={!file || converting}
        style={{
          width: '100%',
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          color: '#fff',
          background: !file || converting
            ? '#333'
            : 'linear-gradient(90deg, #e94560, #0f3460)',
          border: 'none',
          borderRadius: '12px',
          cursor: !file || converting ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: !file || converting ? 'none' : '0 4px 15px rgba(233, 69, 96, 0.4)'
        }}
      >
        {converting ? 'Converting...' : 'Convert to EPUB'}
      </button>

      {/* Info */}
      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        color: '#666'
      }}>
        <h4 style={{ color: '#888', marginBottom: '0.5rem' }}>How it works</h4>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
          This converter runs entirely in your browser — your PDF never leaves your device.
          Each page is rendered as a high-quality image and packaged into a fixed-layout EPUB3 file,
          preserving the exact design of your original PDF. The output is compatible with most
          e-readers including Kindle (via Calibre or Send to Kindle).
        </p>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
