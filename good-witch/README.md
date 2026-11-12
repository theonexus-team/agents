# A Good Witch: The Coven Experience (concept prototype)

> **Your daily magic. Your community. Your journey.**

An independent, interactive concept for a mobile-first spiritual lifestyle app. It shows how a creator with an
established audience could bring daily content, community, readings, events and merchandise together into one
branded experience.

**This is not an official A Good Witch product, and it is not an authorized collaboration.** It uses no official logos.

## Run it

This is a standalone Next.js app inside the `agents` repository, with its own dependencies.

```bash
cd good-witch
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

No environment variables, backend, accounts or network services are needed.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Welcome: hero, *Enter the Coven*, and a five-step *Explore the Experience* tour |
| `/home` | Home dashboard: Today's Magic (save / share / reflect), moon phase, journey strip, Explore cards, *From Shelley* videos |
| `/daily` | Daily Magic: affirmation browser (save, favourite, share), reflection journal, letting-go ritual, intention setting. Deep links: `#reflection`, `#release`, `#intention` |
| `/coven` | The Good Coven: daily discussion, filterable feed, likes, replies, a local post composer, member spotlight, announcements, gatherings |
| `/readings`, `/readings/book` | Private 1:1 Tarot Reading ($149) and a validated booking demo |
| `/events` | Three fictional events with *Learn more*, interest hearts, and a *Save my spot* registration demo |
| `/shop`, `/shop/[slug]`, `/bag` | The Magnetic Stash Hat and four kumihimo necklaces, product pages, quantity controls, bag, order summary, simulated checkout |
| `/membership` | The Good Coven proposed membership (features only, no price) |
| `/profile` | Name and avatar colour, plus saved affirmations and messages, journal, favourites, community activity, event interests and reading requests. Includes *Reset demo data* |

Mobile shows a bottom tab bar (Home, Daily Magic, The Coven, Readings, Shop). Desktop shows a sidebar with the same
tabs plus Events, Membership, Profile and Bag.

## How it's built

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Lucide icons.** Fonts (Cormorant Garamond, Jost) are
  self-hosted through `@fontsource`.
- `src/lib/content.ts`: all demonstration content (7 affirmations, 7 prompts, 5 posts, 3 events, products, the reading
  offer, creator messages). Edit this file to change the copy.
- `src/lib/store.ts`: a small `useSyncExternalStore` store that persists to `localStorage`
  (`a-good-witch:concept:v1`). Nothing leaves the browser.
- `src/components/Scene.tsx`: atmospheric SVG still lifes (witch hat, moon, candles, tarot, lavender, candle circle,
  products) used in place of photography. **To use real photos**, put them in `public/photos/` and map them in
  `PHOTO_OVERRIDES`. Every scene with that name then renders the photo.
- `src/components/ui.tsx`: buttons, the sheet/dialog, labels and the share helper.
  `src/components/features.tsx` holds the reflect sheet, the creator video player and the daily-content hook.

## Content and honesty rules

- Members, posts, events, announcements and creator messages are fictional and labelled as demonstration content.
- Product names and prices, and the private reading offer and price, come from the publicly visible store. Their
  descriptions were written for this concept.
- Membership is a proposal with no price, and nothing claims it is an existing paid offering.
- Checkout, booking, event registration and community posting are all simulated. No payments, emails or external calls
  are made.
- The daily practices are for reflection and inspiration. They are not presented as medical or mental health treatment.
