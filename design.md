---
version: "alpha"
name: "SaaS Enterprise Analytics"
description: "SaaS Enterprise Analytics — Design thematic com saas landing, analytics dashboard, metrics cards. Template e prompt pronto para IA."
colors:
  primary: "#0F172A"
  secondary: "#1E40AF"
  tertiary: "#3B82F6"
  neutral: "#60A5FA"
  surface: "#FFFFFF"
  accent: "#F8FAFC"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2.5rem
    fontWeight: 700
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
rounded:
  sm: 12px
  md: 24px
  lg: 36px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

SaaS Enterprise Analytics — Design thematic com saas landing, analytics dashboard, metrics cards. Template e prompt pronto para IA. Estilo SaaS Enterprise Analytics representa uma tendência moderna em design UI/UX web com foco em thematic.

- Density: 8/10 — Dense
- Variance: 2/10 — Structured
- Motion: 4/10 — Subtle

- **Style:** Corporate, Clean, Data-Driven
- **Keywords:** SaaS landing, analytics dashboard, metrics cards, corporate blue, b2b, business intelligence, charts, integrations, trust, clean UI, glassmorphism, data visualization
- **Era:** 2020s SaaS
- **Light/Dark:** ✓ Full / ✗ No

## Colors

- **Dark Navy** (#0F172A) — Dark surface, primary background
- **Royal Blue** (#1E40AF) — Accent highlight, links and focus states
- **Blue** (#3B82F6) — Accent highlight, links and focus states
- **Light Blue** (#60A5FA) — Accent highlight, links and focus states
- **White** (#FFFFFF) — Secondary surface
- **Light Grey** (#F8FAFC) — Secondary text, borders, muted elements
- **Dark Grey** (#334155) — Deep contrast surface

## Typography

- **Display / Hero:** Inter — Weight 700, tight tracking, used for headline impact
- **Body:** Inter — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Inter — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## Layout

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).

## Elevation & Depth

Cards com glassmorphism (backdrop-filter: blur), animação de counters com JS, hover shadow suave, glow sutil em CTAs, fade/slide ao scroll.

- **Physics:** Ease-out curves, 200-300ms duration. Smooth and predictable.
- **Entry animations:** Fade + translate-Y (16px → 0) over 420ms ease-out. Staggered cascades for lists: 80ms between items.
- **Hover states:** Subtle color shift + shadow adjustment over 200ms.
- **Page transitions:** Fade only (200ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.

## Shapes

Base corner radius: 12px. See rounded tokens in front matter for the full scale.

## Components

- **Primary Button:** Rounded (12px) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (12px) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.

## Do's and Don'ts

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No pure black (#000000) — use off-black or charcoal variants
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

- Do Navbar + Hero com mockup de dashboard
- Do Features + Integrations
- Do Testimonials + Pricing
- Do Seção de segurança/LGPD
- Do Animações discretas ao scroll
- Do Meta tags SEO
- Do Footer com documentação e suporte
- Do Contraste adequado.

## Use Case

Landing pages, Websites modernas

<!-- Source: https://designmd.app.br/library/saas-enterprise-analytics · designmd.app -->
