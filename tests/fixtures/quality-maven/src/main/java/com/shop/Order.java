package com.shop;

public class Order {
  private final int items;

  public Order(int items) {
    this.items = items;
  }

  public int total(int price) {
    if (items > 10) {
      return items * price - price;
    }
    return items * price;
  }

  public boolean isLarge() {
    return items >= 5;
  }
}
