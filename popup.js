// popup.js

let files = [];
let activeFilter = 'all';

const stateEmpty = document.getElementById('stateEmpty');
const stateLoading = document.getElementById('stateLoading');
const stateNone = document.getElementById('stateNone');
const toolbar = document.getElementById('toolbar');
const filterBar = document.getElementById('filterBar');
const fileList = document.getElementById('fileList');
const footer = document.getElementById('footer');
const countBadge = document.getElementById('countBadge');
const footerCount = document.getElementById('footerCount');
const folderBar = document.getElementById('folderBar');
const btnSelectAll = document.getElementById('btnSelectAll');
const btnDownloadSelected = document.getElementById('btnDownloadSelected');

function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

const CATEGORY_ICONS = {
  document: '📄',
  spreadsheet: '📊',
  presentation: '📽️',
  ebook: '📚'
};

function getChecked() {
  return Array.from(document.querySelectorAll('.file-check:checked'))
    .map(cb => parseInt(cb.dataset.index));
}

function updateFooter() {
  const checked = getChecked().length;
  const visible = document.querySelectorAll('.file-item:not([style*="display: none"])').length;
  footerCount.textContent = `${checked} of ${visible} selected`;
  btnDownloadSelected.disabled = checked === 0;
}

function buildFilters() {
  const categories = {};
  files.forEach(f => {
    categories[f.category] = (categories[f.category] || 0) + 1;
  });

  filterBar.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.textContent = `All (${files.length})`;
  allBtn.dataset.filter = 'all';
  filterBar.appendChild(allBtn);

  Object.entries(categories).sort().forEach(([cat, count]) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = `${cat} (${count})`;
    btn.dataset.filter = cat;
    filterBar.appendChild(btn);
  });

  filterBar.addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-btn')) return;
    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeFilter = e.target.dataset.filter;
    applyFilter();
  });
}

function applyFilter() {
  document.querySelectorAll('.file-item').forEach(item => {
    const cat = item.dataset.category;
    if (activeFilter === 'all' || cat === activeFilter) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
  updateFooter();
}

function renderList() {
  fileList.innerHTML = '';

  files.forEach((file, i) => {
    const filename = file.url.split('/').pop().split('?')[0] || `file-${i + 1}`;
    const cleanName = file.name.length > 2 ? file.name : filename;
    const icon = CATEGORY_ICONS[file.category] || '📎';
    const extLabel = file.ext ? file.ext.toUpperCase() : '';

    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.category = file.category;
    item.innerHTML = `
      <input type="checkbox" class="file-check" data-index="${i}" data-url="${file.url}" checked />
      <span class="file-icon">${icon}</span>
      <div class="file-info">
        <div class="file-name" title="${cleanName}">${cleanName}</div>
        <div class="file-url" title="${file.url}">
          ${extLabel ? `<span class="ext-badge">${extLabel}</span>` : ''}
          ${file.url}
        </div>
      </div>
      <button class="file-dl-btn" data-index="${i}" title="Download this file">⬇</button>
    `;

    item.querySelector('.file-dl-btn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      downloadFile(file.url, filename);
      btn.textContent = '✓';
      btn.classList.add('done');
    });

    item.querySelector('.file-check').addEventListener('change', updateFooter);

    fileList.appendChild(item);
  });

  updateFooter();
}

function getSubfolder() {
  const input = document.getElementById('folderInput');
  const val = input ? input.value.trim() : '';
  if (!val) return '';
  return val.replace(/[^a-zA-Z0-9\-_ ]/g, '');
}

function sanitizeFilename(name) {
  let clean = name.split('?')[0].split('#')[0];
  clean = clean.replace(/[<>:"|?*\\]/g, '_');
  clean = clean.replace(/^[.\s]+/, '');
  return clean || 'document';
}

function downloadFile(url, filename) {
  const clean = sanitizeFilename(filename);
  const subfolder = getSubfolder();
  const path = subfolder ? `${subfolder}/${clean}` : clean;
  chrome.downloads.download({ url, filename: path, saveAs: false });
}

function scanPage() {
  hide(stateEmpty);
  hide(stateNone);
  hide(toolbar);
  hide(folderBar);
  hide(filterBar);
  hide(fileList);
  hide(footer);
  hide(countBadge);
  show(stateLoading);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const url = tab.url || '';

    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url.startsWith('edge://')) {
      hide(stateLoading);
      stateNone.innerHTML = `<span class="icon">⚠️</span>Cannot scan this page.<br>Navigate to a regular webpage and try again.`;
      show(stateNone);
      return;
    }

    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ['content.js'] },
      () => {
        if (chrome.runtime.lastError) {
          hide(stateLoading);
          stateNone.innerHTML = `<span class="icon">⚠️</span>Could not scan this page.<br>Try refreshing and reopening.`;
          show(stateNone);
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'findFiles' }, (response) => {
          hide(stateLoading);

          if (chrome.runtime.lastError || !response) {
            stateNone.innerHTML = `<span class="icon">⚠️</span>Could not scan this page.<br>Try refreshing and reopening.`;
            show(stateNone);
            return;
          }

          files = response.files || [];

          if (files.length === 0) {
            show(stateNone);
            return;
          }

          countBadge.textContent = `${files.length} found`;
          show(countBadge);
          show(toolbar);
          show(folderBar);
          show(filterBar);
          show(fileList);
          show(footer);

          buildFilters();
          renderList();
        });
      }
    );
  });
}

btnSelectAll.addEventListener('click', () => {
  const visibleCheckboxes = Array.from(document.querySelectorAll('.file-item:not([style*="display: none"]) .file-check'));
  const allChecked = visibleCheckboxes.every(cb => cb.checked);
  visibleCheckboxes.forEach(cb => { cb.checked = !allChecked; });
  btnSelectAll.textContent = allChecked ? '☑ Select All' : '☐ Deselect All';
  updateFooter();
});

btnDownloadSelected.addEventListener('click', () => {
  const indices = getChecked();
  if (indices.length === 0) return;

  indices.forEach(i => {
    const file = files[i];
    const filename = file.url.split('/').pop().split('?')[0] || `file-${i + 1}`;
    downloadFile(file.url, filename);
  });

  btnDownloadSelected.textContent = `✓ Downloading ${indices.length}…`;
  setTimeout(() => {
    btnDownloadSelected.textContent = '⬇ Download Selected';
  }, 2000);
});

// Auto-scan on open
scanPage();
