# Lesson Page Implementation Guidelines

This document is the canonical implementation contract for the learner-facing lesson page. It complements the content schema in [`content-guidelines.md`](content-guidelines.md), the simulation rules in [`visualization-guidelines.md`](visualization-guidelines.md), and the product goals in [`PRD.md`](PRD.md).

## Learning sequence

The visible page must follow the learning sequence it promises:

```text
lesson context → theory foundation → visualization → deeper analysis → practice → adjacent lesson navigation
```

Use the authored visualization specification as the insertion point. A typical lesson therefore reads:

1. title, description, metadata, prerequisites, and progress;
2. a functional stage navigator;
3. motivation, mental model, mechanics, and a concrete example;
4. the registered interactive visualization;
5. scaling behavior, failures, trade-offs, alternatives, use guidance, misconceptions, and interview lens;
6. the registered quiz or a compact practice-unavailable state;
7. previous and next lesson navigation.

This order gives the learner enough theory to understand the controls, lets the visualization expose behavior before the deeper analysis, and keeps practice at the end of the lesson. Do not put a simulation before its motivating explanation or bury it after the entire article.

## Authoring-only visualization specification

`## Visualization We Eventually Want` is an authoring heading, not learner-facing curriculum. It specifies the behavior, controls, metrics, scenarios, and failures that a future implementation should teach.

- The lesson renderer must remove this section from learner-facing prose.
- When `visualizationId` resolves, render the visualization at that section's authored position.
- When no visualization is registered, keep the surrounding theory continuous. Represent availability in the stage navigator or in a compact state at the relevant stage; never place a large blocking warning before the theory.
- Do not render both the specification and the implemented visualization.
- Do not move the visualization to a generic top or bottom slot that ignores the authored teaching sequence.

The current Markdown heading is retained because existing lessons use it as a stable authoring marker. A future structured MDX marker may replace it only with content migration, validation, and route tests in the same change.

## Desktop layout contract

Desktop web is the primary design target. Validate at 1440 × 1000 and at one common narrower desktop width such as 1366 × 768.

- Give the lesson a broad desktop canvas. The curriculum sidebar may use roughly 15–17rem; the lesson uses the remaining width.
- Do not add a generic third rail when it compresses the lesson or simulation. Put small contextual items such as prerequisites and progress in the lesson header or a compact setup panel.
- Keep prose readable at roughly 68–76 characters per line, but allow tables, diagrams, code, and simulations to use the full lesson-content width.
- The simulation is a first-class lesson stage. Its controls, diagram, explanation, metrics, timeline, and checkpoint must not be forced into the prose column.
- Avoid duplicated descriptions, prerequisites, status, or navigation in multiple rails.
- Mobile and tablet layouts must remain readable, but they must not dictate a squeezed desktop composition. Stack secondary panels at narrower breakpoints.

## Stage navigation

The lesson stepper is navigation, not decoration and not a false completion indicator.

- Each available step links to a real semantic section such as `#theory`, `#visualization`, `#practice`, or `#interview-lens`.
- Disabled or unavailable stages must be clearly identified and must not behave like links.
- Do not label a stage as complete merely because it is earlier in the visual sequence. Completion comes from the progress model.
- Preserve visible keyboard focus and account for sticky headers when scrolling to anchors.

## Simulation composition

On desktop, prefer this hierarchy inside the visualization stage:

1. title, purpose, and current status;
2. primary playback controls and scenario selection;
3. scenario-specific configuration or failure controls;
4. visualization and synchronized text explanation;
5. exact metrics or an accessible table;
6. bounded event timeline;
7. explicit learning checkpoint or completion action.

Use available horizontal space to compare the visual model and its explanation side by side when that improves comprehension. Controls should group by task and should not appear as an undifferentiated toolbar. The visualization must remain understandable without animation or color.

## Unavailable and partial lessons

Theory-only lessons are valid. Missing enhancements must not interrupt reading.

- Never put a quiz or visualization warning between the page header and the theory.
- Keep an unavailable state short, specific, and located at the stage where the feature would appear.
- Do not expose implementation roadmap prose as a substitute UI.
- The page must remain coherent if a client visualization fails to load; the authored theory still carries the concept.

## Accessibility and responsive behavior

- Use semantic sections with stable headings and IDs.
- Native controls, visible labels, keyboard operation, focus states, status text, and reduced-motion behavior are required.
- Diagrams need text equivalents; metrics need exact values; state cannot depend on color alone.
- At narrower widths, stack header setup, controls, visualization/explanation, and metrics without horizontal page overflow.
- Preserve a logical document and focus order when the visual layout changes.

## Focus mode

The global top bar provides a persistent Focus Mode toggle for distraction-free reading.

- Fade the site header content, curriculum sidebar, and breadcrumbs without removing their layout boxes; entering or leaving Focus Mode must not resize or reposition the lesson canvas.
- Keep the exit control visible and keyboard reachable while all other top-bar controls are non-interactive and hidden from navigation.
- Persist the preference locally across navigation and reloads until the learner turns it off.
- Use a short opacity transition and honor reduced-motion preferences.
- Focus Mode changes surrounding chrome only. It must not hide lesson content, progress controls, simulation controls, or practice content.

## Review checklist

Before merging a lesson-page or visualization change:

- confirm the visible order matches theory → visualization → practice;
- confirm the authoring-only visualization specification is not rendered;
- confirm the stage navigator reaches real sections;
- inspect the full page at 1440 × 1000 and 1366 × 768;
- check that the lesson and visualization use available desktop width without overly long prose lines;
- check that controls, diagrams, explanations, metrics, and timelines do not collide or become illegibly narrow;
- verify theory-only and registered-visualization lessons;
- exercise keyboard navigation, reduced motion, loading/error states, and the main simulation controls;
- toggle Focus Mode in both directions, reload once while active, and confirm the lesson geometry does not move;
- capture before/after screenshots for substantial layout changes.

## Anti-patterns

Do not ship:

- a narrow center column surrounded by two low-value sidebars;
- a decorative stepper whose steps do not navigate;
- simulation → theory ordering;
- a visualization duplicated by its authoring specification;
- full-width prose merely because the simulation needs width;
- a simulation constrained to the prose measure;
- repeated lesson metadata in the header and a right rail;
- a large unavailable warning before useful theory;
- desktop layout decisions driven primarily by mobile stacking.
