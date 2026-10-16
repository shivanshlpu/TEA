# Tea Bhatti — Cafe Poster Prompts

Use these prompts to generate your own classy cafe posters. Works with **ChatGPT (GPT Image 2)**, **Midjourney**, or **DALL-E**.

> **Important**: After generating, save the image and place it in `images/menu_images/` or directly in `apps/api/public/uploads/`. Then update the banner `image` field in `Home.jsx` (line ~28).

---

## How to Add Your Poster to the App

In [Home.jsx](file:///c:/Users/shiva/Desktop/cafe_dream_project/apps/customer-web/src/pages/Home.jsx), find the `BANNERS` array and update the `image` field:

```js
{
  id: 1,
  image: '/uploads/your_poster_name.png',  // ← add your file path here
  bg: 'bg-gradient-to-r from-[#3A2618] via-[#5C3D2E] to-[#8B5E3C]',  // fallback gradient
  title: 'Welcome to Tea Bhatti',
  ...
}
```

---

## Poster 1 — Welcome / Hero Banner

```
A premium cafe-style horizontal banner photograph. An elegant wooden cafe table with warm ambient lighting, showcasing a beautifully arranged spread of gourmet vadapav, artisan burger, and a steaming cup of masala chai in a ceramic cup. Soft bokeh fairy lights in the warm-toned background. The scene has the feel of a cozy upscale Indian cafe interior — exposed brick wall visible in the background, a small succulent plant on the table. Warm golden-hour lighting, soft shadows, shallow depth of field. Shot from a 45-degree angle. Clean space on the left side for text overlay. Professional food photography, editorial quality. Aspect ratio 16:9 wide. No text, no logos.
```

---

## Poster 2 — Combo Meal Offer

```
A sophisticated cafe-style flat-lay photograph of a combo meal on a dark matte ceramic plate placed on a marble cafe table. The combo includes a gourmet veggie burger, golden crispy french fries in a mini basket, and a tall cold coffee milkshake with cream art on top. Overhead shot, symmetrically arranged. Soft warm directional lighting from the upper left. A few scattered fresh herbs and a small sauce bowl as styling props. Premium restaurant presentation. Muted warm tones — cream, brown, gold. Clean space on one side for text overlay. Editorial food photography quality. Wide 16:9 format. No text.
```

---

## Poster 3 — Pizza Special

```
An elegant horizontal photograph of a freshly baked 8-inch vegetarian pizza on a rustic wooden pizza peel, placed on a clean marble countertop in an upscale cafe setting. The pizza has melting mozzarella, colourful capsicum, onion rings, paneer cubes, and fresh basil. One slice is gently pulled away showing stretchy cheese. Warm amber lighting from behind, creating a beautiful backlit glow. Steam gently rising. In the background, a blurred warm cafe interior with pendant lights. Clean, minimal composition. Professional food photography with shallow depth of field. Wide 16:9 format. No text, no logos.
```

---

## Poster 4 — Burger Collection

```
A moody, premium cafe photograph of three artisan veggie burgers arranged in a diagonal line on a long dark slate board. Each burger is slightly different — one with paneer patty and cheese drip, one with crispy aloo patty, one tall king burger with double layers. Warm spot lighting from above creating dramatic shadows. The background is a dark wooden cafe table surface. Small details: a few sesame seeds scattered, a dip bowl of mayo. Clean, sophisticated composition — not cluttered. Editorial restaurant photography style. Muted warm palette. Wide 16:9 format. No text.
```

---

## Poster 5 — Maggie Range

```
A cozy cafe-style photograph of three different bowls of loaded Maggi noodles arranged on a warm wooden tray. One bowl is plain with butter curl on top, one is loaded cheese Maggi with stretchy cheese, one is veggie Maggi with capsicum, onion, and peas. Steaming hot. Shot from a slight overhead angle. Background shows a warm cafe counter with soft ambient lighting and a blurred chalkboard menu. The mood is warm, inviting, and comfort-food oriented. Autumn cafe vibes. Soft, warm colour grading. Professional food photography. Wide 16:9 format. No text.
```

---

## Poster 6 — Vadapav Signature

```
An upscale cafe-style photograph of Tea Bhatti's signature vadapav collection. Three vadapavs displayed elegantly on individual small wooden boards arranged in a row — butter vadapav, cheese butter vadapav, and tandoori vadapav. Each has its own distinct look and garnish. Clean white cafe table background with a small potted plant in the soft-focus background. Natural daylight from a cafe window illuminating the scene. Fresh, bright, and appetising. The presentation is elevated — not street food, but gourmet cafe street food. Minimal, clean composition. Professional editorial photography. Wide 16:9 format. No text.
```

---

## Poster 7 — Pasta Range (Bonus)

```
A refined horizontal photograph of three pasta dishes on a clean cafe table. Red sauce pasta in a white ceramic bowl, cheesy white sauce pasta in a dark bowl, and veggie pasta in a terracotta bowl. Fresh basil leaves and a drizzle of olive oil as garnish. The bowls are arranged in a gentle curve. Warm pendant lighting from above creating a cozy glow. The background shows a blurred cafe interior with warm-toned walls. Clean, sophisticated food styling — restaurant-grade presentation. Warm neutral colour palette. Wide 16:9 format. No text, no logos.
```

---

## Tips for Best Results

1. **Aspect Ratio**: Always specify "wide 16:9 format" or "horizontal banner" in your prompt
2. **No Text**: Always add "No text, no logos" — you'll add your own text via the app's banner overlay
3. **Cafe Aesthetic**: Key words: "upscale cafe", "warm lighting", "premium plating", "editorial photography"
4. **Avoid**: "street food", "stall", "neon", "bright flash" — these kill the cafe vibe
5. **File Size**: After generating, compress the image to under 500KB for fast loading. Use [TinyPNG](https://tinypng.com/) or [Squoosh](https://squoosh.app/)
