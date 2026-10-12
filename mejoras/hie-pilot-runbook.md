<!-- specgate:allow-placeholders — quotes the {{VAR}} a pack uses for its stack. -->
# 🏥 Piloto HIE — runbook

> **Reconstruido el 2026-08-17 leyendo los dos repos.** El runbook original era
> un fichero local, nunca se comiteó, y se perdió. Todo lo que sigue está
> verificado contra el disco, no recordado.

---

## Qué es este piloto

Un **brownfield real** con dominio regulado: una plataforma de Health
Information Exchange. Es el contraste deliberado con el dogfood de CsdaStudio,
que es greenfield. Si el enfoque solo funciona empezando de cero, no sirve para
una empresa.

| Repo | Rol | Estado |
|---|---|---|
| `~/sandbox/projects/healthcare-hie-specops` | El pack de dominio | `healthcare-hie/backend` v0.1.0, **16 requisitos** |
| `~/sandbox/projects/hie-his-platform` | La plataforma | Spring Boot 3.3 / Java 21 + HAPI FHIR, pack instalado |

Ninguno de los dos vive en este árbol. Están fuera a propósito: un pack que
solo funciona dentro del repo que lo produjo no prueba nada.

**Dominio:** FHIR R4, ingesta HL7v2, SMART on FHIR, consentimiento, auditoría
inmutable, GDPR. El pack se escribió a partir de las fases del `PLAN.md` de la
plataforma — REQ-001..009 ya implementados en ese código, REQ-010..016
pendientes.

El pack es **neutral de stack por construcción**: el Gherkin no nombra
frameworks, y el stack llega por la variable `{{STACK}}`.

## Estado verificado (2026-08-17)

```bash
cd ~/sandbox/projects/hie-his-platform
csda validate .        # pasa — 17 features, estructura completa, modo rich
csda status            # 17 requisitos, 17 pendientes, pack v0.1.0 en el lock
```

Adoptado hasta **L1–L2**: specs dentro, matriz poblada, puerta disponible. Sin
implementación conducida por el harness todavía. Dos ficheros Java en `src/`,
que son el esqueleto del bootstrap.

## Lo que el piloto destapó

**El piloto estaba configurado contra una función que no existía.** Su
`harness.config.yaml` declaraba `agent_profile: local-claude` y un
`.harness/profiles.yaml` con el comando, y el CLI no leía ninguna de las dos
claves: `harness run` respondía «No agent configured» mientras el fichero
declaraba uno.

El diseño era correcto —por eso alguien lo escribió— así que se implementó en
vez de borrarlo, y **una clave desconocida pasó a ser error** en lugar de
ignorarse. Un fichero que parece configurado y no lo está es peor que uno
vacío.

Ese hallazgo salió de reconstruir este runbook. Es el argumento para tener el
piloto: nada más cruza esa costura.

## Cómo retomarlo

```bash
cd ~/sandbox/projects/hie-his-platform

csda plan                      # qué requisito toca
csda harness prompt REQ-010    # leerlo antes de pagarlo
csda harness run --req REQ-010 # el perfil ya resuelve el agente
```

`REQ-001..009` describen comportamiento **que ya existe** en el código. Ese es
el valor real de este piloto y conviene no saltárselo: enlazar un requisito a
código que ya está es el trabajo brownfield de verdad, y es distinto de
generarlo. Empezar por ahí prueba que la matriz describe el sistema; empezar
por REQ-010 solo prueba que el harness escribe código.

Sugerencia de orden:

1. **REQ-001..009 — enlazar, no generar.** `csda req link <REQ> --code <ruta>
   --test <ruta>` contra lo que ya existe, y `csda done` cuando el test pase.
   Si algo no se puede enlazar, el requisito o el código miente: eso es el
   hallazgo.
2. **REQ-010..016 — generar con el harness.** Ahí sí `harness run`.

## Riesgos propios de este dominio

- **Datos sanitarios.** Nada de PHI real en fixtures, ni en prompts. El pack no
  la lleva; el código de la plataforma tampoco debe llevarla a un escenario.
- **Auditoría inmutable.** Un requisito sobre auditoría cuyo test la modifique
  para pasar está mal escrito. Revisar esos escenarios con más cuidado.
- **Consentimiento.** Es dominio, no una comprobación de permisos: pertenece a
  `business_rules` del pack, no a un `if` en el adaptador.

## Regla de actualización

Igual que el resto de documentos vivos de `mejoras/`: al cerrar un paso se
marca aquí en la misma sesión, con el commit que lo cierra. **Y este fichero se
comitea** — el original no lo estaba, y por eso hubo que reconstruirlo.
