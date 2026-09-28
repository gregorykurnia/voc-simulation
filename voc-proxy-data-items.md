# Delamibrands VOC Proxy: Data Items

**Purpose:** starter dropdowns and tags for a realistic fashion-retail voice-of-customer (VOC) dataset. These are proxy values for prototyping, not an official product catalog or a complete store master.

## Suggested record fields

| Field | Use |
| --- | --- |
| Feedback date | Date the comment was received (keep the original event date if it is imported later). |
| Brand | One brand the feedback is about. |
| Product category | The kind of product, such as trousers or a shirt. |
| Product/style mentioned | The named style, line, or item if the customer identifies it; allow free text until a verified SKU catalog is connected. |
| Product attribute | Optional detail such as color, size, fabric, or fit. |
| Voice source | Where the comment came from. |
| Issue type | One primary issue; add secondary tags only when needed. |
| Store location | Use for a store-related interaction. For non-store feedback, leave blank or use `Online / Not applicable` rather than guessing a branch. |
| Status | Current handling state of the feedback record. |
| Verbatim feedback | Original customer wording, stored separately from normalized tags. |

## Products

The current examples combine product types (`Career Chinos`, `Polo Shirt`), a fabric property (`4 Way Stretch`), a component (`Belt Buckle`), and a fabric or weave (`Oxford`). Keep those distinctions so product trends can be analyzed cleanly.

### Product category dropdown

- **Tops:** casual shirt, dress shirt, Oxford shirt, polo shirt, T-shirt, blouse, knit top, sweater, tunic
- **Bottoms:** career chinos, tailored trousers, casual trousers, jeans, denim shorts, casual shorts, skirt
- **Outerwear:** traveler jacket, denim jacket, blazer, overshirt, cardigan
- **One-piece:** dress, jumpsuit
- **Modestwear:** modest tunic, modest outerwear, long dress, hijab
- **Accessories:** belt, belt buckle, bag, wallet, scarf, tie, socks, footwear
- **Other / not specified**

### Product/style examples for proxy records

Retain the supplied examples, with normalized spelling:

- 4-way stretch *(fabric/property; tag under Product attribute, not category)*
- Belt buckle *(accessory/component; use Belt as the category when that is the item being discussed)*
- Career chinos
- Casual shirt
- Oxford shirt *(Oxford describes the shirt fabric/weave as well as a familiar shirt type)*
- Polo shirt
- Traveler jacket

Additional generic style examples to seed synthetic feedback: slim-fit chinos, straight-leg jeans, tapered trousers, short-sleeve linen shirt, poplin shirt, pique polo, graphic T-shirt, rib-knit top, pleated skirt, shirt dress, relaxed blazer, denim trucker jacket, utility overshirt, modest tunic, and crossbody bag. These are illustrative product names, not confirmed current Delamibrands SKUs.

## Voice source

- Instagram (DM, comment, mention)
- WhatsApp
- Store (staff conversation or store contact)
- QR survey (in-store or on receipt)
- Brand website / e-commerce
- Marketplace (for example, Shopee or Tokopedia)
- Email
- Customer-service phone call
- TikTok (comment or direct message)
- Facebook
- Other

If useful later, store `source_detail` separately (for example, Instagram DM versus Instagram comment). QR is a feedback collection method, while Store is the interaction location; keeping both as source choices preserves the proxy setup while allowing that distinction.

## Issue type

Use one primary issue type per record, then optional sub-tags where useful.

- **Availability** — item or requested size unavailable; store or online stock differs
- **Sizing** — size chart, grading, or labeled size feels inconsistent
- **Fit / comfort** — too tight or loose, rise, length, movement, or comfort
- **Color** — shade, color options, color transfer, or color differs from photos
- **Product design** — style, cut, details, pockets, or appearance
- **Product quality** — overall workmanship or perceived quality
- **Material / fabric** — hand feel, breathability, stretch, thickness, or fabric choice
- **Durability** — fading, pilling, shrinkage, stretching out, or wear after washing
- **Construction / finishing** — seams, stitching, buttons, zippers, hems, or loose threads
- **Price / value** — price, perceived value, or price change
- **Product information** — inaccurate size chart, photos, description, or care instructions
- **Promotion / discount** — offer eligibility, discount application, or unclear promotion terms
- **Order / fulfillment** — wrong item, incomplete order, cancellation, or packing issue
- **Delivery** — delay, tracking, courier, or damaged parcel
- **Return / exchange / refund** — eligibility, process, timing, or outcome
- **Store experience** — queue, fitting room, cleanliness, accessibility, or general environment
- **Staff / service** — helpfulness, knowledge, conduct, or response time
- **Payment / checkout** — payment failure, checkout error, or receipt issue
- **Website / app / marketplace experience** — navigation, account, search, cart, or platform problem
- **Membership / rewards** — points, account, redemption, or member benefit
- **Other / unclear** — use sparingly; review these records to improve the taxonomy

## Store locations

Use `Location — City, Province` as the dropdown label. This 25-location seed list spans several Indonesian regions and is based on locations appearing in Delamibrands brand store-locator pages. It is a representative proxy list, not a claim that every location is currently open or carries every brand.

1. Grand Indonesia — Central Jakarta, DKI Jakarta
2. Mall Kota Kasablanka — South Jakarta, DKI Jakarta
3. Mall Kelapa Gading — North Jakarta, DKI Jakarta
4. Puri Indah Mall — West Jakarta, DKI Jakarta
5. Summarecon Mall Serpong — Tangerang, Banten
6. Supermal Karawaci — Tangerang, Banten
7. Summarecon Mall Bekasi — Bekasi, West Java
8. Botani Square — Bogor, West Java
9. Paris Van Java — Bandung, West Java
10. Cirebon Super Block (CSB Mall) — Cirebon, West Java
11. Paragon City Mall — Semarang, Central Java
12. The Park Mall Solo Baru — Sukoharjo / Greater Surakarta, Central Java
13. Plaza Ambarrukmo — Sleman / Yogyakarta, Special Region of Yogyakarta
14. Pakuwon Surabaya — Surabaya, East Java
15. Sun Plaza — Medan, North Sumatra
16. Palembang Icon Mall — Palembang, South Sumatra
17. Ciputra Seraya — Pekanbaru, Riau
18. Lampung City Mall — Bandar Lampung, Lampung
19. Mall Bali Galeria — Badung, Bali
20. Mall Ratu Indah — Makassar, South Sulawesi
21. Manado Town Square — Manado, North Sulawesi
22. Pentacity Mall — Balikpapan, East Kalimantan
23. Duta Mall — Banjarmasin, South Kalimantan
24. Grand Batam Mall — Batam, Riau Islands
25. Mall A Yani — Pontianak, West Kalimantan

For production data, use a stable `store_id` behind each display label and maintain a separate current store master with brand availability and open/closed dates.

## Brand

Include all seven brands currently presented in Delamibrands’ portfolio:

- The Executive *(may be called “Executive” in internal systems)*
- Colorbox
- et cetera
- Wood
- Wrangler
- Jenahara
- Tirajeans

The current Delamibrands Rewards landing page features six brands and omits Tirajeans; the broader Delamibrands portfolio pages include Tirajeans. Keep all seven available for a company-wide VOC proxy, then filter by the brands in the chosen research scope.

## Status

Keep the current statuses and add a few that help represent a complete feedback-handling cycle:

- **Open** — received and awaiting triage
- **In Review** — being categorized or assessed
- **In Progress** — follow-up or corrective action is underway
- **Pending Customer** — waiting for a customer reply or evidence
- **Pending Internal / Store** — waiting for another team or store
- **Validated** — feedback and its tags have been checked by a reviewer
- **Resolved** — an action or response has been completed
- **Closed** — no further action is planned
- **Reopened** — follow-up is needed after a prior resolution or closure

For clearer reporting, consider storing validation as a separate `review_state` (`Not reviewed`, `Validated`, `Needs clarification`) and keeping workflow status for handling progress. The list above preserves `Validated` as a status for compatibility with the existing proxy.

## Sources checked

- [Delamibrands brand portfolio](https://delamibrands.com/brands/)
- [Delamibrands Rewards brand list](https://infomember.delamibrands.com/)
- Official brand pages: [The Executive](https://delamibrands.com/brands/executive/), [Colorbox](https://delamibrands.com/brands/colorbox/), [et cetera](https://delamibrands.com/brands/et-cetera/), [Wood](https://delamibrands.com/brands/wood/), [Wrangler](https://delamibrands.com/brands/wrangler/), [Jenahara](https://delamibrands.com/brands/jenahara/), and [Tirajeans](https://delamibrands.com/brands/tirajeans/)
- Official store-locator examples: [The Executive](https://widget.delamibrands.com/executive/executive_report/Front/storelocation/), [et cetera](https://widget.delamibrands.com/etcetera/etcetera_report/Front/storelocation/), and [Delamibrands store locations](https://bdd.delamibrands.com/report/Front/storelocation/)

*Portfolio and locator pages can change. Recheck brand scope and store availability before treating these proxy lists as production reference data.*
