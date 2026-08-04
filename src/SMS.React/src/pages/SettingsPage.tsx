import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import { categoriesApi, type Category } from '../api/categories'
import { colorsApi } from '../api/colors'
import { sizesApi } from '../api/sizes'
import { settingsApi, type StoreSettingsConfig, type TaxSettingsConfig, type LoyaltySettingsConfig } from '../api/clients'
import { showToast } from '../components/shared/Toast'
import type { Color } from '../types/color'
import type { Size } from '../types/size'

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col flex-1">
      <Header title={t('settings.title')} />
      <div className="p-6 flex-1 space-y-8 max-w-4xl">
        <StoreSettings />
        <TaxSettings />
        <LoyaltySettingsSection />
        <CategorySettings />
        <ColorSettings />
        <SizeSettings />
      </div>
    </div>
  )
}

function StoreSettings() {
  const { t } = useTranslation()
  const [form, setForm] = useState<StoreSettingsConfig>({ name: 'Shoe Store', phone: '', address: '' })
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

  if (loading) return <Section title={t('settings.storeInfo')} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}>
    <p className="text-sm text-slate-400">{t('common.loading')}</p>
  </Section>

  return (
    <Section title={t('settings.storeInfo')} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('settings.storeName')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label={t('settings.phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
      <Field label={t('settings.address')} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
      <SaveButton onClick={handleSave} saving={saving} />
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

  if (loading) return <Section title={t('settings.taxRate')} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}>
    <p className="text-sm text-slate-400">{t('common.loading')}</p>
  </Section>

  return (
    <Section title={t('settings.taxRate')} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}>
      <div className="flex items-end gap-4">
        <Field label={`${t('settings.taxRate')} (%)`} type="number" value={String(form.rate * 100)} onChange={(v) => setForm({ ...form, rate: parseFloat(v) / 100 || 0 })} />
        <div className="text-sm text-slate-500 pb-2.5">= {form.rate === 0 ? 'Aucune taxe' : `${(form.rate * 100).toFixed(0)}%`}</div>
      </div>
      <SaveButton onClick={handleSave} saving={saving} />
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

  if (loading) return <Section title={t('loyalty.title')} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}>
    <p className="text-sm text-slate-400">{t('common.loading')}</p>
  </Section>

  return (
    <Section title={t('loyalty.title')} icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}>
      <div className="grid grid-cols-3 gap-4">
        <Field label={t('loyalty.newClientRate')} type="number" value={String(form.newClientRate)} onChange={(v) => setForm({ ...form, newClientRate: parseInt(v) || 0 })} />
        <Field label={t('loyalty.ancientClientRate')} type="number" value={String(form.ancientClientRate)} onChange={(v) => setForm({ ...form, ancientClientRate: parseInt(v) || 0 })} />
        <Field label={t('loyalty.premiumClientRate')} type="number" value={String(form.premiumClientRate)} onChange={(v) => setForm({ ...form, premiumClientRate: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('loyalty.welcomePoints')} type="number" value={String(form.welcomePoints)} onChange={(v) => setForm({ ...form, welcomePoints: parseInt(v) || 0 })} />
        <Field label={t('loyalty.pointsForRedemption')} type="number" value={String(form.pointsForRedemption)} onChange={(v) => setForm({ ...form, pointsForRedemption: parseInt(v) || 1 })} />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="loyaltyEnabled"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
        />
        <label htmlFor="loyaltyEnabled" className="text-sm font-medium text-slate-700">{t('loyalty.enabled')}</label>
      </div>
      <SaveButton onClick={handleSave} saving={saving} />
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
    <Section title={t('settings.categories')} icon={
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
    }>
      <div className="space-y-1 mb-4">
        {categories.length === 0 && <p className="text-sm text-slate-400">{t('settings.noCategories')}</p>}
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50 group">
            <div>
              <span className="text-sm font-medium text-slate-900">{cat.name}</span>
              {cat.description && <span className="text-xs text-slate-400 ml-2">{cat.description}</span>}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(cat)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={() => handleDelete(cat)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="border border-slate-200 rounded-md p-4 space-y-3">
          <Field label={t('products.name')} value={name} onChange={setName} placeholder="e.g. Sneakers" />
          <Field label={t('products.description')} value={description} onChange={setDescription} placeholder="Optional description" />
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setEditing(null); setName(''); setDescription('') }} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
              {editing ? t('settings.updateCategory') : t('settings.addCategory')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('settings.addCategory')}
        </button>
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
    <Section title={t('settings.colors')} icon={
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
    }>
      <p className="text-xs text-slate-400 mb-3">Define colors available for product variants.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {colors.map((c) => (
          <div key={c.id} className="group relative flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-md">
            <div className="w-4 h-4 rounded-sm border border-slate-200 flex-shrink-0" style={{ backgroundColor: c.hexCode }} />
            <span className="text-xs text-slate-700">{c.name}</span>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <button onClick={() => startEdit(c)} className="p-0.5 text-slate-400 hover:text-blue-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={() => handleDelete(c)} className="p-0.5 text-slate-400 hover:text-red-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="border border-slate-200 rounded-md p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label={t('settings.colorName')} value={name} onChange={setName} placeholder="e.g. Navy Blue" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('settings.preview')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hexCode}
                  onChange={(e) => setHexCode(e.target.value)}
                  className="w-9 h-9 border border-slate-200 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={hexCode}
                  onChange={(e) => setHexCode(e.target.value)}
                  className="w-24 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setEditing(null); setName(''); setHexCode('#000000') }} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
              {editing ? t('settings.updateColor') : t('settings.addColor')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('settings.addColor')}
        </button>
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
    <Section title={t('settings.sizes')} icon={
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
    }>
      <p className="text-xs text-slate-400 mb-3">Define sizes available for product variants.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {sizes.map((s) => (
          <div key={s.id} className="group relative flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
            <span className="text-xs font-medium text-slate-700">EU {s.value}</span>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <button onClick={() => startEdit(s)} className="p-0.5 text-slate-400 hover:text-blue-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={() => handleDelete(s)} className="p-0.5 text-slate-400 hover:text-red-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="border border-slate-200 rounded-md p-4 space-y-3">
          <Field label={t('settings.sizeValue')} value={value} onChange={setValue} placeholder="e.g. 46" />
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setEditing(null); setValue('') }} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
              {editing ? t('settings.updateSize') : t('settings.addSize')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('settings.addSize')}
        </button>
      )}
    </Section>
  )
}

// ─── Shared Components ──────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, type = 'text', ...props }: { label: string; type?: string; value?: string; onChange?: (v: string) => void; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
        {...props}
        onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
      />
    </div>
  )
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {saving ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      )}
      Enregistrer
    </button>
  )
}
