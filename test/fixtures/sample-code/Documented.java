package com.example;

import java.util.List;

/**
 * A shopping cart that tracks items and computes totals.
 */
public class ShoppingCart {
    private List<CartItem> items;

    /**
     * Adds an item to the cart.
     * @param item the item to add
     */
    public void addItem(CartItem item) {
        this.items.add(item);
    }

    /**
     * Computes the total price of all items in the cart.
     * @return the total price
     */
    public double getTotal() {
        return items.stream()
            .mapToDouble(i -> i.getPrice() * i.getQuantity())
            .sum();
    }
}

/**
 * Service for managing user profiles.
 */
public interface UserService {
    /**
     * Finds a user by their unique identifier.
     * @param userId the user ID
     * @return the user profile
     */
    UserProfile findById(String userId);
}
