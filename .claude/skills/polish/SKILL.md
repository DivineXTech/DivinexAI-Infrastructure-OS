---
name: polish
description: Pre-ship UI polish sweep that tightens typography, color, spacing, layout, and motion in UI code (React, Vue, Svelte, HTML/CSS, Tailwind, or any other framework found in the target files) and applies the fixes directly rather than just listing them. Use this whenever the user invokes /polish, asks to "polish the UI," "make this look less AI-generated," "fix the generic look," "tighten this up before shipping," or is about to ship a screen/component/page and wants it to read as deliberately designed rather than default-generated. Trigger even if they only name a file, component, or "the current changes" without using the word "polish" explicitly, as long as the intent is visual refinement of UI code.
---

# Polish

A quick, brutal pass over UI code to strip out the "a machine made this" tells: default font
stacks, off-the-shelf gradients, inconsistent spacing, no motion (or motion with no easing curve
behind it), and layouts that are technically correct but visually flat. The goal is not a redesign
— it's tightening what's already there so it reads as considered rather than generated.

Unlike a code review that reports findings for a human to act on, `/polish` **applies the fixes
directly** to the files it touches. Treat this the same way `/simplify` treats cleanup: read, fix,
move on. Only stop and explain instead of fixing when a change would alter behavior, break a test,
or requires a decision only the user can make (e.g. picking a brand color from nothing).

## Step 1: Determine the target

Figure out what to polish, in this order:

1. **An explicit argument** — a path, component name, or glob passed to the command. Polish
   exactly that.
2. **The current diff** — if there's no argument, run `git diff` (and `git diff --cached` if the
   working tree is clean but there's staged work) and polish the UI-relevant files that changed.
   This is the common case: someone just built a screen and wants it tightened before opening a PR.
3. **Nothing changed and nothing was specified** — ask the user what to target rather than
   guessing at a whole codebase sweep. A repo-wide polish is a much bigger, slower operation than
   what `/polish` is for, and silently doing it would surprise them.

Within the target, only touch files that actually render or style UI: component files, templates,
stylesheets, Tailwind class strings, design tokens, theme config. Skip business logic, tests, and
backend code even if they're part of the same diff — polishing isn't the place to touch behavior.

This repo currently has almost no code in it, so there may be nothing to find yet. If the target
resolves to no UI files, say so plainly rather than inventing changes — don't scaffold a UI just to
have something to polish.

## Step 2: Identify the framework and existing conventions

Before changing anything, work out what you're actually editing: plain HTML/CSS, Tailwind
utility classes, CSS-in-JS, a component library's theme tokens, styled-components, Vue SFC
`<style>` blocks, etc. Look for an existing design system first — a `tailwind.config`, a tokens
file, a theme provider, CSS custom properties. If one exists, polish *within* it (use its spacing
scale, its color tokens, its type scale) rather than inventing a parallel one. A polish pass that
introduces its own one-off values is just adding new tells instead of removing old ones.

If no system exists yet, it's fine to introduce a light, consistent scale as part of the fix (e.g.
a spacing rhythm of 4/8/12/16/24/32px, or `text-sm/base/lg/xl` if Tailwind is present) — just keep
it minimal and derived from what's already being used most, not a new framework bolted on.

## Step 3: Sweep each category

Go through the target file by file. For each one, check it against these five areas. Not every
file will have issues in every category — only fix what's actually there.

### Typography
- Collapse redundant or near-duplicate font sizes/weights into a real scale. Three components
  using `15px`, `16px`, and `16.5px` for what's functionally the same text is noise, not intent.
- Fix line-height that's too tight for body text (cramped, hard to read) or too loose for
  headings (disconnected from what they're labeling).
- Make sure there's an actual hierarchy — heading, subheading, body, caption should be
  visually distinct, not all rendering at nearly the same weight and size.
- Watch for the default-stack tell: unstyled system fonts with no weight variation reads as
  untouched. If the project has a font already loaded, use it consistently instead of letting
  some elements fall back to the browser default.

### Color
- Flag low-contrast text (light gray on white, low-contrast pairs) — this is both a taste
  problem and an accessibility one, so treat it as a real fix, not a nitpick.
- Collapse near-duplicate hues used for the same purpose (three slightly different grays for
  borders, two slightly different blues for links) into one, using existing tokens if any exist.
- Check that color carries meaning — error states are actually a distinct error color, not the
  same blue as everything else; a primary action doesn't share its color with a disabled one.
- Generic default gradients (the diagonal purple-to-blue that shows up in every AI-generated
  landing page) are a tell on their own — either commit to a gradient that relates to the actual
  brand/content, or drop it for a flat color if nothing grounds the choice.

### Spacing
- Snap arbitrary spacing values (`13px`, `22px`, `7px`) onto the project's scale (or the
  scale you introduced in Step 2). Inconsistent spacing is one of the fastest ways a UI reads as
  unconsidered.
- Fix alignment drift — elements that are almost but not quite aligned to a shared edge or
  baseline.
- Check whitespace rhythm around groups of elements: related items should sit closer together
  than unrelated ones (proximity implies relationship); if everything has identical gaps,
  grouping is invisible.

### Layout
- Check grid/flex usage is consistent — mixed units, inconsistent column counts, or ad hoc
  absolute positioning where a grid would hold the structure together.
- Verify responsive behavior isn't just "shrink everything" — check that breakpoints actually
  reflow content sensibly rather than squishing a desktop layout into a phone width.
- Look for visual imbalance: a wall of content on one side and empty space on the other with no
  reason for it, oversized containers around small amounts of content, etc.

### Motion
- No motion at all is itself a tell — state changes (hover, open/close, load) that just snap
  read as unfinished. Add transitions where a state change would benefit from one, but don't
  animate everything indiscriminately.
- Check easing: default `linear` or no easing curve specified reads mechanical. Prefer
  ease-out for things entering/appearing and ease-in for things leaving, or a shared custom
  cubic-bezier if the project already has one defined, so motion feels like it has real physical
  intent behind it rather than being the platform default.
- Keep durations sane for the size of the change — a small hover state should be fast
  (~100-150ms); a larger transition (panel open, page transition) can run longer, but a slow
  transition on a tiny element reads sluggish, and a snap-fast transition on a large element
  reads broken.

## Step 4: Apply the fixes

Edit the files directly as you go through them — don't collect a list and present it for
approval first. This mirrors how `/simplify` operates: the value of this skill is in shipping a
tightened result, not in producing a report. If you're unsure whether a change is safe (e.g. it
touches something that looks like it might be tested, or a color choice needs actual brand input
you don't have), skip that one specific change and note why, but keep fixing everything else.

## Step 5: Summarize what changed

After the sweep, give a short summary grouped by category (Typography / Color / Spacing / Layout
/ Motion), listing only the categories where something was actually changed, with file:line
references. Skip categories with nothing to report — an empty "Motion: no changes" line adds
nothing. If anything was intentionally skipped in Step 4, call it out here so the user knows it
still needs a human decision.
