// content.js - Scans the page for document links
if (!window._fileGrabLoaded) {
  window._fileGrabLoaded = true;

  const FILE_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    'rtf', 'txt', 'csv', 'tsv', 'epub', 'mobi', 'azw3'
  ];

  const EXT_PATTERN = new RegExp('\\.(' + FILE_EXTENSIONS.join('|') + ')(\\?|#|$)', 'i');

  function getFileExtension(url) {
    const match = url.match(/\.([a-z0-9]+)(\?|#|$)/i);
    if (match && FILE_EXTENSIONS.includes(match[1].toLowerCase())) {
      return match[1].toLowerCase();
    }
    return null;
  }

  function getFileCategory(ext) {
    if (!ext) return 'document';
    if (['pdf', 'doc', 'docx', 'rtf', 'txt', 'odt'].includes(ext)) return 'document';
    if (['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(ext)) return 'spreadsheet';
    if (['ppt', 'pptx', 'odp'].includes(ext)) return 'presentation';
    if (['epub', 'mobi', 'azw3'].includes(ext)) return 'ebook';
    return 'document';
  }

  window._fileGrabFindFiles = function() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const files = [];
    const seen = new Set();

    links.forEach(link => {
      const href = link.href;
      if (!href || !href.startsWith('http')) return;

      if (EXT_PATTERN.test(href)) {
        if (seen.has(href)) return;
        seen.add(href);

        const ext = getFileExtension(href);
        files.push({
          url: href,
          name: link.textContent.trim() || href.split('/').pop().split('?')[0] || 'file',
          ext: ext || '',
          category: getFileCategory(ext)
        });
      }
    });

    const embeds = Array.from(document.querySelectorAll('embed[src], iframe[src], object[data]'));
    embeds.forEach(el => {
      const src = el.src || el.data;
      if (!src || !src.startsWith('http')) return;

      if (EXT_PATTERN.test(src)) {
        if (seen.has(src)) return;
        seen.add(src);

        const ext = getFileExtension(src);
        files.push({
          url: src,
          name: src.split('/').pop().split('?')[0] || 'embedded-file',
          ext: ext || '',
          category: getFileCategory(ext)
        });
      }
    });

    return files;
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'findFiles') {
      const files = window._fileGrabFindFiles();
      sendResponse({ files });
    }
    return true;
  });
}
