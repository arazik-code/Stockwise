# Migration contract

Binding rules for anyone converting a page to the Luminous Depth design system.

This exists because seven people working in parallel on 21,400 lines of a
**live shoe store's software** will produce seven different designs and at
least one production incident unless the boundaries are written down and
machine-checkable. Every rule below is either enforced by a grep or by a diff.

---

## 1. The Presentation Boundary

**Nothing above `return (` changes.**

Hooks, `useState`, `useEffect`, `useMemo`, `useCallback`, refs, SignalR
subscriptions, keyboard listeners, data fetching, derived values — byte
identical, except for added or removed `import` lines.

If a change above `return (` seems necessary: **stop and escalate.** Do not
make it. There is always a way to restyle without it, and if there genuinely
is not, that is a decision for the foundation owner, not a worker.

Additional invariants:

2. **No handler changes identity, arguments, or call order.** You may move
   where a handler is attached. You may not wrap, debounce, memoise, or re-bind
   it.
3. **No i18n key is invented.** `src/i18n/fr.ts` is the only locale, and a
   missing key renders as the raw key string — in production, in French, in
   front of a paying customer. Reuse an existing key or keep the existing
   literal.
4. **No `api.*` call, request shape, or query parameter changes.**
5. **Conditional-render logic is frozen.** Restyle what is inside a branch;
   never change the condition. `{items.length > 0 && ...}` stays exactly that.
6. **No new npm dependencies.** Anything missing goes to the foundation owner.

### How this is checked

```bash
git diff <base> -- <file> | grep '^[+-]' | sed -n '/return (/q;p'
```

The pre-`return` region of the diff must contain **only import lines**. Ten
seconds per file, and it is the single highest-value control in the project.

---

## 2. Banned patterns

All of these must be **zero** in any file you touch.

| Pattern | Use instead |
|---|---|
| Literal Tailwind colours — `bg-slate-100`, `text-blue-600`, `border-red-200`… | Semantic utilities: `bg-surface`, `text-fg-muted`, `border-border`, `text-accent`, `bg-positive-soft` |
| Raw `<svg>` | `lucide-react` |
| `fixed inset-0 bg-black/…` | `<Modal>` / `<Sheet>` / `<ConfirmDialog>` |
| `<table className=` | `<DataTable>` / `<VirtualTable>` |
| `animate-spin` on a bare div | `<Spinner>` |
| `<Header title=…>` + `flex flex-col h-screen` | `<Page section=… title=…>` |
| `dark:` variant | Nothing. Tokens already resolve per theme. |
| Hardcoded `rounded-lg` / `shadow-md` / `duration-300` | `rounded-card`, `shadow-e2`, `duration-base` |
| Inline hex or `oklch()` in a component | A token |

The banned-colour regex, which is also the burndown metric:

```
(bg|text|border|ring|from|to|via|decoration|outline|divide|shadow|accent|caret|fill|stroke)-(slate|gray|zinc|neutral|stone|blue|emerald|red|amber|green|yellow|cyan|violet|indigo|rose|orange|teal|purple|fuchsia|sky|lime|pink)-\d+
```

**Baseline: 4,377. Target: 0.** It only ever goes down.

---

## 3. Required patterns

- Every page is wrapped in `<Page section="…" title={…}>`. Pick the section
  name from `src/design/sections.ts` — do not add one.
- Import only from `@/components/ui` and `@/design/*`. Never reach into a
  primitive's internals.
- **Every list has three designed states**: loading (`<Skeleton>`), empty
  (`<EmptyState>`), and error (`<ErrorState>` with a retry). The third is the
  one this codebase has always skipped, and with the API down it is the state
  you will actually see most while working.
- Skeletons are **layout-identical** to the content they replace — same
  heights, same gaps. A skeleton that is a different size produces a jump that
  reads worse than no skeleton at all.
- Money, quantities, SKUs and any animated number get the `num` utility
  (`tabular-nums`), or they visibly jitter.
- Every interactive element gets a focus-visible ring — **inherited from the
  primitives**. Do not hand-roll one.
- `npm run build` passes before you hand off. Not "at the end" — after each
  page. `noUnusedLocals` is on and will catch the orphaned imports and dead
  helpers that a large restyle always leaves behind.

---

## 4. Motion

- Use the variants in `src/design/variants.ts`. If a pattern you need is not
  there, it gets **added there and shown on `/design` first** — never invented
  inline. That is what stops 33 pages from each having their own idea of how a
  panel opens.
- Durations come from `duration-fast` / `duration-base` / `duration-slow`
  utilities or `DUR` in `motion.ts`. Never a literal `300ms`.
- **Never animate more than the first ~12 rows of a list**, and never use
  `layout` on table rows. `StockPage` already froze once at ~2,957 rows
  (see the comment at `StockPage.tsx:46`); this redesign makes each row
  heavier, so the margin is thinner than it was.
- Anything that pulses on live data must be throttled (`PULSE_THROTTLE_MS`). A
  SignalR burst during a busy hour otherwise turns the screen into a strobe.

---

## 5. The blur budget

Real `backdrop-filter` is allowed on **six surfaces only**, all fixed or
transient, and at most **three live at once**:

sidebar rail · app header strip · modal/sheet scrim · popover panel ·
toast stack · POS floating cart pill

**Forbidden everywhere else** — table rows, cards inside `overflow:auto`, grid
tiles, list items, stat cards, chart containers. Anything rendered inside a
`.map()` is automatically forbidden.

Use `surface-glass` (faux glass: layered gradient + top highlight + tinted
shadow, zero GPU cost). It is the default for a reason — real glass is roughly
80% highlight and shadow, only 20% blur.

---

## 6. Print surfaces are off limits

`src/utils/printReceipt.ts`, `printInvoice.ts`, `printPackingSlip.ts` and
`printBridge.ts` are **DO NOT TOUCH**. They generate standalone HTML for
physical printers.

The designers' *editors* get the full treatment. Their *preview panes* must
keep emitting byte-identical inline-styled markup, wrapped as a light island:

```tsx
<div data-theme="light" data-perf="lean" className="paper">
```

Because tokens are scoped by `[data-theme]`, that pane stays white paper even
for a dark-mode user, with zero conditional code.

---

## 7. Escalate, do not improvise

Send it to the foundation owner if you hit any of these:

- A primitive is missing, or one needs a new variant
- A status value is not in `status.ts`
- A section is not in `sections.ts`
- A change above `return (` looks unavoidable
- An i18n key you need does not exist
- Anything in `PosPage` / `CheckoutDialog` / `ExchangeDialog` /
  `CashDrawerModal` / `ProductVariantsModal` involving the **Escape key** or
  the global keydown listener

That last one is not caution for its own sake. `PosPage.tsx:105` gates its
global handler on `e.target.tagName ∈ {INPUT, TEXTAREA, SELECT}`, and several
POS modals own Escape while open with PosPage explicitly deferring to them.
Get it wrong and scanning breaks on a live till.
