package com.shop;

public class Discount {
  public int apply(int total, String code) {
    if (code == "VIP") {
      return total - 10;
    }
    if (total > 100) {
      return total - 5;
    }
    return total;
  }
}
