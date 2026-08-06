// Mirrors src/SMS.Domain/Constants/Sections.cs by hand - small, stable list. Used only for
// human-readable labels in the Role editor; actual enforcement happens server-side.
export const SECTION_LABELS: Record<string, string> = {
  Dashboard: 'Tableau de bord',
  POS: 'Point de vente (POS)',
  Products: 'Produits',
  Stock: 'Stock',
  Catalog: 'Catalogue (catégories, couleurs, tailles)',
  Fournisseurs: 'Fournisseurs',
  Clients: 'Clients',
  Refunds: 'Retours / Remboursements',
  Invoices: 'Factures',
  CashDrawer: 'Caisse',
  Reports: 'Rapports',
  Settings: 'Paramètres',
  WhatsApp: 'Modèles WhatsApp',
  Shopify: 'Shopify',
  OnlineOrders: 'Commandes en ligne',
  OrderConfirmation: 'Confirmation de commandes',
  OzonExpress: 'OzonExpress (livraison)',
  CodFinance: 'Finance COD',
  AdminUsers: 'Admin · Utilisateurs',
  AdminRoles: 'Admin · Rôles',
  AdminHealth: 'Admin · Santé système',
}

export function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key
}
