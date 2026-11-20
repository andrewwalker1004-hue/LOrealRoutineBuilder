# Reflection Questions

## 1. Prompt Writing

My system prompt does three jobs: it gives the AI a role, the right data, and clear rules.

**Role:** The AI is a friendly, expert beauty advisor for the L'Oréal family of brands, including CeraVe, La Roche-Posay, Lancôme, Kérastase, Garnier and Maybelline.

**Data:** The prompt includes the user's selected products as JSON (name, brand, category and full description). I rebuild the system prompt on every request, so it always reflects the *current* selection. If someone adds or removes a product mid-conversation, the AI knows right away instead of working from an outdated list.

**Rules:**
- Put steps in the right order: cleanse → treat → moisturize → SPF in the morning, and cleanse → treatments like retinol → moisturize at night.
- Label which steps are AM and which are PM.
- Explain why each product belongs in its step and how to use it.
- Flag cautions, like starting retinol slowly and always wearing sunscreen with it.
- Only talk about beauty topics, and never diagnose skin conditions.
- Cite sources when using web search.
- Reply in the user's language.

When the user clicks "Generate Routine," I also send a specific message: *"create a step-by-step routine using ONLY these selected products, organized into morning and/or evening steps."*

The biggest thing I learned is that being specific beats being long. A vague prompt like "make a skincare routine" got generic advice that mentioned products the user didn't pick. Once I said "use ONLY these products" and spelled out the step order, the answers became actually useful. When I tested it with a cleanser, a retinol serum and an SPF 60, it put the sunscreen in the morning and the retinol at night, and it told me to start retinol once a week. I also learned that the API doesn't remember anything on its own. To make follow-up questions work, I had to send the whole conversation history with every request.

## 2. Overcoming Roadblocks

**"Use POST" error:** After deploying my Cloudflare Worker, I clicked its URL to test it and got `{"error":"Use POST"}`. At first I thought it was broken. Then I learned that opening a link in the browser sends a GET request, but my Worker only accepts POST requests, which is how my site sends it the chat messages and products. The error actually proved the Worker was running. I tested it properly by sending a POST request, and it answered with a cited source.

**Keeping my API key safe:** I needed my OpenAI key in the Worker without ever putting it in my code or on GitHub. I used `npx wrangler secret put OPENAI_API_KEY`, which stores the key as an encrypted secret on Cloudflare. My website only knows the Worker's URL, so nobody can find my key by looking at the page source.

**Not matching the example design:** My first version worked, but it looked nothing like the example, and it used colored placeholder tiles instead of real product photos. I found the official starter repo's `products.json`, which links to real product images. Then I restyled everything to match: a centered logo, a search card, horizontal product cards with photos, a "Show More Products" link and a red "Generate Routine" button.

**My computer ran out of disk space:** In the middle of the project, my tools stopped working because my Mac's disk was full. I had to clear out space (empty the Trash and clear caches) before I could keep going. It was a good reminder that dev tools need room to work.

**What I'd tell someone else:** Read the error message carefully. It usually tells you exactly what's wrong, even when it looks scary at first.

## 3. LinkedIn Post

🚀 I just built an AI-powered **L'Oréal Smart Routine Builder**!

You browse real products from brands like CeraVe, La Roche-Posay, Lancôme and Kérastase, select the ones you use, and click "Generate Routine." The OpenAI API then builds a personalized morning and evening routine using only your products. You can keep asking follow-up questions, and the advisor remembers the whole conversation.

What I built:
✨ Product selection that's saved even after you refresh the page
🔍 Live product search that works together with category filters
🌐 Web search, so answers include current info with cited sources
🔒 A Cloudflare Worker that keeps my API key secure and out of the browser
↔️ Right-to-left layout support for languages like Arabic and Hebrew

My biggest takeaway: writing good prompts is really product design. Giving the AI the right data and clear rules made the difference between generic advice and a routine that actually makes sense.

🔗 Live demo: https://andrewwalker1004-hue.github.io/LOrealRoutineBuilder/
💻 Code: https://github.com/andrewwalker1004-hue/LOrealRoutineBuilder

#AI #WebDevelopment #JavaScript #OpenAI #Cloudflare #PromptEngineering
