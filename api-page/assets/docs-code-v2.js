function docsCodeEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightJson(text = "") {
  const escaped = docsCodeEscape(text);

  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|\b-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?\b|([{}\[\],])/g,
    (match, stringToken, isKey, boolOrNull, punctuation) => {
      if (punctuation) {
        return `<span class="code-token-punctuation">${punctuation}</span>`;
      }

      if (boolOrNull) {
        if (boolOrNull === "null") {
          return `<span class="code-token-null">${boolOrNull}</span>`;
        }
        return `<span class="code-token-boolean">${boolOrNull}</span>`;
      }

      if (/^-?\d/.test(match)) {
        return `<span class="code-token-number">${match}</span>`;
      }

      if (stringToken) {
        if (isKey) {
          return `<span class="code-token-key">${stringToken}</span><span class="code-token-punctuation">:</span>`;
        }
        return `<span class="code-token-string">${stringToken}</span>`;
      }

      return match;
    }
  );
}

function highlightCurl(text = "") {
  let escaped = docsCodeEscape(text);

  escaped = escaped.replace(/\bcurl\b/g, `<span class="code-token-command">curl</span>`);
  escaped = escaped.replace(/(\s)(-[A-Za-z-]+)/g, `$1<span class="code-token-flag">$2</span>`);
  escaped = escaped.replace(/"(https?:\/\/[^\"]+)"/g, `"<span class="code-token-url">$1</span>"`);
  escaped = escaped.replace(/'([^']*)'/g, `'<span class="code-token-string">$1</span>'`);

  return escaped;
}

function highlightUrl(text = "") {
  const escaped = docsCodeEscape(text);
  const [base, query = ""] = escaped.split("?");

  let html = `<span class="code-token-url">${base}</span>`;

  if (query) {
    html += `<span class="code-token-punctuation">?</span>`;
    const parts = query.split("&");

    html += parts
      .map((part, index) => {
        const [key, value = ""] = part.split("=");
        const prefix = index > 0 ? `<span class="code-token-punctuation">&amp;</span>` : "";
        return `${prefix}<span class="code-token-query-key">${key}</span><span class="code-token-punctuation">=</span><span class="code-token-query-value">${value}</span>`;
      })
      .join("");
  }

  return html;
}

function highlightPlain(text = "") {
  return `<span class="code-token-plain">${docsCodeEscape(text)}</span>`;
}

function highlightError(text = "") {
  return `<span class="code-token-error">${docsCodeEscape(text)}</span>`;
}

function setDocsCodeBlock(target, text = "", type = "plain") {
  const node = typeof target === "string" ? document.getElementById(target) : target;
  if (!node) return;

  let html = "";

  switch (type) {
    case "json":
      html = highlightJson(text);
      break;
    case "curl":
      html = highlightCurl(text);
      break;
    case "url":
      html = highlightUrl(text);
      break;
    case "error":
      html = highlightError(text);
      break;
    default:
      html = highlightPlain(text);
      break;
  }

  node.innerHTML = html;
}

function getCodeBlockText(targetId) {
  const node = document.getElementById(targetId);
  if (!node) return "";
  return node.textContent || "";
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-target]");
  if (!button) return;

  const targetId = button.getAttribute("data-copy-target");
  const text = getCodeBlockText(targetId);
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    button.classList.add("is-copied");
    const icon = button.querySelector(".material-icons");
    if (icon) icon.textContent = "check";

    setTimeout(() => {
      button.classList.remove("is-copied");
      if (icon) icon.textContent = "content_copy";
    }, 1400);
  } catch (_) {
    /* noop */
  }
});

window.setDocsCodeBlock = setDocsCodeBlock;
