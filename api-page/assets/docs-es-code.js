const state = {
  categories: [],
  currentEndpoint: null
};

const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');

const endpointModal = document.getElementById('endpointModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const endpointForm = document.getElementById('endpointForm');
const formFields = document.getElementById('formFields');
const responseSection = document.getElementById('responseSection');
const requestUrlBox = document.getElementById('requestUrlBox');
const curlBox = document.getElementById('curlBox');
const responseBox = document.getElementById('responseBox');
const clearResponseBtn = document.getElementById('clearResponseBtn');

const endpointTranslations = {
  '/ai/copilot': {
    summary: 'Chat de Copilot',
    description: 'Envía preguntas a Microsoft Copilot y obtén respuestas junto con referencias/citas.',
    parameters: {
      message: {
        description: 'Mensaje o pregunta que quieres enviar a Copilot'
      },
      model: {
        description: 'Modelo de Copilot que se utilizará (predeterminado: default; opcional: think-deeper, gpt-5)'
      }
    }
  },
  '/ai/venice': {
    summary: 'Chat de Venice AI',
    description: 'Envía preguntas a Venice AI y obtén una respuesta final.'
  },
  '/anime/waifu': {
    summary: 'Waifu',
    description: 'Obtiene una imagen aleatoria de waifu desde la API.'
  },
  '/download/capcut': {
    summary: 'Descargador de CapCut',
    description: 'Obtiene datos y video de una plantilla de CapCut a partir de su URL.'
  },
  '/download/pinterest': {
    summary: 'Pinterest',
    description: 'Obtiene datos y enlaces multimedia desde una URL de Pinterest o pin.it.'
  },
  '/download/tiktok': {
    summary: 'TikTok',
    description: 'Descarga video de TikTok.'
  },
  '/image/bluearchive': {
    summary: 'Blue Archive',
    description: 'Imágenes aleatorias de Blue Archive.'
  },
  '/image/loli': {
    summary: 'Loli',
    description: 'Imágenes aleatorias de loli.'
  },
  '/image/mpls': {
    summary: 'Generador MPLS',
    description: 'Crea un marco/twibbon usando la foto del usuario.'
  },
  '/image/papayang': {
    summary: 'Papayang',
    description: 'Imágenes aleatorias de Papayang.'
  },
  '/image/wallpaper': {
    summary: 'Wallpaper',
    description: 'Imágenes aleatorias desde WallpaperFlare según una búsqueda.'
  },
  '/news/detik': {
    summary: 'Noticias Detik',
    description: 'Extrae noticias populares de Detik.com.'
  },
  '/news/kontan': {
    summary: 'Noticias Kontan',
    description: 'Extrae noticias recientes de Kontan.co.id.'
  }
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

function paintCode(target, text, type = 'plain') {
  if (window.setDocsCodeBlock) {
    window.setDocsCodeBlock(target, text, type);
  } else if (target) {
    target.textContent = text;
  }
}

function localizeSpec(spec) {
  if (!spec || !spec.paths) return spec;

  Object.entries(spec.paths).forEach(([path, methods]) => {
    const tr = endpointTranslations[path];
    if (!tr) return;

    Object.values(methods || {}).forEach((endpoint) => {
      if (tr.summary) endpoint.summary = tr.summary;
      if (tr.description) endpoint.description = tr.description;

      if (endpoint.parameters && tr.parameters) {
        endpoint.parameters = endpoint.parameters.map((param) => {
          const pTr = tr.parameters[param.name];
          if (pTr?.description) {
            return { ...param, description: pTr.description };
          }
          return param;
        });
      }
    });
  });

  return spec;
}

function openSidebar() {
  sidebar.classList.remove('translate-x-full');
  backdrop.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeSidebar() {
  sidebar.classList.add('translate-x-full');
  backdrop.classList.add('hidden');
  if (endpointModal.classList.contains('hidden')) {
    document.body.classList.remove('overflow-hidden');
  }
}

function openModal(endpoint) {
  state.currentEndpoint = endpoint;

  document.getElementById('modalMethod').textContent = endpoint.method;
  document.getElementById('modalPath').textContent = endpoint.path;
  document.getElementById('modalSummary').textContent = endpoint.summary || 'Sin resumen';
  document.getElementById('modalDescription').textContent = endpoint.description || 'Sin descripción';

  formFields.innerHTML = buildFields(endpoint);
  clearResponse();

  endpointModal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeModal() {
  endpointModal.classList.add('hidden');
  state.currentEndpoint = null;
  if (backdrop.classList.contains('hidden')) {
    document.body.classList.remove('overflow-hidden');
  }
}

function clearResponse() {
  responseSection.classList.add('hidden');
  paintCode(requestUrlBox, '', 'url');
  paintCode(curlBox, '', 'curl');
  paintCode(responseBox, '', 'plain');
}

function normalizeCategories(spec) {
  const map = {};

  (spec.tags || []).forEach((tag) => {
    map[tag.name] = { name: tag.name, items: [], open: false };
  });

  Object.entries(spec.paths || {}).forEach(([path, methods]) => {
    Object.entries(methods || {}).forEach(([method, endpoint]) => {
      const tagName = endpoint.tags && endpoint.tags.length ? endpoint.tags[0] : 'Uncategorized';
      if (!map[tagName]) {
        map[tagName] = { name: tagName, items: [], open: false };
      }

      map[tagName].items.push({
        path,
        method: String(method).toUpperCase(),
        summary: endpoint.summary || 'Sin resumen',
        description: endpoint.description || 'Sin descripción',
        parameters: endpoint.parameters || [],
        requestBody: endpoint.requestBody || null,
        deprecated: !!endpoint.deprecated
      });
    });
  });

  return Object.values(map)
    .map((category) => ({
      ...category,
      items: category.items.sort((a, b) => a.path.localeCompare(b.path))
    }))
    .filter((category) => category.items.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderApiList() {
  const apiList = document.getElementById('apiList');
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  const emptyState = document.getElementById('emptyState');

  const filteredCategories = state.categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        const text = [
          category.name,
          item.path,
          item.summary,
          item.description,
          item.method
        ].join(' ').toLowerCase();
        return text.includes(searchTerm);
      })
    }))
    .filter((category) => category.items.length > 0);

  if (!filteredCategories.length) {
    apiList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  apiList.innerHTML = filteredCategories
    .map((category) => {
      const total = category.items.length;

      return `
        <div class="border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onclick="toggleCategory('${escapeAttr(category.name)}')"
            class="w-full px-4 sm:px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 text-left"
          >
            <div class="min-w-0 flex items-center gap-3">
              <span class="material-icons bg-slate-900 text-white p-2 shrink-0">folder</span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900 break-anywhere">${escapeHtml(category.name)}</p>
                <p class="text-xs text-slate-500">${total} endpoint${total > 1 ? 's' : ''}</p>
              </div>
            </div>
            <span class="material-icons text-slate-600 shrink-0">${category.open ? 'expand_less' : 'expand_more'}</span>
          </button>

          <div class="${category.open ? 'block' : 'hidden'} border-t border-slate-200">
            ${category.items
              .map(
                (item, endpointIndex) => `
                  <button
                    type="button"
                    onclick="openEndpointByFilter('${escapeAttr(category.name)}', ${endpointIndex})"
                    class="w-full px-4 sm:px-5 py-4 border-b border-slate-200 last:border-b-0 hover:bg-slate-50 text-left"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                          <span translate="no" class="notranslate px-2.5 py-1 text-[11px] font-semibold text-white ${
                            item.method === 'DELETE'
                              ? 'bg-red-700'
                              : item.method === 'PUT'
                                ? 'bg-amber-700'
                                : 'bg-slate-900'
                          }">${escapeHtml(item.method)}</span>
                          ${
                            item.deprecated
                              ? '<span translate="no" class="notranslate px-2 py-1 text-[11px] bg-amber-100 text-amber-800 font-semibold">deprecated</span>'
                              : '<span translate="no" class="notranslate px-2 py-1 text-[11px] bg-green-100 text-green-800 font-semibold">ready</span>'
                          }
                        </div>
                        <p translate="no" class="notranslate text-sm font-semibold text-slate-900 break-anywhere">${escapeHtml(item.path)}</p>
                        <p class="text-xs text-slate-500 mt-1 break-anywhere">${escapeHtml(item.summary)}</p>
                      </div>

                      <span class="material-icons text-slate-500 shrink-0 mt-1">open_in_new</span>
                    </div>
                  </button>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');
}

function toggleCategory(categoryName) {
  const category = state.categories.find((item) => item.name === categoryName);
  if (!category) return;
  category.open = !category.open;
  renderApiList();
}

function openEndpointByFilter(categoryName, filteredIndex) {
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = state.categories.find((item) => item.name === categoryName);
  if (!category) return;

  const filteredItems = category.items.filter((item) => {
    const text = [
      category.name,
      item.path,
      item.summary,
      item.description,
      item.method
    ].join(' ').toLowerCase();
    return text.includes(searchTerm);
  });

  const endpoint = filteredItems[filteredIndex];
  if (endpoint) openModal(endpoint);
}

function buildFields(endpoint) {
  const parts = [];

  (endpoint.parameters || []).forEach((param) => {
    const schema = param.schema || {};
    const required = !!param.required;
    const label = `${escapeHtml(param.name)}${required ? ' <span class="text-red-600">*</span>' : ''}`;
    const helper = param.description
      ? `<p class="text-[11px] text-slate-500 mt-1 break-anywhere">${escapeHtml(param.description)}</p>`
      : '';
    const placeholder = escapeAttr(schema.example ?? schema.default ?? '');

    if (Array.isArray(schema.enum) && schema.enum.length) {
      parts.push(`
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-2">${label}</label>
          <select name="${escapeAttr(param.name)}" class="w-full border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:border-slate-500" ${required ? 'required' : ''}>
            ${schema.enum.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('')}
          </select>
          ${helper}
        </div>
      `);
    } else if (schema.type === 'boolean') {
      parts.push(`
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-2">${label}</label>
          <select name="${escapeAttr(param.name)}" class="w-full border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:border-slate-500" ${required ? 'required' : ''}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          ${helper}
        </div>
      `);
    } else {
      const inputType = schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text';
      parts.push(`
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-2">${label}</label>
          <input
            type="${inputType}"
            name="${escapeAttr(param.name)}"
            placeholder="${placeholder}"
            class="w-full border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
            ${required ? 'required' : ''}
          />
          ${helper}
        </div>
      `);
    }
  });

  const content = endpoint.requestBody?.content || {};

  if (content['application/json']) {
    parts.push(`
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-2">Body (application/json)</label>
        <textarea
          name="__raw_json__"
          rows="7"
          placeholder='{"key":"value"}'
          class="w-full border border-slate-200 bg-white px-3 py-3 text-sm font-mono focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
        ></textarea>
        <p class="text-[11px] text-slate-500 mt-1">Si llenas este campo, la solicitud se enviará como JSON.</p>
      </div>
    `);
  }

  if (!parts.length) {
    return `
      <div class="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Este endpoint no requiere parámetros.
      </div>
    `;
  }

  return parts.join('');
}

function buildCurl(method, url, formData, rawJson) {
  let curl = `curl -X ${method} "${url}"`;

  if (rawJson && ['POST', 'PUT', 'PATCH'].includes(method)) {
    const safeJson = rawJson.replace(/'/g, `'\\''`);
    curl += ` -H "Content-Type: application/json" -d '${safeJson}'`;
    return curl;
  }

  return curl;
}

async function executeEndpoint(event) {
  event.preventDefault();

  const endpoint = state.currentEndpoint;
  if (!endpoint) return;

  const formData = new FormData(endpointForm);
  const method = endpoint.method.toUpperCase();
  const rawJson = String(formData.get('__raw_json__') || '').trim();

  let path = endpoint.path;
  const options = { method };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    if (rawJson) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = rawJson;
    }
  } else {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (key === '__raw_json__') continue;
      if (typeof value === 'string' && value) params.append(key, value);
    }
    const query = params.toString();
    if (query) path += (path.includes('?') ? '&' : '?') + query;
  }

  const fullUrl = `${window.location.origin}${path}`;
  paintCode(requestUrlBox, fullUrl, 'url');
  paintCode(curlBox, buildCurl(method, fullUrl, formData, rawJson), 'curl');
  paintCode(responseBox, 'Cargando...', 'plain');
  responseSection.classList.remove('hidden');

  try {
    const response = await fetch(path, options);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`${response.status} ${response.statusText}${errText ? '\n\n' + errText : ''}`);
    }

    if (contentType.includes('application/json')) {
      const data = await response.json();
      paintCode(responseBox, JSON.stringify(data, null, 2), 'json');
    } else {
      const text = await response.text();
      paintCode(responseBox, text, 'plain');
    }
  } catch (error) {
    paintCode(responseBox, error.message || String(error), 'error');
  }
}

async function fetchFirstJson(paths) {
  for (const path of paths) {
    try {
      const res = await fetch(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) continue;
      return await res.json();
    } catch (_) {
      /* noop */
    }
  }
  throw new Error('No valid JSON source found');
}

async function loadNotifications() {
  const container = document.getElementById('notificationsList');
  const unreadCount = document.getElementById('unreadCount');

  try {
    const data = await fetchFirstJson(['/src/data/notifications.json', '/src/notifications.json', '/notifications.json']);
    const notifications = Array.isArray(data) ? data : data ? [data] : [];

    const translated = notifications.map((item) => ({
      ...item,
      title: item.title === 'Update UI API' ? 'Actualización de la interfaz API' : item.title || 'Sin título',
      message:
        item.message === 'Sekarang ada update baru dari UI API, silahkan cek informasinya di saluran WhatsApp kami.'
          ? 'Ahora hay una nueva actualización de la interfaz de la API. Revisa la información en nuestro canal de WhatsApp.'
          : item.message || '-'
    }));

    if (!translated.length) {
      container.innerHTML = '<div class="border border-slate-200 bg-white p-4 text-sm text-slate-500">No hay notificaciones.</div>';
      unreadCount.classList.add('hidden');
      return;
    }

    const sorted = translated.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    let unread = 0;

    container.innerHTML = sorted
      .map((item) => {
        if (!item.read) unread++;

        const dateText = item.date
          ? new Date(item.date).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          : '-';

        return `
          <div class="border border-slate-200 bg-white p-4">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-900 break-anywhere">${escapeHtml(item.title || 'Sin título')}</p>
                <p class="text-sm text-slate-600 mt-1 break-anywhere">${escapeHtml(item.message || '-')}</p>
              </div>
              <div class="flex items-center gap-2 sm:ml-4 sm:shrink-0">
                ${!item.read ? '<span class="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>' : ''}
                <span class="text-xs text-slate-500 break-anywhere">${escapeHtml(dateText)}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    if (unread > 0) {
      unreadCount.textContent = unread;
      unreadCount.classList.remove('hidden');
    } else {
      unreadCount.classList.add('hidden');
    }
  } catch (_) {
    container.innerHTML = '<div class="border border-slate-200 bg-white p-4 text-sm text-slate-500">No hay notificaciones disponibles.</div>';
    unreadCount.classList.add('hidden');
  }
}

async function loadApis() {
  const apiList = document.getElementById('apiList');

  try {
    const spec = await fetchFirstJson(['/openapi.json', '/src/openapi.json', '/src/config/openapi.json']);
    state.categories = normalizeCategories(localizeSpec(spec));
    renderApiList();
  } catch (error) {
    apiList.innerHTML = `<div class="border border-red-200 bg-red-50 p-4 text-sm text-red-700">Error al cargar la documentación: ${escapeHtml(error.message || String(error))}</div>`;
  }
}

sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
backdrop.addEventListener('click', closeSidebar);
modalClose.addEventListener('click', closeModal);
clearResponseBtn.addEventListener('click', clearResponse);
endpointForm.addEventListener('submit', executeEndpoint);

document.getElementById('searchInput').addEventListener('input', renderApiList);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSidebar();
    closeModal();
  }
});

if (modalOverlay) {
  modalOverlay.addEventListener('click', closeModal);
}

endpointModal.addEventListener('click', (event) => {
  if (event.target === endpointModal) closeModal();
});

window.toggleCategory = toggleCategory;
window.openEndpointByFilter = openEndpointByFilter;

document.addEventListener('DOMContentLoaded', () => {
  loadNotifications();
  loadApis();
});
