<!-- translation-of: 0af7ec43965e -->
# Lenguaje del dominio: glosario, reglas y diagramas

Al final de esta página, tu especificación usa una palabra para cada cosa, cada
regla de negocio tiene un número que nombra un test, y el modelo de entidades y
los actores son diagramas que una persona de negocio puede seguir. Todo sale de
fuentes que el proyecto ya mantiene, y `validate` lo comprueba.

**Necesitas:** un proyecto Specgate (`specgate init`).

## El glosario

`specgate init` y `specgate adopt` escriben un `docs/specs/glossary.md` vacío:

```markdown
| Term     | Definition                         | Avoid            |
| -------- | ---------------------------------- | ---------------- |
| Customer | Who buys and pays for an order.    | client, buyer    |
| Order    | What a customer asked for, priced. | purchase, basket |
```

`specgate validate` nombra cada palabra de **Avoid** que se use en
`spec.md`, los specs de capacidades, los deltas de los changes abiertos y los
archivos feature, con la línea y el término que usar en su lugar:

```
▲  spec.md:7 says "client" — the glossary's term is Customer.
   Write Customer instead, or take "client" off its Avoid column in docs/specs/glossary.md.
```

Con `--json`, cada hallazgo lleva el código `glossary_term_forbidden`. Compara
palabras completas e ignora mayúsculas, así que `clientele` no es `client`. Se
saltan los fragmentos de código, los bloques delimitados y las líneas que
empiezan un comentario (`<!--`); las líneas interiores de un comentario de
varias líneas y los comentarios `#` de Gherkin sí se comprueban.
Un `validate` simple avisa; `validate --strict` (el gate) falla.

La tabla la escribes tú: ningún comando rellena una definición. `specgate
check` nombra lo que el proyecto ya usa y el glosario aún no define —sus
actores y las entidades de su modelo de dominio— y `specgate archive` añade
cada uno como una fila, con su Definition y su Avoid para ti (REQ-595).

## Reglas de negocio, numeradas

Las reglas de un requisito son una lista `Rules:` cuyos elementos empiezan por
`BR-NNN`:

```markdown
### REQ-014 — A refund goes back to the card it came from

The system SHALL refund an order to the card that paid for it.

Rules:

- BR-021 A refund never exceeds what the order was paid.
- BR-022 A refund older than 180 days goes to store credit instead.
```

Un test se enlaza a una regla nombrándola, igual que se enlaza a un requisito:

```js
test("REQ-014 BR-022: a refund after 180 days becomes store credit", () => { … });
```

- `validate` falla con `rule_duplicate` cuando dos requisitos usan el mismo id
  de regla, o se usa dos veces en un fichero. Los ids de regla son únicos en
  toda la especificación, como los de requisito; el delta de un change abierto
  que reescribe un requisito con sus reglas es el mismo requisito, no un
  segundo uso.
- `validate --strict` falla con `rule_untested` por cada regla de un requisito
  entregado (Implemented, Verified o Released) que ningún test menciona. Un test
  que nombra el requisito ya no basta para cubrir una regla que nunca ejercita.

## El modelo de entidades

`specgate check` escribe `docs/specs/model.md` como un `erDiagram` de Mermaid,
con una sección por entidad debajo (una tabla de atributos cuando `model.yaml`
da atributos). Sus fuentes son:

- `docs/specs/aggregates.md`, la tabla que escriben los packs de dominio (la
  fila de ejemplo `CoreAggregate` de la plantilla no es una entidad), y
- `docs/specs/model.yaml`, cuando quieres atributos y relaciones:

```yaml
entities:
  - name: Invoice
    attributes:
      - id uuid PK
      - total money
    relations:
      - to: Payment
        kind: one-to-many # one-to-one, many-to-one, many-to-many
        label: settled by
```

Sin ninguna de las dos fuentes, no se escribe ningún fichero.

## Los actores

`specgate check` y `specgate archive` escriben `docs/specs/actors.md`: un
diagrama de flujo de Mermaid desde cada actor hasta las capacidades y los
requisitos cuya traza dice `actor=<that actor>`, y una tabla con los requisitos
de cada actor. Los actores son los que nombra `docs/brief.md`; sin brief, o con
uno que no nombra ninguno, y en un proyecto que mantiene `actors.md`, los que
nombra el `actor=` de los requisitos entregados (REQ-594) —`check` nunca añade
el fichero a un proyecto que no lo tiene—. Sin ningún actor en ninguna parte,
`check` dice que el diagrama no se dibuja, y por qué. `validate` avisa con
`actor_unknown` de un requisito cuyo actor no aparece en el brief, así que una
errata o un actor olvidado salen a la luz antes de que un diagrama lo omita.
Las mayúsculas no importan: `actor=customer` es el `Customer` del brief, y se
dibuja con la grafía del brief.

## Generados, no editados

Los dos diagramas dicen arriba que son generados. `check` los reescribe a
partir de sus fuentes, y `validate` falla con `model_stale` o `actors_stale`
cuando el fichero difiere de lo que dan sus fuentes, igual que con una matriz
de trazabilidad generada. Un fichero que queda después de eliminar sus fuentes
no se reporta; bórralo tú.
Para cambiar un diagrama, cambia su fuente.

## Siguiente

- [Escribir specs](writing-specs.md)
- [Validar](validating.md)
