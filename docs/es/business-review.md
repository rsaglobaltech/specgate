<!-- translation-of: 77b947c5d318 -->
# Revisa con personas que no leen el repositorio

Al final de esta página, las personas que deciden si un change es correcto —un
product owner, un responsable de operaciones, un cliente— lo han leído como una
página, y los recorridos que hacen los usuarios a través de varios requisitos
están probados de principio a fin.

**Necesitas:** un proyecto Specgate con un change abierto.

## Un change como página

```bash
specgate review pdf-invoices
specgate review pdf-invoices --out review.html
```

Esto escribe un único fichero HTML (por defecto `<change>-review.html`, relativo
a la raíz del proyecto) con:

- el título del change, su tipo y su intención ("Why"),
- cada requisito que el change añade o modifica —título, texto y estado— con
  sus escenarios como pasos numerados en lenguaje llano ("Given a paid invoice",
  "When its owner downloads it"),
- las preguntas del change, con las abiertas marcadas, y sus supuestos,
- la fecha y el commit a partir del que se generó.

El fichero no carga nada de fuera: ni scripts, ni hojas de estilo, ni fuentes,
ni imágenes. Se abre desde un adjunto de correo, sin conexión, y sigue el modo
claro u oscuro de quien lo lee. Cada valor está escapado, así que el texto de
una especificación no puede ejecutarse en el navegador del lector. Un change
desconocido se rechaza con `change_not_found`.

## Recorridos: requisitos en fila

Cada requisito puede pasar su propio test mientras el camino que sigue un
usuario a través de varios de ellos se rompe donde se encuentran. Un recorrido
es un escenario etiquetado con `@JRN-NNN` junto con el `@REQ-NNN` de cada
requisito que atraviesa:

```gherkin
Feature: Library

  @JRN-001 @REQ-002 @REQ-003
  Scenario: Borrow then return
    Given a member
    When they borrow a book and return it
    Then the book is available again
```

- `specgate status --json` lista cada recorrido (`journeys`) con sus
  requisitos y los tests que lo nombran.
- La matriz de trazabilidad no cuenta un recorrido como uno de los escenarios
  propios de sus requisitos, y un archivo feature que solo contiene recorridos
  no necesita fila.
- `specgate validate --strict` falla con `journey_untested` cuando todos los
  requisitos de un recorrido están entregados y ningún test nombra el recorrido.
  `journey_requirement_unknown` significa que una etiqueta nombra un requisito
  que no existe.

Un test se enlaza a un recorrido igual que a un requisito, nombrándolo:

```js
test("JRN-001: a member borrows a book, returns it, and it is available again", …);
```

## Siguiente

- [Cambia un requisito ya entregado](reviewing-changes.md)
- [Escribir specs](writing-specs.md)
