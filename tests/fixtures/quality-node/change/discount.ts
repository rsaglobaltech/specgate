export function discount(total: number, code: string): number {
  if (code === "VIP") {
    return total - 10;
  }
  if (total > 100) {
    return total - 5;
  }
  return total;
}
