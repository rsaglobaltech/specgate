package com.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class DiscountTest {
  @Test
  void noCodeNoDiscount() {
    assertEquals(50, new Discount().apply(50, "NONE"));
  }
}
