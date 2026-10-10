# language: es
Característica: El carrito suma el total de sus líneas

  @REQ-002 @SCN-002
  Escenario: Dos líneas suman su total
    Dado un carrito con 2 taladros de 49,90 €
    Cuando se calcula el total
    Entonces el total es 99,80 €
