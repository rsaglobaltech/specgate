export function total(items: number, price: number): number {
  if (items > 10) {
    return items * price - price;
  }
  return items * price;
}
