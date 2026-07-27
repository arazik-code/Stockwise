export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-MA')
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('fr-MA')
}
