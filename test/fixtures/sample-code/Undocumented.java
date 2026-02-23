package com.example;

import java.util.List;

public class ShoppingCart {
    private List<CartItem> items;

    public ShoppingCart() {
        this.items = new ArrayList<>();
    }

    public void addItem(CartItem item) {
        this.items.add(item);
    }

    public double getTotal() {
        return items.stream()
            .mapToDouble(i -> i.getPrice() * i.getQuantity())
            .sum();
    }

    private void _internalCleanup() {
        items.clear();
    }
}

public interface UserService {
    UserProfile findById(String userId);
    List<UserProfile> findAll();
}

public enum OrderStatus {
    PENDING,
    CONFIRMED,
    SHIPPED,
    DELIVERED
}

public record CartItem(String id, String name, double price, int quantity) {}

public class OrderProcessor {
    public static Order processOrder(ShoppingCart cart, String userId) {
        return new Order(cart, userId);
    }

    protected List<Order> getOrderHistory(String userId) {
        return List.of();
    }
}
