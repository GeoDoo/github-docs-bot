/**
 * Calculates the total price including tax.
 * @param items - Array of item prices
 * @param tax - Tax rate as a decimal
 * @returns Total price with tax
 */
export function calculateTotal(items: number[], tax: number): number {
  const subtotal = items.reduce((sum, item) => sum + item, 0);
  return subtotal * (1 + tax);
}

/**
 * A user profile returned from the API.
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
}
