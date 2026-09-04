/**
 * Phone formatting, shared by the booking forms and the customer acceptance
 * page. Previously six identical copies across the app; the acceptance page
 * had none, which is why a renter's number reached a signed contract as raw
 * digits.
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}
