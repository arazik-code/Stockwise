import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Palette, Pencil, Plus, Receipt, Ruler, Save, Star, Store, Tag, Trash2,
  type LucideIcon,
} from 'lucide-react'
import { categoriesApi, type Category } from '../api/categories'
import { colorsApi } from '../api/colors'
import { sizesApi } from '../api/sizes'
import { settingsApi, type StoreSettingsConfig, type TaxSettingsConfig, type LoyaltySettingsConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import {
  Button, Card, CardDescription, CardFooter, CardHeader, CardTitle, EmptyState,
  IconButton, Input, Page, Skeleton, Switch,
} from '../components/ui'
import type { Color } from '../types/color'
import type { Size } from '../types/size'

/**
 * ══ CONFIG ARCHETYPE - REFERENCE ════════════════════════════════════════════
 *
 * Copy this page's structure for every settings-shaped screen (OnlineSettings,
 * OnlineLink, OnlineSync, ThermalPrinter, AdminRoles...).
 *
 * The archetype is deliberately RECESSIVE. Settings is not a place anyone wants
 * to be - the user came to change one thing and leave - so the page gives up
 * the mesh backdrop, caps chroma at k=0.45 and narrows the measure to 900px
 * (all three come from <Page section="settings"> automatically). What is left
 * is a single column of grouped cards with a lot of air between them.
 *
 * The pattern, in order:
 *   <Page section="settings" title=…>
 *     <Section icon=… title=… description=… footer={<SaveButton/>}>
 *       grouped <Input>/<Switch> rows
 *
 * ── Why the save button is per-section and not one sticky bar ───────────────
 *
 * The archetype note says "sticky save bar", and that is right for a form with
 * one dirty-state. This page is not that: it is six INDEPENDENT self-fetching
 * blocks, each with its own `form`, its own `saving` flag and its own PUT. They
 * load and fail independently. A single sticky bar would have to know which of
 * the six are dirty, which means unsaved-change tracking, which means new state
 * above `return (` - forbidden by the migration contract, and a genuinely bad
 * trade anyway (one bar submitting six endpoints is six ways to half-save).
 *
 * So the save affordance lives in each <CardFooter>, pinned to the block it
 * actually commits. Same recessive look, honest about the architecture.
 */
export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <Page section="settings" title={t('settings.title')} className="local-settings">
      <div className="space-y-5">
        <StoreSettings />
        <TaxSettings />
        <LoyaltySettingsSection />
        <CategorySettings />
        <ColorSettings />
        <SizeSettings />
      </div>
    </Page>
  )
}

function StoreSettings() {
  const { t } = useTranslation()
  const [form, setForm] = useState<StoreSettingsConfig>({ name: 'My Store', phone: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await settingsApi.getStore()
      setForm(data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateStore(form)
      showToast(t('common.success'), 'success')
    } catch { showToast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <Section
    icon={Store}
    title={t('settings.storeInfo')}
    description="Identité de la boutique, telle qu'elle apparaît sur les tickets et les factures."
  >
    <FieldSkeleton rows={3} />
  </Section>

  return (
    <Section
      icon={Store}
      title={t('settings.storeInfo')}
      description="Identité de la boutique, telle qu'elle apparaît sur les tickets et les factures."
      footer={<SaveButton onClick={handleSave} saving={saving} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('settings.storeName')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label={t('settings.phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
      <Field label={t('settings.address')} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
    </Section>
  )
}

function TaxSettings() {
  const { t } = useTranslation()
  const [form, setForm] = useState<TaxSettingsConfig>({ rate: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await settingsApi.getTax()
      setForm(data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateTax(form)
      showToast(t('common.success'), 'success')
    } catch { showToast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <Section
    icon={Receipt}
    title={t('settings.taxRate')}
    description="Appliquée à chaque vente au moment de l'encaissement."
  >
    <FieldSkeleton rows={1} />
  </Section>

  return (
    <Section
      icon={Receipt}
      title={t('settings.taxRate')}
      description="Appliquée à chaque vente au moment de l'encaissement."
      footer={<SaveButton onClick={handleSave} saving={saving} />}
    >
      <div className="flex flex-wrap items-end gap-4">
        <Field
          label={`${t('settings.taxRate')} (%)`}
          type="number"
          value={String(form.rate * 100)}
          onChange={(v) => setForm({ ...form, rate: parseFloat(v) / 100 || 0 })}
          wrapperClassName="w-40"
        />
        <p className="pb-2.5 text-sm text-fg-subtle">
          {form.rate === 0 ? (
            'Aucune taxe'
          ) : (
            <>
              = <span className="num font-medium text-fg">{(form.rate * 100).toFixed(0)}%</span> par vente
            </>
          )}
        </p>
      </div>
    </Section>
  )
}

function LoyaltySettingsSection() {
  const { t } = useTranslation()
  const [form, setForm] = useState<LoyaltySettingsConfig>({
    newClientRate: 5, ancientClientRate: 8, premiumClientRate: 12, pointsForRedemption: 10,
    dhPerRedemption: 1.00, welcomePoints: 50, enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await settingsApi.getLoyalty()
      setForm(data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateLoyalty(form)
      showToast(t('common.success'), 'success')
    } catch { showToast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <Section
    icon={Star}
    title={t('loyalty.title')}
    description="Points attribués par palier de client, et taux de conversion à l'échange."
  >
    <FieldSkeleton rows={3} />
  </Section>

  return (
    <Section
      icon={Star}
      title={t('loyalty.title')}
      description="Points attribués par palier de client, et taux de conversion à l'échange."
      footer={<SaveButton onClick={handleSave} saving={saving} />}
    >
      <div className="rounded-field border border-border bg-sunken px-4 py-3">
        <Switch
          id="loyaltyEnabled"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          label={t('loyalty.enabled')}
          hint="Désactivé, aucun point n'est attribué ni échangeable."
        />
      </div>

      <FieldGroup label="Points gagnés par palier">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('loyalty.newClientRate')} type="number" value={String(form.newClientRate)} onChange={(v) => setForm({ ...form, newClientRate: parseInt(v) || 0 })} />
          <Field label={t('loyalty.ancientClientRate')} type="number" value={String(form.ancientClientRate)} onChange={(v) => setForm({ ...form, ancientClientRate: parseInt(v) || 0 })} />
          <Field label={t('loyalty.premiumClientRate')} type="number" value={String(form.premiumClientRate)} onChange={(v) => setForm({ ...form, premiumClientRate: parseInt(v) || 0 })} />
        </div>
      </FieldGroup>

      <FieldGroup label="Attribution et échange">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('loyalty.welcomePoints')} type="number" value={String(form.welcomePoints)} onChange={(v) => setForm({ ...form, welcomePoints: parseInt(v) || 0 })} />
          <Field label={t('loyalty.pointsForRedemption')} type="number" value={String(form.pointsForRedemption)} onChange={(v) => setForm({ ...form, pointsForRedemption: parseInt(v) || 1 })} />
        </div>
      </FieldGroup>
    </Section>
  )
}

// ─── Categories CRUD ────────────────────────────────────────────

function CategorySettings() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    try { setCategories(await categoriesApi.getAll()) } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      if (editing) {
        await categoriesApi.update(editing.id, { name: name.trim(), description: description.trim() || undefined })
      } else {
        await categoriesApi.create({ name: name.trim(), description: description.trim() || undefined })
      }
      showToast(t('common.success'), 'success')
      setName(''); setDescription(''); setShowAdd(false); setEditing(null)
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`${t('common.delete')} "${cat.name}" ?`)) return
    try {
      await categoriesApi.delete(cat.id)
      showToast(t('common.success'), 'success')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const startEdit = (cat: Category) => {
    setEditing(cat); setName(cat.name); setDescription(cat.description ?? ''); setShowAdd(true)
  }

  return (
    <Section
      icon={Tag}
      title={t('settings.categories')}
      description="Le classement des produits au catalogue."
    >
      <div className="space-y-0.5">
        {categories.length === 0 && (
          <EmptyState
            compact
            icon={Tag}
            title={t('settings.noCategories')}
            description="Ajoutez-en une pour commencer à classer vos produits."
          />
        )}
        {categories.map((cat) => (
          <div key={cat.id} className="group flex items-center justify-between gap-3 rounded-field px-3 py-2 transition-colors duration-fast ease-out-soft hover:bg-surface-2">
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-fg">{cat.name}</span>
              {cat.description && <span className="block truncate text-xs text-fg-subtle">{cat.description}</span>}
            </div>
            <RowActions
              onEdit={() => startEdit(cat)}
              onDelete={() => handleDelete(cat)}
              editLabel={t('common.edit')}
              deleteLabel={t('common.delete')}
            />
          </div>
        ))}
      </div>

      {showAdd ? (
        <EditorPanel
          onCancel={() => { setShowAdd(false); setEditing(null); setName(''); setDescription('') }}
          onSave={handleSave}
          saveLabel={editing ? t('settings.updateCategory') : t('settings.addCategory')}
          cancelLabel={t('common.cancel')}
        >
          <Field label={t('products.name')} value={name} onChange={setName} placeholder="ex. Baskets" />
          <Field label={t('products.description')} value={description} onChange={setDescription} placeholder="Description facultative" />
        </EditorPanel>
      ) : (
        <AddButton onClick={() => setShowAdd(true)} label={t('settings.addCategory')} />
      )}
    </Section>
  )
}

// ─── Color CRUD ─────────────────────────────────────────

function ColorSettings() {
  const { t } = useTranslation()
  const [colors, setColors] = useState<Color[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Color | null>(null)
  const [name, setName] = useState('')
  const [hexCode, setHexCode] = useState('#000000')

  const load = useCallback(async () => {
    try { setColors(await colorsApi.getAll()) } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      if (editing) {
        await colorsApi.update(editing.id, { name: name.trim(), hexCode })
      } else {
        await colorsApi.create({ name: name.trim(), hexCode, sortOrder: colors.length + 1 })
      }
      showToast(t('common.success'), 'success')
      setName(''); setHexCode('#000000'); setShowAdd(false); setEditing(null)
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (color: Color) => {
    if (!confirm(`${t('common.delete')} "${color.name}" ?`)) return
    try {
      await colorsApi.delete(color.id)
      showToast(t('common.success'), 'success')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const startEdit = (color: Color) => {
    setEditing(color); setName(color.name); setHexCode(color.hexCode); setShowAdd(true)
  }

  return (
    <Section
      icon={Palette}
      title={t('settings.colors')}
      description="Les couleurs disponibles pour les variantes de produit."
    >
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <div key={c.id} className="group flex items-center gap-2 rounded-chip border border-border bg-surface-2 py-1 pl-1.5 pr-1.5 transition-colors duration-fast ease-out-soft hover:border-border-strong">
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 rounded-[5px] border border-border-strong shadow-e1"
              style={{ backgroundColor: c.hexCode }}
            />
            <span className="text-xs text-fg-muted">{c.name}</span>
            <RowActions
              onEdit={() => startEdit(c)}
              onDelete={() => handleDelete(c)}
              editLabel={t('common.edit')}
              deleteLabel={t('common.delete')}
            />
          </div>
        ))}
      </div>

      {showAdd ? (
        <EditorPanel
          onCancel={() => { setShowAdd(false); setEditing(null); setName(''); setHexCode('#000000') }}
          onSave={handleSave}
          saveLabel={editing ? t('settings.updateColor') : t('settings.addColor')}
          cancelLabel={t('common.cancel')}
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label={t('settings.colorName')}
              value={name}
              onChange={setName}
              placeholder="ex. Bleu marine"
              wrapperClassName="min-w-[12rem] flex-1"
            />
            <Input
              label={t('settings.preview')}
              type="color"
              value={hexCode}
              onChange={(e) => setHexCode(e.target.value)}
              className="w-12 cursor-pointer p-1"
              wrapperClassName="shrink-0"
            />
            <Input
              aria-label={t('settings.colorName')}
              value={hexCode}
              onChange={(e) => setHexCode(e.target.value)}
              className="num w-28 font-mono uppercase"
              wrapperClassName="shrink-0"
            />
          </div>
        </EditorPanel>
      ) : (
        <AddButton onClick={() => setShowAdd(true)} label={t('settings.addColor')} />
      )}
    </Section>
  )
}

// ─── Size CRUD ──────────────────────────────────────────

function SizeSettings() {
  const { t } = useTranslation()
  const [sizes, setSizes] = useState<Size[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Size | null>(null)
  const [value, setValue] = useState('')

  const load = useCallback(async () => {
    try { setSizes(await sizesApi.getAll()) } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!value.trim()) return
    try {
      if (editing) {
        await sizesApi.update(editing.id, { value: value.trim() })
      } else {
        await sizesApi.create({ value: value.trim(), sortOrder: sizes.length + 1 })
      }
      showToast(t('common.success'), 'success')
      setValue(''); setShowAdd(false); setEditing(null)
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (size: Size) => {
    if (!confirm(`${t('common.delete')} "${size.value}" ?`)) return
    try {
      await sizesApi.delete(size.id)
      showToast(t('common.success'), 'success')
      load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const startEdit = (size: Size) => {
    setEditing(size); setValue(size.value); setShowAdd(true)
  }

  return (
    <Section
      icon={Ruler}
      title={t('settings.sizes')}
      description="Les pointures disponibles pour les variantes de produit."
    >
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => (
          <div key={s.id} className="group flex items-center gap-1.5 rounded-chip border border-border bg-surface-2 py-1 pl-2.5 pr-1.5 transition-colors duration-fast ease-out-soft hover:border-border-strong">
            <span className="num text-xs font-medium text-fg-muted">EU {s.value}</span>
            <RowActions
              onEdit={() => startEdit(s)}
              onDelete={() => handleDelete(s)}
              editLabel={t('common.edit')}
              deleteLabel={t('common.delete')}
            />
          </div>
        ))}
      </div>

      {showAdd ? (
        <EditorPanel
          onCancel={() => { setShowAdd(false); setEditing(null); setValue('') }}
          onSave={handleSave}
          saveLabel={editing ? t('settings.updateSize') : t('settings.addSize')}
          cancelLabel={t('common.cancel')}
        >
          <Field label={t('settings.sizeValue')} value={value} onChange={setValue} placeholder="ex. 46" />
        </EditorPanel>
      ) : (
        <AddButton onClick={() => setShowAdd(true)} label={t('settings.addSize')} />
      )}
    </Section>
  )
}

// ─── Shared Components ──────────────────────────────────────────

/**
 * One settings group.
 *
 * `elevation={1}` rather than the <Card> default of 2: six stacked cards at e2
 * in a 900px column read as a pile of receipts. At e1 the shadow only separates
 * the card from the canvas, which is all it has to do here.
 */
function Section({
  icon: Icon,
  title,
  description,
  children,
  footer,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Card elevation={1}>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <div className="space-y-4">{children}</div>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  )
}

/** A labelled cluster of related fields inside a section. */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </legend>
      {children}
    </fieldset>
  )
}

/**
 * Loading placeholder for a form section.
 *
 * Layout-identical to what it replaces: a 16px label line (label is text-xs
 * with mb-1.5) above a 40px control, which is exactly <Input size="md">.
 */
function FieldSkeleton({ rows = 1 }: { rows?: number }) {
  const widths = ['30%', '22%', '36%']
  return (
    <div className="space-y-4" role="status" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <Skeleton variant="text" className="mb-1.5 h-3" width={widths[i % widths.length]} />
          <Skeleton className="h-10" />
        </div>
      ))}
    </div>
  )
}

/**
 * Text field.
 *
 * Kept as a thin wrapper over <Input> because every call site passes a plain
 * `(value: string) => void`, and unwrapping that to a ChangeEvent at 20 call
 * sites would be churn for no gain.
 */
function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  wrapperClassName,
}: {
  label: string
  type?: string
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  wrapperClassName?: string
}) {
  return (
    <Input
      label={label}
      type={type}
      value={value}
      placeholder={placeholder}
      wrapperClassName={wrapperClassName}
      // Quantities and rates jitter on every keystroke with proportional
      // figures; `num` is tabular-nums.
      className={type === 'number' ? 'num' : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    />
  )
}

/** Edit/delete pair, revealed on hover and on keyboard focus. */
function RowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void
  onDelete: () => void
  editLabel: string
  deleteLabel: string
}) {
  return (
    // focus-within matters: hover-only reveal makes these unreachable by
    // keyboard, which is how the original behaved.
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover:opacity-100">
      <IconButton icon={<Pencil className="h-3.5 w-3.5" />} label={editLabel} size="xs" onClick={onEdit} />
      <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} label={deleteLabel} size="xs" variant="danger-ghost" onClick={onDelete} />
    </div>
  )
}

/** Inline create/edit form, shown in place of the add button. */
function EditorPanel({
  children,
  onCancel,
  onSave,
  saveLabel,
  cancelLabel,
}: {
  children: React.ReactNode
  onCancel: () => void
  onSave: () => void
  saveLabel: string
  cancelLabel: string
}) {
  return (
    <div className="space-y-3 rounded-card border border-[color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[var(--accent-soft)] p-4">
      {children}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
        <Button size="sm" onClick={onSave}>{saveLabel}</Button>
      </div>
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={onClick}>
      {label}
    </Button>
  )
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <Button onClick={onClick} loading={saving} size="sm" icon={<Save className="h-4 w-4" />}>
      Enregistrer
    </Button>
  )
}
