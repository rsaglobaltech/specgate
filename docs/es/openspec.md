<!-- translation-of: 333f289b0a47 -->
# Ya usas OpenSpec

Sigue escribiendo tus especificaciones con [OpenSpec](https://github.com/Fission-AI/OpenSpec).
Specgate comprueba que lo que OpenSpec llama terminado está terminado: cada
escenario que reclama un change archivado tiene un test que lo nombra. Lee
`openspec/` en su sitio y nunca escribe en él.

```bash
npx @rsaglobaltech/specgate@latest verify          # the check
npx @rsaglobaltech/specgate@latest verify --ids    # every scenario id, to name in tests
```

## Cómo se nombra un escenario

Cada escenario recibe un id estable a partir de los títulos de su capacidad, su
requisito y su escenario:

```
openspec:<capability>/<requirement>/<scenario>
openspec:billing/refunds/a-refund-over-the-limit-needs-approval
```

Un test queda enlazado a un escenario nombrando su id en cualquier sitio: el
título del test, un comentario. Esa mención es el único enlace; no hay nada más
que declarar.

```ts
// openspec:billing/refunds/a-refund-over-the-limit-needs-approval
it("a refund over the limit needs approval", () => { … });
```

## Qué falla, y qué solo se informa

| Código                  | Significa                                                         |          |
| ----------------------- | ----------------------------------------------------------------- | -------- |
| `V1_unproved_claim`     | un change archivado reclama un escenario que ningún test nombra   | falla    |
| `V2_failing_suite`      | con `--run`, el comando de test falla                             | falla    |
| `V3_criterion_changed`  | el texto de un escenario cambió desde su última verificación (`--record`) | falla    |
| `V4_unknown_reference`  | un change archivado nombra un requisito que la especificación ya no tiene | se informa |
| `V5_unreadable`         | un archivo de especificación o de tareas no se puede parsear      | falla    |
| `V6_orphan_name`        | un test nombra un id que no existe                                | se informa |
| `V7_unclaimed_coverage` | escenarios sin reclamación y sin test, como porcentaje            | se informa |

Un change activo con todas sus tareas marcadas se informa, no pasa por el gate:
aún no está archivado, así que no reclama nada.

## Adoptarlo en un proyecto con historial

```bash
specgate verify --since origin/main   # gate only what changed after this ref
specgate verify --run                 # also run the suite (npm test by default)
specgate verify --record              # after a green run, pin each verified scenario's text
```

`--since` te deja adoptarlo sin arreglar antes el pasado: las reclamaciones
antiguas se informan, las nuevas pasan por el gate. `--record` escribe
`.specgate/verify.lock`, así que un escenario editado más tarde debe volver a
verificarse (V3).

## En CI

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 } # `since` needs history
- uses: rsaglobaltech/specgate/actions/verify@main
  with:
    run: "true"
    test-cmd: "npm test"
```

Sin `since`, la action solo aplica el gate a las reclamaciones hechas después del
commit base del pull request. `--format github` convierte los hallazgos en
anotaciones sobre las líneas de la especificación. El mismo check es la
herramienta MCP `specgate_verify`.

## Lo que esto no es

`verify` no ejecuta el workflow propio de Specgate: ni `spec.md`, ni matriz, ni
packs. Es lo único que un equipo en OpenSpec le pide: que "terminado" esté
demostrado. Decidido en [ADR-0030](specs/adr/README.md); la especificación es
[verify-foreign-specs](specs/verify-foreign-specs.md).
