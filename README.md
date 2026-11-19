# L'Oréal Smart Routine Builder

An AI-powered beauty routine builder. Browse products from the L'Oréal family of brands, select the ones you like, and an AI advisor builds a personalized step-by-step routine — then answers follow-up questions with full conversation memory.

## Features

| Rubric item | How it's done |
|---|---|
| Product selection | Click a card (or its **Select** button) to toggle it. Selected cards get a gold border + check badge and appear as chips in **Selected Products**. |
| Routine generation | **Generate Routine** sends the selected products' name, brand, category and description to OpenAI (via the Worker) and shows the routine in the chat. |
| Follow-up chat | The full conversation history is sent on every request, so follow-ups remember earlier answers. |
| Save selections | Selections are stored in `localStorage` and survive a reload. Remove one with **×** or all with **Clear all**. |
| Product descriptions | Each card has an accessible **Details** toggle (`aria-expanded`) that reveals the description. |
| Cloudflare Worker | All AI calls go through `worker.js`; the OpenAI key is a Worker secret, never in the browser. |
| LevelUp: web search | "Web search" toggle in the chat enables OpenAI's web search tool; replies show a **Sources** list with links. |
| LevelUp: product search | Live keyword search (name, brand, category, description) that combines with the category filter. |
| LevelUp: RTL | **RTL** button in the header flips the whole layout (grid, selected list, chat) using CSS logical properties; auto-enabled for Arabic/Hebrew/Farsi/Urdu browsers. |

## Setup

1. **Deploy the Worker**
   - Cloudflare dashboard → Workers & Pages → Create → Worker → paste in `worker.js` → Deploy.
   - Settings → Variables and Secrets → add `OPENAI_API_KEY` as a **Secret**.
2. **Connect the site** — paste your Worker URL into `WORKER_URL` at the top of `script.js`.
3. **Run it** — open with VS Code Live Server (or `python3 -m http.server`) and visit the local URL. Opening `index.html` directly won't load `products.json`.
4. **Publish** — push to GitHub and turn on GitHub Pages.

## Files

- `index.html` — page structure
- `style.css` — L'Oréal-branded styling, responsive + RTL-ready
- `script.js` — products, selection, persistence, chat, RTL
- `products.json` — product data
- `worker.js` — Cloudflare Worker proxy to the OpenAI Responses API
- `REFLECTION.md` — draft answers for the reflection questions
