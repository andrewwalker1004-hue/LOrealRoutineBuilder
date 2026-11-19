/* =========================================================
   L'Oréal Smart Routine Builder
   - Browse / search / filter real L'Oréal-family products
   - Select products (persisted in localStorage)
   - Generate an AI routine + follow-up chat via a Cloudflare Worker
   ========================================================= */

/* 👉 Paste your deployed Cloudflare Worker URL here.
   The OpenAI API key lives ONLY in the Worker (as a secret), never in this file. */
const WORKER_URL = "https://loreal-routine-worker.YOUR-SUBDOMAIN.workers.dev/";

const STORAGE_KEYS = {
  selected: "loreal-selected-products",
  direction: "loreal-text-direction",
};

/* ---------- DOM ---------- */
const productsContainer = document.getElementById("productsContainer");
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const resultCount = document.getElementById("resultCount");
const selectedList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const clearBtn = document.getElementById("clearSelections");
const generateBtn = document.getElementById("generateRoutine");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const webSearchToggle = document.getElementById("webSearchToggle");
const dirToggle = document.getElementById("dirToggle");
const dirLabel = document.getElementById("dirLabel");

/* ---------- State ---------- */
let allProducts = [];
let selectedIds = new Set(loadSelectedIds());
let isLoading = false;

/* Full conversation history (user + assistant turns) so follow-ups keep context.
   The system prompt is rebuilt on every request so it always reflects the
   currently selected products. */
const conversation = [];

/* ---------- Storage helpers (wrapped: storage can be blocked) ---------- */
function loadSelectedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.selected);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function saveSelectedIds() {
  try {
    localStorage.setItem(STORAGE_KEYS.selected, JSON.stringify([...selectedIds]));
  } catch {
    /* storage unavailable — selections just won't persist */
  }
}

/* ---------- Utilities ---------- */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function categoryClass(category) {
  return "cat-" + category.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");
}

function monogram(brand) {
  const words = brand.replace(/['’]/g, "").split(/[\s-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function getSelectedProducts() {
  return allProducts.filter((p) => selectedIds.has(p.id));
}

/* Very small, safe Markdown renderer for AI replies.
   Text is HTML-escaped first, then a limited set of formatting is applied. */
function renderMarkdown(md) {
  const lines = escapeHTML(md).split(/\r?\n/);
  let html = "";
  let listType = null;

  const inline = (text) =>
    text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    let m;
    if (!line) {
      closeList();
      continue;
    }
    if ((m = line.match(/^#{1,2}\s+(.*)/))) {
      closeList();
      html += `<h3>${inline(m[1])}</h3>`;
    } else if ((m = line.match(/^#{3,6}\s+(.*)/))) {
      closeList();
      html += `<h4>${inline(m[1])}</h4>`;
    } else if ((m = line.match(/^[-*•]\s+(.*)/))) {
      if (listType !== "ul") {
        closeList();
        html += "<ul>";
        listType = "ul";
      }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\d+[.)]\s+(.*)/))) {
      if (listType !== "ol") {
        closeList();
        html += "<ol>";
        listType = "ol";
      }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

/* =========================================================
   Products: load, filter, render
   ========================================================= */
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
    // Drop any stored IDs that no longer exist
    selectedIds = new Set([...selectedIds].filter((id) => allProducts.some((p) => p.id === id)));
    renderProducts();
    renderSelected();
  } catch (err) {
    productsContainer.innerHTML = `<div class="placeholder-message">Couldn't load products. If you opened this file directly, run it from a local server (e.g. VS Code Live Server).</div>`;
    console.error(err);
  }
}

function getFilteredProducts() {
  const category = categoryFilter.value;
  const terms = productSearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return allProducts.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (!terms.length) return true;
    const haystack = `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

function renderProducts() {
  const products = getFilteredProducts();

  resultCount.textContent = `Showing ${products.length} of ${allProducts.length} products`;

  if (!products.length) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products match your search. Try a different keyword or category.</div>`;
    return;
  }

  productsContainer.innerHTML = products
    .map((p) => {
      const isSelected = selectedIds.has(p.id);
      const descId = `desc-${p.id}`;
      return `
      <article class="product-card ${isSelected ? "selected" : ""}" data-id="${p.id}">
        <span class="check-badge" aria-hidden="true">✓</span>
        <div class="product-visual ${categoryClass(p.category)}" aria-hidden="true">
          <span class="monogram">${escapeHTML(monogram(p.brand))}</span>
          <span class="cat-label">${escapeHTML(p.category)}</span>
        </div>
        <div class="product-info">
          <span class="product-brand">${escapeHTML(p.brand)}</span>
          <h3 class="product-name">${escapeHTML(p.name)}</h3>
          <p class="product-description" id="${descId}" hidden>${escapeHTML(p.description)}</p>
          <div class="card-actions">
            <button type="button" class="select-btn" aria-pressed="${isSelected}">
              ${isSelected ? "✓ Selected" : "+ Select"}
            </button>
            <button type="button" class="details-btn" aria-expanded="false" aria-controls="${descId}">
              Details
            </button>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

/* One delegated click handler for every card */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return;

  // Details button reveals/hides the description without selecting
  const detailsBtn = e.target.closest(".details-btn");
  if (detailsBtn) {
    const desc = card.querySelector(".product-description");
    const expanded = detailsBtn.getAttribute("aria-expanded") === "true";
    detailsBtn.setAttribute("aria-expanded", String(!expanded));
    detailsBtn.textContent = expanded ? "Details" : "Hide";
    desc.hidden = expanded;
    return;
  }

  // Clicking anywhere else on the card (or the Select button) toggles selection
  if (e.target.closest(".product-description")) return; // allow reading/copying text
  toggleProduct(Number(card.dataset.id));
});

function toggleProduct(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  saveSelectedIds();
  updateCardState(id);
  renderSelected();
}

/* Update a single card in place so open descriptions stay open */
function updateCardState(id) {
  const card = productsContainer.querySelector(`.product-card[data-id="${id}"]`);
  if (!card) return;
  const isSelected = selectedIds.has(id);
  card.classList.toggle("selected", isSelected);
  const btn = card.querySelector(".select-btn");
  btn.setAttribute("aria-pressed", String(isSelected));
  btn.textContent = isSelected ? "✓ Selected" : "+ Select";
}

/* =========================================================
   Selected products list
   ========================================================= */
function renderSelected() {
  const selected = getSelectedProducts();
  selectedCount.textContent = selected.length;
  clearBtn.disabled = selected.length === 0;
  generateBtn.disabled = selected.length === 0 || isLoading;

  if (!selected.length) {
    selectedList.innerHTML = `<li class="empty">No products selected yet — click a product above to add it.</li>`;
    return;
  }

  selectedList.innerHTML = selected
    .map(
      (p) => `
      <li class="selected-chip">
        <span><span class="chip-brand">${escapeHTML(p.brand)}</span> · ${escapeHTML(p.name)}</span>
        <button type="button" class="remove-btn" data-id="${p.id}" aria-label="Remove ${escapeHTML(p.name)}">×</button>
      </li>`
    )
    .join("");
}

selectedList.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-btn");
  if (btn) toggleProduct(Number(btn.dataset.id));
});

clearBtn.addEventListener("click", () => {
  const ids = [...selectedIds];
  selectedIds.clear();
  saveSelectedIds();
  ids.forEach(updateCardState);
  renderSelected();
});

/* Filters */
categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);

/* =========================================================
   Chat + AI
   ========================================================= */
function buildSystemPrompt() {
  const selected = getSelectedProducts().map(({ name, brand, category, description }) => ({
    name,
    brand,
    category,
    description,
  }));

  return `You are the L'Oréal Smart Routine Builder, a warm, expert beauty advisor for the L'Oréal family of brands (L'Oréal Paris, CeraVe, La Roche-Posay, Garnier, Maybelline, Lancôme, Kiehl's, Kérastase, Redken, Vichy, SkinCeuticals, Urban Decay, YSL, Armani and more).

Your job:
- Build personalized routines using the user's selected products (listed below as JSON).
- Order steps correctly (e.g. cleanse → treat/serum → moisturize → SPF in the morning; cleanse → treatments like retinol → moisturize at night). Say which steps are AM vs PM when relevant.
- Explain briefly WHY each product is in that step, how much to use, and any cautions (e.g. retinol + SPF, patch testing, avoid layering benzoyl peroxide with retinol).
- If an obvious step is missing (e.g. no sunscreen), you may suggest a type of L'Oréal-family product to add, but focus on what they selected.
- Answer follow-up questions using the full conversation so far.
- Only discuss skincare, haircare, makeup, fragrance, grooming, and related beauty topics. Politely decline unrelated requests and steer back to beauty.
- Never diagnose medical conditions; suggest a dermatologist for medical concerns.
- When you use web search, cite sources with markdown links.
- Reply in the same language the user writes in.
- Format with short markdown: headings, numbered steps, and bold product names. Keep it concise and friendly.

Currently selected products:
${selected.length ? JSON.stringify(selected, null, 2) : "(none selected)"}`;
}

function addMessage(role, html, extraClass = "") {
  const div = document.createElement("div");
  div.className = `msg ${role} ${extraClass}`.trim();
  const label = role === "user" ? "You" : "L'Oréal Advisor";
  div.innerHTML = `<span class="msg-label">${label}</span>${html}`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function showTyping() {
  return addMessage("ai", `<span class="typing" aria-label="Advisor is typing"><span></span><span></span><span></span></span>`);
}

function renderSources(citations) {
  if (!citations || !citations.length) return "";
  // de-duplicate by URL
  const seen = new Set();
  const unique = citations.filter((c) => c.url && !seen.has(c.url) && seen.add(c.url));
  return `
    <div class="sources">
      <strong>Sources</strong>
      <ol>
        ${unique
          .map(
            (c) =>
              `<li><a href="${escapeHTML(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(c.title || c.url)}</a></li>`
          )
          .join("")}
      </ol>
    </div>`;
}

function setLoading(state) {
  isLoading = state;
  sendBtn.disabled = state;
  userInput.disabled = state;
  generateBtn.disabled = state || selectedIds.size === 0;
}

/* Sends the conversation to the Cloudflare Worker and shows the reply */
async function askAI() {
  if (WORKER_URL.includes("YOUR-SUBDOMAIN")) {
    addMessage(
      "ai",
      `<p>⚠️ The AI isn't connected yet. Deploy the Cloudflare Worker (see <code>worker.js</code> and the README) and paste its URL into <code>WORKER_URL</code> at the top of <code>script.js</code>.</p>`,
      "error"
    );
    conversation.pop(); // don't keep an unanswered user turn
    return;
  }

  setLoading(true);
  const typing = showTyping();

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: buildSystemPrompt() }, ...conversation],
        webSearch: webSearchToggle.checked,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || data.error || `Request failed (${response.status})`);
    }

    const reply = data.reply || "Sorry, I couldn't generate a response. Please try again.";
    conversation.push({ role: "assistant", content: reply });
    typing.remove();
    addMessage("ai", renderMarkdown(reply) + renderSources(data.citations));
  } catch (err) {
    console.error(err);
    conversation.pop(); // remove the user turn that failed so history stays clean
    typing.remove();
    addMessage("ai", `<p>Sorry — something went wrong: ${escapeHTML(err.message)}. Please try again.</p>`, "error");
  } finally {
    setLoading(false);
    userInput.focus();
  }
}

/* Generate Routine */
generateBtn.addEventListener("click", () => {
  const selected = getSelectedProducts();
  if (!selected.length || isLoading) return;

  const names = selected.map((p) => `${p.brand} ${p.name}`);
  addMessage(
    "user",
    `<p>Build me a personalized routine with my ${selected.length} selected product${selected.length > 1 ? "s" : ""}:</p><ul>${names
      .map((n) => `<li>${escapeHTML(n)}</li>`)
      .join("")}</ul>`
  );

  conversation.push({
    role: "user",
    content: `Please create a personalized step-by-step routine using ONLY these selected products (full details are in the system message): ${names.join(
      "; "
    )}. Organize it into morning and/or evening steps as appropriate.`,
  });

  askAI();
});

/* Follow-up chat */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || isLoading) return;

  addMessage("user", `<p>${escapeHTML(text)}</p>`);
  conversation.push({ role: "user", content: text });
  userInput.value = "";
  askAI();
});

/* =========================================================
   RTL support
   ========================================================= */
function applyDirection(dir) {
  document.documentElement.dir = dir;
  dirToggle.setAttribute("aria-pressed", String(dir === "rtl"));
  dirLabel.textContent = dir === "rtl" ? "LTR" : "RTL";
}

dirToggle.addEventListener("click", () => {
  const next = document.documentElement.dir === "rtl" ? "ltr" : "rtl";
  applyDirection(next);
  try {
    localStorage.setItem(STORAGE_KEYS.direction, next);
  } catch {
    /* ignore */
  }
});

function initDirection() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEYS.direction);
  } catch {
    /* ignore */
  }
  // Default to RTL automatically for right-to-left browser languages
  const rtlLangs = ["ar", "he", "fa", "ur"];
  const browserRTL = rtlLangs.includes((navigator.language || "").slice(0, 2));
  applyDirection(saved || (browserRTL ? "rtl" : "ltr"));
}

/* =========================================================
   Init
   ========================================================= */
initDirection();
addMessage(
  "ai",
  `<p>👋 Hi! I'm your L'Oréal beauty advisor. Select products above and click <strong>Generate Routine</strong>, or ask me anything about skincare, haircare, makeup, or fragrance.</p>`
);
loadProducts();
