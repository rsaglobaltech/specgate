"""Replace the obligation `specgate new` seeds with the real one (off camera)."""
import re

p = "spec.md"
s = open(p, encoding="utf-8").read()
s = re.sub(
    r"The system MUST satisfy: El carrito suma el total\.\n\n> Written by Specgate\.[^\n]*",
    "El sistema DEBE sumar el precio por la cantidad de cada línea del carrito.",
    s,
)
open(p, "w", encoding="utf-8").write(s)
