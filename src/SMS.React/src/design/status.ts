/**
 * The unified status registry.
 *
 * Replaces ELEVEN independent badge palettes scattered across the app:
 *
 *   invoice status      InvoicesPage:48 AND FournisseursPage:182 (byte-identical duplicates)
 *   sale category       SalesPage:43
 *   online order        OnlineOrdersPage:42          (12 values, the richest set)
 *   ozon parcel         api/ozon.ts:184              (had a separate `dot` colour field)
 *   stock level         ProductsPage:21, StockPage:239, DashboardPage:468 (THREE scales)
 *   refund status       RefundsPage:695              (the only `-100` tier and only `yellow`)
 *   client tier         utils/clientCategory.ts:14
 *   rfm segment         OnlineClientsPage:35
 *   loyalty tx          ClientsPage:224
 *   admin role/audit    AdminUsersPage:12, AdminAuditLogPage:15
 *   health probe        AdminHealthPage:7            (dark-theme-only variant)
 *
 * ── Keyed by domain, then value - never by value alone ──────────────────────
 *
 * `Returned` means different things in ozonParcel and onlineOrder. `Cancelled`
 * and `Pending` appear in four domains. A flat value->tone map would silently
 * merge them, so the first key is always the domain.
 *
 * ── Roughly 70 values collapse to 9 tones ───────────────────────────────────
 *
 * Nine tones are the entire colour surface. Each maps to one token triple in
 * components.css via [data-tone], so a new status is a one-line addition that
 * cannot introduce a new colour.
 *
 * ── `rank` drives the transition animation ──────────────────────────────────
 *
 * When a status changes, StatusBadge compares the old and new rank: advancing
 * flashes positive, regressing flashes caution. Same component, meaning-driven
 * motion. rank 0 means "terminal / off-happy-path" and never counts as forward.
 *
 * ── `live` marks in-flight states ───────────────────────────────────────────
 *
 * StatusDot renders a slow ambient ping for these. Disabled at data-perf=lean.
 */

import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle, Ban, CheckCircle2, Clock, CreditCard, Hourglass, Package,
  PackageCheck, PackageX, PauseCircle, PhoneOff, PiggyBank, RefreshCw,
  RotateCcw, Send, ShieldCheck, ShoppingBag, Sparkles, Truck, Undo2, UserPlus,
  Wallet, XCircle,
} from 'lucide-react'

export type Tone =
  | 'neutral'
  | 'info'
  | 'progress'
  | 'positive'
  | 'caution'
  | 'negative'
  | 'critical'
  | 'muted'
  | 'special'

export interface StatusDef {
  tone: Tone
  /** i18n key, preferred where one already exists in fr.ts. */
  labelKey?: string
  /** Literal French label, for the domains that already hardcode one. */
  label?: string
  icon?: LucideIcon
  /** Lifecycle position. Higher = further along. 0 = terminal/off-path. */
  rank?: number
  /** In-flight: StatusDot pulses. */
  live?: boolean
}

type Domain = Record<string, StatusDef>

/** Supplier invoices. Was duplicated byte-for-byte in two files. */
const invoice: Domain = {
  Pending:       { tone: 'caution',  labelKey: 'invoices.statuses.pending',       icon: Clock,        rank: 1 },
  PartiallyPaid: { tone: 'info',     labelKey: 'invoices.statuses.partiallyPaid', icon: CreditCard,   rank: 2 },
  Received:      { tone: 'progress', labelKey: 'invoices.statuses.received',      icon: PackageCheck, rank: 3 },
  Paid:          { tone: 'positive', labelKey: 'invoices.statuses.paid',          icon: CheckCircle2, rank: 4 },
  Overdue:       { tone: 'negative', labelKey: 'invoices.statuses.overdue',       icon: AlertTriangle, rank: 0 },
  Cancelled:     { tone: 'muted',    labelKey: 'invoices.statuses.cancelled',     icon: Ban,          rank: 0 },
}

/** Online orders. The longest lifecycle in the system. */
const onlineOrder: Domain = {
  Pending:           { tone: 'caution',  label: 'En attente',       icon: Clock,        rank: 1, live: true },
  Processing:        { tone: 'progress', label: 'En traitement',    icon: RefreshCw,    rank: 2, live: true },
  Confirmed:         { tone: 'info',     label: 'Confirmée',        icon: CheckCircle2, rank: 3 },
  Packing:           { tone: 'special',  label: 'Emballage',        icon: Package,      rank: 4 },
  ReadyToShip:       { tone: 'progress', label: 'Prête à expédier', icon: PackageCheck, rank: 5 },
  Shipped:           { tone: 'info',     label: 'Expédiée',         icon: Send,         rank: 6, live: true },
  Delivered:         { tone: 'positive', label: 'Livrée',           icon: CheckCircle2, rank: 7 },
  Returned:          { tone: 'caution',  label: 'Retournée',        icon: Undo2,        rank: 0 },
  Refused:           { tone: 'critical', label: 'Refusée',          icon: PackageX,     rank: 0 },
  Refunded:          { tone: 'negative', label: 'Remboursée',       icon: RotateCcw,    rank: 0 },
  Cancelled:         { tone: 'muted',    label: 'Annulée',          icon: Ban,          rank: 0 },
  InventoryConflict: { tone: 'critical', label: 'Conflit de stock', icon: AlertTriangle, rank: 0 },
}

/**
 * OzonExpress parcels. The old map carried a separate `dot` colour alongside
 * `className`; the dot now derives from the tone, so they cannot disagree.
 */
const ozonParcel: Domain = {
  New:            { tone: 'neutral',  label: 'Nouveau',     icon: Package,      rank: 1 },
  PickedUp:       { tone: 'info',     label: 'Ramassé',     icon: PackageCheck, rank: 2, live: true },
  AtHub:          { tone: 'info',     label: 'Au hub',      icon: Package,      rank: 3, live: true },
  InTransit:      { tone: 'special',  label: 'En transit',  icon: Truck,        rank: 4, live: true },
  OutForDelivery: { tone: 'progress', label: 'En livraison', icon: Truck,       rank: 5, live: true },
  Delivered:      { tone: 'positive', label: 'Livré',       icon: CheckCircle2, rank: 6 },
  Returned:       { tone: 'caution',  label: 'Retourné',    icon: Undo2,        rank: 0 },
  Refused:        { tone: 'critical', label: 'Refusé',      icon: PackageX,     rank: 0 },
  Cancelled:      { tone: 'muted',    label: 'Annulé',      icon: Ban,          rank: 0 },
  Unknown:        { tone: 'muted',    label: 'Inconnu',     icon: AlertTriangle, rank: 0 },
}

/** Sale categories. No lifecycle - these are kinds, not stages. */
const saleCategory: Domain = {
  VenteNormale:   { tone: 'info',     label: 'Vente Normale', icon: ShoppingBag },
  VentePromotion: { tone: 'caution',  label: 'Promotion',     icon: Sparkles },
  Liquidation:    { tone: 'negative', label: 'Liquidation',   icon: AlertTriangle },
  VenteEnGros:    { tone: 'positive', label: 'En Gros',       icon: Package },
  VenteSpeciale:  { tone: 'special',  label: 'Spéciale',      icon: Sparkles },
  Retour:         { tone: 'muted',    label: 'Retour',        icon: Undo2 },
  Echange:        { tone: 'progress', label: 'Échange',       icon: RefreshCw },
}

/** Sale record status (RefundsPage). */
const sale: Domain = {
  Completed: { tone: 'positive', label: 'Terminée',  icon: CheckCircle2, rank: 2 },
  Pending:   { tone: 'caution',  label: 'En attente', icon: Clock,       rank: 1 },
  Cancelled: { tone: 'muted',    label: 'Annulée',   icon: Ban,          rank: 0 },
}

/** Refund/exchange operations. Was the only place using -100 and `yellow`. */
const refund: Domain = {
  Completed: { tone: 'positive', label: 'Terminé',    icon: CheckCircle2, rank: 2 },
  Pending:   { tone: 'caution',  label: 'En attente', icon: Hourglass,    rank: 1, live: true },
  Cancelled: { tone: 'negative', label: 'Annulé',     icon: XCircle,      rank: 0 },
}

/**
 * Stock level.
 *
 * IMPORTANT: this unifies the LOOK only. ProductsPage (<=10), StockPage
 * (per-item reorder threshold) and DashboardPage (<=3) each keep their own
 * predicate untouched - they currently disagree about what "low" means, and
 * a restyle must never silently redefine a business rule. The discrepancy is
 * surfaced side-by-side on /design so it can be decided deliberately later.
 */
const stockLevel: Domain = {
  out: { tone: 'negative', label: 'Rupture',  icon: PackageX,     rank: 0 },
  low: { tone: 'caution',  label: 'Stock bas', icon: AlertTriangle, rank: 1 },
  ok:  { tone: 'positive', label: 'OK',       icon: PackageCheck, rank: 2 },
}

/** Loyalty tier. Deliberately distinct from rfmSegment - different concepts. */
const clientTier: Domain = {
  Nouveau: { tone: 'progress', label: 'Nouveau Client', icon: UserPlus,    rank: 1 },
  Bon:     { tone: 'info',     label: 'Bon Client',     icon: ShieldCheck, rank: 2 },
  Premium: { tone: 'caution',  label: 'Client Premium', icon: Sparkles,    rank: 3 },
}

/** RFM marketing segment. Never visually confused with clientTier. */
const rfmSegment: Domain = {
  Vip:     { tone: 'caution',  label: 'VIP',      icon: Sparkles,     rank: 4 },
  Regular: { tone: 'neutral',  label: 'Régulier', icon: ShieldCheck,  rank: 3 },
  AtRisk:  { tone: 'critical', label: 'À risque', icon: AlertTriangle, rank: 2 },
  Lost:    { tone: 'negative', label: 'Perdu',    icon: XCircle,      rank: 0 },
  New:     { tone: 'progress', label: 'Nouveau',  icon: UserPlus,     rank: 1 },
}

const loyaltyTx: Domain = {
  Welcome: { tone: 'special', label: 'Bienvenue', icon: Sparkles },
  Earn:    { tone: 'info',    label: 'Gain',      icon: PiggyBank },
  Redeem:  { tone: 'caution', label: 'Échange',   icon: Wallet },
  Adjust:  { tone: 'muted',   label: 'Ajustement', icon: RefreshCw },
}

const adminRole: Domain = {
  Admin:        { tone: 'special',  label: 'Administrateur' },
  Cashier:      { tone: 'info',     label: 'Caissier' },
  StockManager: { tone: 'positive', label: 'Gestionnaire Stock' },
}

const auditAction: Domain = {
  UserCreated:   { tone: 'positive', label: 'Utilisateur créé' },
  UserUpdated:   { tone: 'info',     label: 'Utilisateur modifié' },
  PasswordReset: { tone: 'caution',  label: 'Mot de passe réinitialisé' },
  RoleCreated:   { tone: 'positive', label: 'Rôle créé' },
  RoleUpdated:   { tone: 'info',     label: 'Rôle modifié' },
  RoleDeleted:   { tone: 'negative', label: 'Rôle supprimé' },
}

const health: Domain = {
  healthy:        { tone: 'positive', label: 'Opérationnel',  icon: CheckCircle2,  live: true },
  degraded:       { tone: 'caution',  label: 'Dégradé',       icon: AlertTriangle, live: true },
  down:           { tone: 'critical', label: 'Hors service',  icon: XCircle,       live: true },
  not_configured: { tone: 'muted',    label: 'Non configuré', icon: PauseCircle },
}

const syncPhase: Domain = {
  running: { tone: 'info',     label: 'En cours', icon: RefreshCw, live: true },
  partial: { tone: 'caution',  label: 'Partiel',  icon: AlertTriangle },
  done:    { tone: 'positive', label: 'Terminé',  icon: CheckCircle2 },
  failed:  { tone: 'negative', label: 'Échoué',   icon: XCircle },
}

/** Sales channel. */
const channel: Domain = {
  Local:    { tone: 'info',    label: 'Local',    icon: ShoppingBag },
  Shopify:  { tone: 'special', label: 'Shopify',  icon: ShoppingBag },
  WhatsApp: { tone: 'positive', label: 'WhatsApp', icon: Send },
}

/** Payment settled or not. */
const payment: Domain = {
  Paid:   { tone: 'positive', label: 'Payé',    icon: CheckCircle2, rank: 1 },
  Unpaid: { tone: 'muted',    label: 'Non payé', icon: Clock,       rank: 0 },
}

/** Outcome of a single order-confirmation call attempt. Not a lifecycle - no ranks. */
const confirmationOutcome: Domain = {
  Confirmed:     { tone: 'positive', label: 'Confirmée',            icon: CheckCircle2 },
  NoAnswer:      { tone: 'caution',  label: 'Pas de réponse',       icon: Clock },
  Busy:          { tone: 'caution',  label: 'Occupé',               icon: PhoneOff },
  Refused:       { tone: 'negative', label: 'Refusée',              icon: XCircle },
  WrongNumber:   { tone: 'muted',    label: 'Mauvais numéro',       icon: AlertTriangle },
  Postponed:     { tone: 'progress', label: 'Reporté',              icon: Clock },
  Duplicate:     { tone: 'muted',    label: 'Doublon',              icon: AlertTriangle },
  AskedToChange: { tone: 'special',  label: 'Modification demandée', icon: RefreshCw },
}

export const STATUS = {
  invoice,
  onlineOrder,
  ozonParcel,
  saleCategory,
  sale,
  refund,
  stockLevel,
  clientTier,
  rfmSegment,
  loyaltyTx,
  adminRole,
  auditAction,
  health,
  syncPhase,
  channel,
  payment,
  confirmationOutcome,
} as const

export type StatusDomain = keyof typeof STATUS

/** Unknown values degrade to a neutral chip rather than crashing or rendering blank. */
export function getStatus(domain: StatusDomain, value: string | null | undefined): StatusDef {
  if (!value) return { tone: 'muted', label: '—' }
  return (STATUS[domain] as Domain)[value] ?? { tone: 'neutral', label: value }
}

export type TransitionDirection = 'forward' | 'backward' | 'neutral'

/**
 * Direction of a status change, used to pick the flash colour.
 *
 * Advancing along the lifecycle flashes positive; falling back flashes
 * caution. Anything involving a terminal state (rank 0) is neutral - going
 * from Pending to Cancelled is not "backward progress", it is an exit.
 */
export function transitionDirection(
  domain: StatusDomain,
  from: string | undefined,
  to: string
): TransitionDirection {
  if (!from || from === to) return 'neutral'
  const a = getStatus(domain, from).rank
  const b = getStatus(domain, to).rank
  if (a === undefined || b === undefined || a === 0 || b === 0) return 'neutral'
  return b > a ? 'forward' : 'backward'
}

export const TONES: Tone[] = [
  'neutral', 'info', 'progress', 'positive',
  'caution', 'negative', 'critical', 'muted', 'special',
]

export const STATUS_DOMAINS = Object.keys(STATUS) as StatusDomain[]
