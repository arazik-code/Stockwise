import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'
import { SECTIONS, sectionProps, type SectionName } from '../../design/sections'
import { ARCHETYPES } from '../../design/archetypes'

/**
 * Page wrapper.
 *
 * Replaces this triplet, currently repeated in all 33 pages:
 *
 *     <div className="flex flex-col h-screen">
 *       <Header title={...} actions={...} />
 *       <div className="flex-1 overflow-auto p-6">
 *
 * ── Why the chrome is PORTALLED rather than rendered inline ─────────────────
 *
 * Route transitions are impossible while every page renders its own <Header>
 * inside its own `h-screen` wrapper. Two things break: the header cross-fades
 * along with the body (so the whole app appears to flicker on every
 * navigation), and during the transition two `h-screen` elements overlap,
 * producing a double scrollbar and a visible jump.
 *
 * So MainLayout owns a single sticky <header id="page-chrome"> and a single
 * scroll root, and Page portals its title and actions into that header.
 *
 * A React portal keeps the portalled node in the REACT tree even though it
 * moves in the DOM tree, so `actions` retain their event handlers, their
 * context, and i18n. Nothing about how a page declares its actions changes.
 *
 * ── What data-section buys ──────────────────────────────────────────────────
 *
 * One attribute plus three custom properties, and every descendant inherits
 * the section's accent, its shadow hue, its density and its archetype. A
 * <Button> inside <Page section="stock"> is cyan-teal with a cyan shadow; the
 * same <Button> inside <Page section="invoices"> is violet. No props, no
 * config, no per-page theming code.
 */

export interface PageProps {
  section: SectionName
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /**
   * Fill the viewport instead of scrolling the page.
   *
   * For the three screens that genuinely need it: PosPage and the two
   * designers use fixed split panels that must not scroll as a whole.
   */
  fill?: boolean
  /** Override the archetype default. */
  density?: 'comfortable' | 'compact' | 'touch'
  /** Drop the archetype's max-width and padding; the page handles its own. */
  bare?: boolean
  className?: string
  contentClassName?: string
}

export function Page({
  section,
  title,
  subtitle,
  actions,
  children,
  fill,
  density,
  bare,
  className,
  contentClassName,
}: PageProps) {
  const def = SECTIONS[section]
  const arch = ARCHETYPES[def.arch]
  const [chromeHost, setChromeHost] = useState<HTMLElement | null>(null)

  // The header host is rendered by MainLayout. Resolve it after mount so the
  // portal target exists; standalone pages (login) have no host and simply
  // render their own heading instead.
  useEffect(() => {
    setChromeHost(document.getElementById('page-chrome'))
  }, [])

  const forcedDark = 'forceDark' in def && def.forceDark

  return (
    <div
      {...sectionProps(section)}
      data-archetype={def.arch}
      data-density={density ?? arch.density}
      // The health board is a permanently dark island regardless of app theme.
      // Because tier-2 tokens are scoped by [data-theme], this needs no
      // conditional styling anywhere downstream - it just resolves dark.
      data-theme={forcedDark ? 'dark' : undefined}
      className={cn(
        'min-h-full',
        arch.mesh && 'page-mesh',
        arch.mesh && arch.meshLive && 'page-mesh-live',
        forcedDark && 'bg-canvas text-fg',
        fill && 'flex h-full flex-col overflow-hidden',
        className
      )}
    >
      {chromeHost &&
        (title || actions) &&
        createPortal(
          <PageChrome section={section} title={title} subtitle={subtitle} actions={actions} />,
          chromeHost
        )}

      <div
        className={cn(
          fill ? 'flex min-h-0 flex-1 flex-col' : '',
          !bare && arch.pad,
          !bare && arch.maxWidth && 'mx-auto w-full',
          contentClassName
        )}
        style={!bare && arch.maxWidth ? { maxWidth: arch.maxWidth } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

/** Rendered into MainLayout's sticky header slot. */
function PageChrome({
  section,
  title,
  subtitle,
  actions,
}: {
  section: SectionName
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  const localLabels: Partial<Record<SectionName, string>> = {
    dashboard: 'Vue du jour',
    pos: 'Vente en boutique',
    sales: 'Historique des ventes',
    refunds: 'Retours & remboursements',
    clients: 'Relations clients',
    products: 'Catalogue produits',
    stock: 'Inventaire',
    fournisseurs: 'Partenaires & fournisseurs',
    invoices: 'Achats & factures',
    reports: 'Analyse du commerce',
    printer: 'Outils de préparation',
    offlineSales: 'Continuité hors ligne',
    invoiceDesign: 'Personnaliser les factures',
    receiptDesign: 'Personnaliser les reçus',
    settings: 'Préférences de la boutique',
    admin: 'Administration',
  }
  const onlineLabels: Partial<Record<SectionName, string>> = {
    onlineDash: 'Commerce en ligne',
    onlineOrders: 'Commandes & traitement',
    onlineProducts: 'Catalogue synchronisé',
    onlineClients: 'Clients en ligne',
    onlineCrm: 'Intelligence client',
    onlineDelivery: 'Livraison & suivi',
    onlineFinance: 'Encaissements & rapprochement',
    onlineConfirm: 'Confirmation des commandes',
    onlineSync: 'Synchronisation',
    onlineLink: 'Correspondance catalogue',
    onlineWhatsApp: 'Communication client',
    onlineSettings: 'Intégrations & canaux',
  }
  return (
    <>
      <div className="min-w-0 flex-1">
        {title && (
          <div className="min-w-0">
            <p className="local-page-kicker">{localLabels[section]}</p>
            <p className="online-page-kicker">{onlineLabels[section]}</p>
            <h1 className="truncate text-base font-semibold tracking-tight text-fg sm:text-lg">{title}</h1>
          </div>
        )}
        {subtitle && <p className="truncate text-xs text-fg-subtle">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
      )}
    </>
  )
}
