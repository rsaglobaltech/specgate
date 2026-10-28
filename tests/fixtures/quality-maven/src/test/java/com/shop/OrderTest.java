package com.shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class OrderTest {
  @Test
  void totalOfASmallOrder() {
    assertEquals(30, new Order(3).total(10));
  }
}
