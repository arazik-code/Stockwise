// Shared loyalty category (Nouveau/Bon/Premium) labels and badge styles - used by both ClientsPage
// (where the category can be edited) and OnlineClientsPage (read-only display), so the same tier
// always looks identical everywhere it appears. Deliberately distinct from ClientSegment's badge
// palette (see OnlineClientsPage's SEGMENT_BADGE) - the two are different concepts on the same
// client (loyalty tier vs. marketing/re-engagement signal) and should never be visually confused.
export type ClientCategoryValue = 'Nouveau' | 'Bon' | 'Premium'

export const CATEGORY_LABELS: Record<ClientCategoryValue, string> = {
  Nouveau: 'Nouveau Client',
  Bon: 'Bon Client',
  Premium: 'Client Premium',
}

export const CATEGORY_BADGE: Record<ClientCategoryValue, string> = {
  Nouveau: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Bon: 'bg-blue-50 text-blue-700 border-blue-200',
  Premium: 'bg-amber-50 text-amber-800 border-amber-300',
}

export const CATEGORY_ORDER: ClientCategoryValue[] = ['Nouveau', 'Bon', 'Premium']
