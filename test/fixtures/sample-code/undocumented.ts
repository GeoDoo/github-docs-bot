export function calculateTotal(items: number[], tax: number): number {
  const subtotal = items.reduce((sum, item) => sum + item, 0);
  return subtotal * (1 + tax);
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

export class ShoppingCart {
  private items: CartItem[] = [];

  addItem(item: CartItem): void {
    this.items.push(item);
  }

  getTotal(): number {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

function _internalHelper(): void {
  console.log('internal');
}
