package com.shop;

public class Bad {
  private int unused;

  public boolean same(String a) {
    return a == "x";
  }

  public void swallow() {
    try {
      Integer.parseInt("x");
    } catch (NumberFormatException e) {
    }
  }
}
