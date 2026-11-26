<!-- translation-of: 5228660d69c6 -->
# La entrega: notas de versión, aceptación y guías de usuario

Al final de esta página, una versión tiene notas que nadie tecleó, cada change
lo ha firmado una persona que lo vio funcionar, y cada tipo de usuario tiene una
guía de lo que puede hacer. Todo sale de la especificación que ya mantienes.

**Necesitas:** un proyecto Specgate en git, con los changes archivados a medida
que los entregas (`specgate archive`).

## Di qué tipo de change es

```bash
specgate propose rounding --kind bug
specgate propose pdf-invoices --kind enhancement
```

El tipo se escribe como `kind:` en el `change.yaml` del change, y lo muestran
`specgate change show` y `specgate change list`, y como `changeKind` en cada
requisito del change en `specgate status --json`.
Cualquier otro tipo se rechaza con `change_kind_unknown`.
`specgate propose --from-ticket` lo pone por ti: `bug` para una incidencia de
Jira de tipo Bug, `enhancement` para cualquier otra.

## Notas de versión

```bash
specgate release-notes v1.0.0..v1.1.0
specgate release-notes v1.0.0..v1.1.0 --out RELEASE.md
```

Son los changes archivados entre las dos refs (tags, ramas o commits), en tres
grupos: **Enhancements**, **Fixes** y después **Other changes** (un change que
no declara tipo). Cada change lleva el primer párrafo del Intent de su
propuesta y los requisitos que añadió o modificó, con sus títulos. Un requisito
que eliminó no aparece, porque no se entregó. Una ref desconocida se rechaza con
`ref_unknown`.

```markdown
## Enhancements

### pdf-invoices

Customers asked for invoices they can forward to their accountant.

- REQ-007 — Invoices download as PDF
```

## Aceptación que firma una persona

El gate demuestra que los tests pasan. No puede demostrar que el comportamiento
es lo que pidió el negocio. La aceptación es ese segundo check, hecho por una
persona y puesto por escrito:

```bash
specgate acceptance pdf-invoices
```

Esto escribe `docs/specs/changes/pdf-invoices/acceptance.md`, si aún no
existe, con un elemento sin marcar por cada escenario escrito en el delta del
change, bajo su requisito, y los pasos del escenario debajo de cada elemento.
Un requisito sin escenario en el delta recibe un elemento: "The requirement
behaves as its text says". La persona marca un elemento (`- [x]`) cuando lo
ha visto funcionar, y después firma:

```bash
specgate acceptance pdf-invoices --sign "Ana Pérez"
```

- Mientras quede un elemento sin marcar, la firma se rechaza con
  `acceptance_incomplete`, que nombra los elementos abiertos.
- Cuando todos están marcados, el fichero registra el nombre y la fecha, y cada
  requisito del change que está Implemented pasa a **Verified**. El gate ya
  pasó cuando se aplicaron, así que no se vuelve a ejecutar.
- El fichero vive en la carpeta del change, así que se revisa en el pull
  request y se archiva con el change.

## Una guía de usuario por actor

```bash
specgate guide                     # every actor a delivered requirement names
specgate guide --actor Customer    # one
```

Esto escribe `docs/guide/<actor>.md` (el actor en minúsculas, con guiones en
lugar de espacios: `fleet-manager.md`), con una sección por cada requisito
entregado (Implemented, Verified o Released) cuya traza dice
`actor=<that actor>`, ordenada por capacidad. Cada sección tiene el texto del
requisito y sus escenarios como pasos numerados. El trabajo en Draft queda
fuera, así que la guía nunca describe algo que aún no existe.

## Siguiente

- [Cambia un requisito ya entregado](reviewing-changes.md)
- [Escribir specs](writing-specs.md)
