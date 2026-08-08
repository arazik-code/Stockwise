import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Boxes, Check, Download, Package, Plus, Search, Trash2, Zap,
} from 'lucide-react'
import {
  Avatar, Badge, Button, Card, CardHeader, CardTitle, Checkbox, ConfirmDialog,
  DataTable, DropdownMenu, EmptyState, ErrorState, IconButton, Input, KeyHint,
  Modal, Pagination, ProgressBar, Select, Sheet, Skeleton, SkeletonStats,
  Spinner, StatCard, StatusBadge, StatusDot, Switch, Tabs, Textarea, Tooltip,
  showToast, BarChart, ChartFrame, DonutChart, Sparkline, BreakdownRow, cn,
} from '../components/ui'
import { SECTIONS, SECTION_NAMES, sectionProps, type SectionName } from '../design/sections'
import { ARCHETYPES } from '../design/archetypes'
import { STATUS, STATUS_DOMAINS, TONES, type StatusDomain } from '../design/status'
import { assertMotionTokensInSync, DUR } from '../design/motion'
import { bestForeground, fitChroma, oklchToHex } from '../design/color'
import { ACCENT_L_LIGHT, ACCENT_L_DARK, ACCENT_C_BASE, AA_CONTRAST, DARK_CHROMA_SCALE } from '../design/accent.generated'
import { useThemeStore } from '../store/themeStore'
import type { PerfTier } from '../design/perfProbe'
import type { Density } from '../design/archetypes'

/**
 * Design system showcase - the arbiter and the verification surface.
 *
 * Two jobs:
 *
 * 1. ARBITER. Every pattern in the system is on this page. If a pattern is not
 *    here, a page may not invent it - it gets added to components/ui first and
 *    appears here, which is what stops 33 pages drifting into 33 designs.
 *
 * 2. VERIFICATION. This page has zero API dependency, so it is the only thing
 *    that works fully with the backend down. It re-computes the palette
 *    generator's accessibility gates at runtime, checks the CSS/TS motion
 *    tokens for drift, and carries an FPS meter plus a glass stress test - the
 *    only way to validate the blur budget on the actual POS terminal.
 */

interface DemoRow {
  sku: string
  name: string
  status: string
  qty: number
}

const DEMO_ROWS: DemoRow[] = [
  { sku: 'FLX-001', name: 'Sneaker Runner', status: 'ok', qty: 42 },
  { sku: 'FLX-002', name: 'Derby Cuir', status: 'low', qty: 4 },
  { sku: 'FLX-003', name: 'Sandale Été', status: 'out', qty: 0 },
]

const RAMPS = [
  'ink', 'rose', 'red', 'orange', 'amber', 'lime', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'fuchsia',
]
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/** Live frame-rate meter. Only samples while enabled, to avoid its own cost. */
function useFps(enabled: boolean) {
  const [fps, setFps] = useState(0)
  const [worst, setWorst] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let frames = 0
    let last = performance.now()
    let slowest = 0
    let prev = last

    const tick = (now: number) => {
      frames++
      slowest = Math.max(slowest, now - prev)
      prev = now
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        setWorst(Math.round(slowest))
        frames = 0
        slowest = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  return { fps, worstFrameMs: worst }
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 border-b border-border pb-2">
        <h2 className="text-lg font-bold tracking-tight text-fg">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-fg-subtle">{note}</p>}
      </div>
      {children}
    </section>
  )
}

export default function DesignShowcase() {
  const { theme, setTheme, density, setDensity, perf, setPerf } = useThemeStore()
  const [section, setSection] = useState<SectionName>('dashboard')
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [tab, setTab] = useState('a')
  const [stress, setStress] = useState(0)
  const [fpsOn, setFpsOn] = useState(false)
  const { fps, worstFrameMs } = useFps(fpsOn)

  // ── Gate re-verification, at runtime, using color.ts ──────────────────────
  // The generator asserted these at build time with its own copy of the maths.
  // Recomputing here proves the two implementations agree and that what is in
  // the CSS is what was actually tested.
  const gateResults = useMemo(() => {
    return SECTION_NAMES.map((name) => {
      const s = SECTIONS[name]
      const check = (dark: boolean) => {
        const l = dark ? ACCENT_L_DARK : ACCENT_L_LIGHT
        const c = fitChroma(l, ACCENT_C_BASE * s.k * (dark ? DARK_CHROMA_SCALE : 1), s.h)
        return bestForeground({ l, c, h: s.h })
      }
      const light = check(false)
      const dark = check(true)
      return { name, h: s.h, k: s.k, arch: s.arch, light, dark, pass: light.ratio >= AA_CONTRAST && dark.ratio >= AA_CONTRAST }
    })
  }, [])

  const gateFailures = gateResults.filter((r) => !r.pass)
  const motionDrift = useMemo(() => assertMotionTokensInSync(), [])

  const [cycled, setCycled] = useState<Record<string, number>>({})
  const cycle = (domain: StatusDomain) => {
    const keys = Object.keys(STATUS[domain])
    setCycled((p) => ({ ...p, [domain]: ((p[domain] ?? 0) + 1) % keys.length }))
  }

  return (
    <div {...sectionProps(section)} className="page-mesh min-h-screen bg-canvas">
      {/* ── Control bar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-[color-mix(in_oklab,var(--canvas)_82%,transparent)] px-4 py-3 backdrop-blur-[var(--blur-2)]">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <h1 className="mr-auto text-sm font-bold tracking-tight text-fg">
            Design System · Luminous Depth
          </h1>

          <Select
            size="sm"
            value={section}
            onChange={(e) => setSection(e.target.value as SectionName)}
            wrapperClassName="w-48"
            aria-label="Section"
          >
            {SECTION_NAMES.map((n) => (
              <option key={n} value={n}>
                {n} · H{SECTIONS[n].h} · {SECTIONS[n].arch}
              </option>
            ))}
          </Select>

          <Tabs
            size="sm"
            variant="segmented"
            layoutGroupId="theme"
            value={theme}
            onChange={(v) => setTheme(v as typeof theme)}
            items={[
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
              { value: 'system', label: 'Auto' },
            ]}
          />
          <Tabs
            size="sm"
            variant="segmented"
            layoutGroupId="density"
            value={density}
            onChange={(v) => setDensity(v as Density)}
            items={[
              { value: 'comfortable', label: 'Confort' },
              { value: 'compact', label: 'Compact' },
              { value: 'touch', label: 'Tactile' },
            ]}
          />
          <Tabs
            size="sm"
            variant="segmented"
            layoutGroupId="perf"
            value={perf}
            onChange={(v) => setPerf(v as PerfTier)}
            items={[
              { value: 'full', label: 'Full' },
              { value: 'balanced', label: 'Équil.' },
              { value: 'lean', label: 'Lean' },
            ]}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-12 p-4 sm:p-6">
        {/* ── Self-verification ───────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            data-tone={gateFailures.length ? 'negative' : 'positive'}
            className="flex items-start gap-3 rounded-card border border-[color-mix(in_oklab,var(--tone)_30%,transparent)] bg-[var(--tone-soft)] p-4"
          >
            {gateFailures.length ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone)]" />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone)]" />
            )}
            <div className="text-sm text-[var(--tone-ink)]">
              <p className="font-semibold">
                Contraste des accents · {gateFailures.length ? `${gateFailures.length} ÉCHEC` : 'PASS'}
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                Les {gateResults.length} sections vérifiées à {AA_CONTRAST}:1 dans les deux thèmes,
                recalculées au runtime.
              </p>
            </div>
          </div>

          <div
            data-tone={motionDrift.length ? 'negative' : 'positive'}
            className="flex items-start gap-3 rounded-card border border-[color-mix(in_oklab,var(--tone)_30%,transparent)] bg-[var(--tone-soft)] p-4"
          >
            {motionDrift.length ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone)]" />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone)]" />
            )}
            <div className="text-sm text-[var(--tone-ink)]">
              <p className="font-semibold">
                Tokens de mouvement · {motionDrift.length ? 'DÉRIVE' : 'SYNCHRO'}
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                {motionDrift.length
                  ? motionDrift.map((d) => `${d.token}: CSS ${d.css} vs TS ${d.ts}ms`).join(' · ')
                  : `CSS et motion.ts concordent (base ${DUR.base * 1000}ms).`}
              </p>
            </div>
          </div>
        </div>

        {/* ── Performance ─────────────────────────────────────────────────── */}
        <Section
          id="perf"
          title="Performance"
          note="Le seul moyen de valider le budget de flou sur le vrai terminal POS. Lancez le test, lisez les FPS."
        >
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant={fpsOn ? 'soft' : 'solid'}
                icon={<Zap className="h-4 w-4" />}
                onClick={() => setFpsOn((v) => !v)}
              >
                {fpsOn ? 'Arrêter le compteur' : 'Démarrer le compteur FPS'}
              </Button>
              <Button variant="outline" onClick={() => setStress(stress ? 0 : 500)}>
                {stress ? 'Retirer' : 'Charger'} 500 cartes en verre
              </Button>
              {fpsOn && (
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-fg-subtle">FPS</p>
                    <p
                      className={cn(
                        'num text-2xl font-bold',
                        fps >= 55 ? 'text-[var(--positive)]' : fps >= 30 ? 'text-[var(--caution)]' : 'text-[var(--negative)]'
                      )}
                    >
                      {fps}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-fg-subtle">Pire frame</p>
                    <p className="num text-2xl font-bold text-fg">{worstFrameMs}ms</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-fg-subtle">
                Niveau actuel : <span className="font-semibold text-fg">{perf}</span>
              </p>
            </div>

            {stress > 0 && (
              <div className="mt-4 h-64 overflow-auto rounded-card bg-sunken p-3">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {Array.from({ length: stress }, (_, i) => (
                    <div key={i} className="surface-glass h-16 p-2">
                      <p className="num text-[10px] text-fg-subtle">{i}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Section>

        {/* ── Colour ramps ────────────────────────────────────────────────── */}
        <Section
          id="ramps"
          title="Rampes OKLCH"
          note="Une seule échelle de clarté partagée par toutes les teintes : deux pastilles au même niveau ont le même poids perceptuel par construction. Les chiffres sont le contraste WCAG réel."
        >
          <div className="surface-glass overflow-x-auto p-4">
            <table className="w-full min-w-[900px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-20" />
                  {STEPS.map((s) => (
                    <th key={s} className="num pb-1 text-[10px] font-semibold text-fg-subtle">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RAMPS.map((ramp) => (
                  <tr key={ramp}>
                    <td className="pr-2 text-right text-xs font-medium text-fg-muted">{ramp}</td>
                    {STEPS.map((step) => (
                      <td key={step}>
                        <div
                          className="flex h-11 items-center justify-center rounded-inset text-[9px] font-semibold"
                          style={{
                            background: `var(--${ramp}-${step})`,
                            color: step >= 600 ? '#fff' : 'var(--ink-950)',
                          }}
                          title={`--${ramp}-${step}`}
                        >
                          {step === 600 || step === 500 ? step : ''}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Section hues + gate table ───────────────────────────────────── */}
        <Section
          id="sections"
          title="Identité par section"
          note="La teinte dit où vous êtes dans le métier ; l'archétype dit quel travail l'écran fait. Chaque accent est vérifié à 4.5:1 dans les deux thèmes."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gateResults.map((r) => {
              const l = ACCENT_L_LIGHT
              const c = fitChroma(l, ACCENT_C_BASE * r.k, r.h)
              return (
                <button
                  key={r.name}
                  onClick={() => setSection(r.name)}
                  {...sectionProps(r.name)}
                  className={cn(
                    'flex items-center gap-3 rounded-card border p-3 text-left transition-shadow',
                    'border-border bg-surface hover:shadow-e2',
                    section === r.name && 'ring-2 ring-[var(--accent-ring)]'
                  )}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-[10px] font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    {r.h}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-fg">{r.name}</p>
                    <p className="truncate text-[10px] text-fg-subtle">
                      {r.arch} · k {r.k} · {oklchToHex({ l, c, h: r.h })}
                    </p>
                    <p className="num text-[10px] text-fg-subtle">
                      L {r.light.ratio.toFixed(2)} · D {r.dark.ratio.toFixed(2)}
                      {r.pass ? '' : ' ⚠'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Tones ───────────────────────────────────────────────────────── */}
        <Section
          id="tones"
          title="Tons"
          note="Neuf tons couvrent l'intégralité du système de statuts : ~70 valeurs réparties sur 16 domaines s'y résolvent."
        >
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <div key={tone} className="flex items-center gap-2 rounded-card border border-border bg-surface p-3">
                <StatusDot tone={tone} />
                <Badge tone={tone}>{tone}</Badge>
                <Badge tone={tone} variant="solid">
                  solid
                </Badge>
                <Badge tone={tone} variant="outline">
                  outline
                </Badge>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Status registry ─────────────────────────────────────────────── */}
        <Section
          id="status"
          title="Registre des statuts"
          note="Cliquez « Cycler » : l'anneau clignote en vert quand le statut avance dans son cycle de vie, en ambre quand il recule. C'est le rang, pas la couleur, qui décide."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {STATUS_DOMAINS.map((domain) => {
              const keys = Object.keys(STATUS[domain])
              const idx = cycled[domain] ?? 0
              return (
                <Card key={domain} padded>
                  <CardHeader>
                    <CardTitle>{domain}</CardTitle>
                    <Button size="xs" variant="outline" onClick={() => cycle(domain)}>
                      Cycler
                    </Button>
                  </CardHeader>
                  <div className="mb-3 flex min-h-8 items-center gap-2">
                    <StatusBadge domain={domain} value={keys[idx]} size="md" showDot />
                    <span className="num text-[10px] text-fg-subtle">
                      {idx + 1}/{keys.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {keys.map((k) => (
                      <StatusBadge key={k} domain={domain} value={k} animate={false} size="xs" />
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </Section>

        {/* ── Buttons ─────────────────────────────────────────────────────── */}
        <Section id="buttons" title="Boutons" note="La couleur vient de --accent, héritée de la section. Aucun prop de couleur.">
          <Card>
            <div className="space-y-4">
              {(['solid', 'soft', 'outline', 'ghost', 'danger', 'success'] as const).map((v) => (
                <div key={v} className="flex flex-wrap items-center gap-2">
                  <span className="w-20 text-xs font-medium text-fg-subtle">{v}</span>
                  <Button variant={v} size="xs">XS</Button>
                  <Button variant={v} size="sm">SM</Button>
                  <Button variant={v} size="md" icon={<Plus className="h-4 w-4" />}>Avec icône</Button>
                  <Button variant={v} size="lg">LG</Button>
                  <Button variant={v} loading>Chargement</Button>
                  <Button variant={v} disabled>Désactivé</Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 text-xs font-medium text-fg-subtle">icônes</span>
                <IconButton icon={<Trash2 className="h-4 w-4" />} label="Supprimer" variant="danger-ghost" />
                <IconButton icon={<Download className="h-4 w-4" />} label="Télécharger" variant="outline" />
                <Tooltip content="Infobulle accessible au clavier">
                  <IconButton icon={<Search className="h-4 w-4" />} label="Rechercher" />
                </Tooltip>
                <DropdownMenu
                  trigger={<Button variant="outline" size="sm">Menu</Button>}
                  items={[
                    { label: 'Modifier', icon: <Plus className="h-4 w-4" /> },
                    { label: 'Dupliquer' },
                    { label: 'Supprimer', danger: true, separatorBefore: true, icon: <Trash2 className="h-4 w-4" /> },
                  ]}
                />
                <KeyHint keys={['Ctrl', 'G']} />
              </div>
            </div>
          </Card>
        </Section>

        {/* ── Forms ───────────────────────────────────────────────────────── */}
        <Section
          id="forms"
          title="Formulaires"
          note="Chaque contrôle enveloppe un élément natif — le gestionnaire clavier du POS teste tagName, un faux select casserait le scan en caisse."
        >
          <Card>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="Champ texte" placeholder="Rechercher…" leading={<Search />} />
              <Input label="Avec erreur" defaultValue="abc" error="Ce champ est invalide" />
              <Input label="Désactivé" placeholder="Indisponible" disabled />
              <Select label="Liste déroulante" defaultValue="1">
                <option value="1">Option une</option>
                <option value="2">Option deux</option>
              </Select>
              <Textarea label="Zone de texte" hint="Optionnel" placeholder="Notes…" />
              <div className="space-y-3">
                <Checkbox label="Case à cocher" defaultChecked />
                <Checkbox label="Indéterminée" indeterminate />
                <Switch label="Interrupteur" hint="Avec description" defaultChecked />
              </div>
            </div>
          </Card>
        </Section>

        {/* ── Overlays ────────────────────────────────────────────────────── */}
        <Section id="overlays" title="Surcouches" note="Portées dans <body>, avec piège de focus. closeOnEsc est FAUX par défaut pour protéger le POS.">
          <Card>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModalOpen(true)}>Ouvrir un modal</Button>
              <Button variant="outline" onClick={() => setSheetOpen(true)}>Ouvrir un panneau</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirmation</Button>
              <Button variant="soft" onClick={() => showToast('Opération réussie', 'success')}>Toast succès</Button>
              <Button variant="soft" onClick={() => showToast('Une erreur est survenue', 'error')}>Toast erreur</Button>
              <Button
                variant="soft"
                onClick={() =>
                  showToast('Vente enregistrée', 'info', {
                    action: { label: 'Annuler', onClick: () => showToast('Annulé', 'warning') },
                  })
                }
              >
                Toast avec action
              </Button>
            </div>
          </Card>
        </Section>

        {/* ── Data ────────────────────────────────────────────────────────── */}
        <Section id="data" title="Données" note="Le cadre est généreux, les lignes sont denses. Changez la densité en haut de page pour le voir.">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Chiffre d'affaires" numericValue={47320} format={(v) => `${Math.round(v).toLocaleString('fr-FR')} DH`} sub="Aujourd'hui" delta={12.4} icon={Boxes} />
              <StatCard label="Commandes" numericValue={128} sub="18 en attente" delta={-3.2} icon={Package} />
              <StatCard label="Remboursements" numericValue={7} delta={-18} invertDelta icon={AlertTriangle} tone="caution" />
              <StatCard label="Chargement" value="—" loading />
            </div>

            <DataTable<DemoRow>
              columns={[
                { key: 'sku', header: 'SKU', render: (r) => <span className="num">{r.sku}</span> },
                { key: 'name', header: 'Produit', render: (r) => r.name, sortable: true },
                { key: 'status', header: 'Statut', render: (r) => <StatusBadge domain="stockLevel" value={r.status} animate={false} /> },
                { key: 'qty', header: 'Quantité', numeric: true, render: (r) => r.qty },
              ]}
              data={DEMO_ROWS}
              keyField={(r) => r.sku}
              sort={{ key: 'name', dir: 'asc' }}
              onSortChange={() => {}}
            />

            <Pagination page={2} pageCount={9} total={430} pageSize={50} onChange={() => {}} />
          </div>
        </Section>

        {/* ── Charts ──────────────────────────────────────────────────────── */}
        <Section id="charts" title="Graphiques" note="SVG écrit à la main sur des échelles visx, pour que --accent, les dégradés et le halo suivent la section.">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Ventes · 7 derniers jours" height={220}>
              {(w) => (
                <BarChart
                  width={w}
                  height={220}
                  format={(v) => `${v} DH`}
                  data={[
                    { label: 'Lun', value: 3200 }, { label: 'Mar', value: 4100 },
                    { label: 'Mer', value: 2800 }, { label: 'Jeu', value: 5200 },
                    { label: 'Ven', value: 6100 }, { label: 'Sam', value: 7400 },
                    { label: 'Dim', value: 3900 },
                  ]}
                />
              )}
            </ChartFrame>

            <ChartFrame title="Moyens de paiement" height={220}>
              {() => (
                <DonutChart
                  centerValue="1 284"
                  centerLabel="transactions"
                  data={[
                    { label: 'Espèces', value: 712 },
                    { label: 'Carte', value: 402 },
                    { label: 'En ligne', value: 170 },
                  ]}
                />
              )}
            </ChartFrame>

            <Card>
              <CardHeader><CardTitle>Répartition par catégorie</CardTitle></CardHeader>
              <div className="space-y-3">
                <BreakdownRow label="Sneakers" value={18400} total={42000} format={(v) => `${v.toLocaleString('fr-FR')} DH`} meta="· 210" />
                <BreakdownRow label="Derbies" value={12100} total={42000} format={(v) => `${v.toLocaleString('fr-FR')} DH`} meta="· 96" />
                <BreakdownRow label="Sandales" value={7300} total={42000} format={(v) => `${v.toLocaleString('fr-FR')} DH`} meta="· 143" />
                <BreakdownRow label="Accessoires" value={4200} total={42000} format={(v) => `${v.toLocaleString('fr-FR')} DH`} meta="· 320" />
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sparkline &amp; progression</CardTitle></CardHeader>
              <div className="space-y-4">
                <Sparkline values={[3, 7, 5, 9, 6, 11, 8, 14, 12, 18]} width={240} height={44} />
                <ProgressBar value={68} label="Synchronisation Shopify" showValue />
                <ProgressBar value={32} tone="caution" label="Stock faible" showValue />
                <ProgressBar value={40} indeterminate label="Import en cours" />
              </div>
            </Card>
          </div>
        </Section>

        {/* ── States ──────────────────────────────────────────────────────── */}
        <Section
          id="states"
          title="États"
          note="Chargement, vide ET erreur. Le troisième est celui que ce code n'a jamais eu — et avec l'API coupée, c'est celui que vous verrez le plus."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Card padded={false}>
              <EmptyState
                title="Aucun produit"
                description="Ajoutez votre premier produit pour commencer."
                action={<Button size="sm" icon={<Plus className="h-4 w-4" />}>Nouveau produit</Button>}
              />
            </Card>
            <Card padded={false}>
              <EmptyState variant="search" title="Aucun résultat" description="Essayez d'élargir votre recherche." />
            </Card>
            <Card padded={false}>
              <ErrorState detail="Le serveur n'a pas répondu." onRetry={() => showToast('Nouvelle tentative…', 'info')} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Squelettes</p>
              <SkeletonStats count={2} />
            </div>
            <div className="flex items-center gap-6">
              <Spinner size="xs" /><Spinner size="sm" /><Spinner size="md" /><Spinner size="lg" />
              <Avatar name="Yassine Alaoui" size="sm" />
              <Avatar name="Fatima Zahra" size="md" />
              <Avatar name="Omar B" size="lg" />
            </div>
          </div>
        </Section>

        {/* ── Tabs + archetypes ───────────────────────────────────────────── */}
        <Section id="tabs" title="Onglets" note="L'indicateur actif glisse entre les onglets via un layoutId partagé.">
          <Card>
            <div className="space-y-5">
              {(['underline', 'segmented', 'pill'] as const).map((variant) => (
                <Tabs
                  key={variant}
                  variant={variant}
                  layoutGroupId={variant}
                  value={tab}
                  onChange={setTab}
                  items={[
                    { value: 'a', label: 'Vue d\'ensemble' },
                    { value: 'b', label: 'Produits', badge: 12 },
                    { value: 'c', label: 'Journalier' },
                  ]}
                />
              ))}
            </div>
          </Card>
        </Section>

        <Section id="archetypes" title="Archétypes" note="Six manières de travailler. C'est l'archétype, plus que la teinte, qui donne son identité à une section.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ARCHETYPES).map(([name, a]) => (
              <Card key={name}>
                <CardHeader><CardTitle>{name}</CardTitle></CardHeader>
                <p className="text-xs text-fg-muted">{a.note}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge size="xs">densité {a.density}</Badge>
                  <Badge size="xs" tone={a.glass ? 'info' : 'caution'}>{a.glass ? 'verre' : 'opaque'}</Badge>
                  {a.mesh && <Badge size="xs" tone="special">mesh</Badge>}
                  <Badge size="xs" tone="neutral">{a.entrance}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <div className="h-16" />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Exemple de modal"
        description="Portalisé, piège de focus, verrouillage du défilement, animation de sortie."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={() => setModalOpen(false)}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nom" placeholder="Nom du produit" />
          <Select label="Catégorie"><option>Sneakers</option><option>Derbies</option></Select>
          <p className="text-xs text-fg-subtle">
            Tab reste piégé dans ce panneau. Escape ne le ferme PAS par défaut — voir la note
            dans Modal.tsx sur le gestionnaire clavier du POS.
          </p>
        </div>
      </Modal>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Panneau latéral" side="right">
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <p className="text-sm text-fg-muted">Même piège de focus et même politique Escape que le modal.</p>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); showToast('Supprimé', 'success') }}
        variant="danger"
        title="Supprimer ce produit ?"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
      />
    </div>
  )
}
