<!-- translation-of: 96fcd47c2668 -->
# El studio para un equipo

Al final de esta página varias personas usan un mismo studio, cada una con un rol: un
lector lo ve todo y no cambia nada, y los cambios de un editor llegan como
pull requests en lugar de commits en tu rama base. Los builds y los ajustes de un
admin se ejecutan sobre el checkout propio del studio, como en el studio local.

**Necesitas:** el proyecto en git con un remoto `origin`, un proxy de inicio de sesión que tu
equipo ya use (oauth2-proxy con GitHub o GitLab, Cloudflare Access,
Google IAP, un ingress con inicio de sesión…), credenciales de git en el host del studio
que puedan hacer push a `origin`, y un token de GitHub que pueda abrir pull requests.

## Cómo funciona el inicio de sesión

Specgate no inicia la sesión de nadie. `specgate studio --team` se ejecuta detrás de tu proxy, y
el proxy le dice al studio quién pregunta con una cabecera (`X-Forwarded-User`
salvo que nombres otra). El studio no guarda ninguna contraseña, ningún secreto OAuth
ni ninguna sesión.

- Una petición sin la cabecera, o con un nombre de usuario que no es un login
  simple (letras, dígitos, `.`, `@`, `+`, `-`), se rechaza: 401
  `sign_in_required`.
- Con `SPECGATE_PROXY_SECRET` definido, una petición también debe llevar la cabecera
  `X-Specgate-Proxy-Secret` con ese valor, que añade tu proxy. Defínelo:
  sin él, cualquiera que pueda llegar directamente al puerto del studio puede decir que es
  cualquier usuario, y el studio lo avisa al arrancar. Una petición sin el
  secreto correcto se rechaza primero: 401 `proxy_required`.

## Roles: `studio.team.yaml`

```yaml
user_header: X-Forwarded-User     # what your proxy sets
email_header: X-Forwarded-Email   # optional: the commit author's address
base: main                        # where pull requests go (default: pr.base)
hosts: [studio.example.com]       # the name the proxy serves it under
origins: [https://studio.example.com]
roles:
  ana: reader
  luis: editor
  marta: admin
```

| Rol | Lee | Responde, aprueba, anota, edita el brief | Construye, ejecuta agentes, cambia ajustes |
| --- | --- | --- | --- |
| `reader` | sí | rechazado (403 `role_forbidden`) | rechazado (403 `role_forbidden`) |
| `editor` | sí | sí, como pull request | rechazado (403 `role_forbidden`) |
| `admin` | sí | sí, como pull request | sí, sobre el checkout propio del studio |

Cualquiera que el fichero no liste es `reader`.

## Las aprobaciones son del usuario que ha iniciado sesión

Una capa de un change la aprueba quien tiene su rol en
`harness.config.yaml` (`roles: { product: [ana@acme.eu] }`). En el studio de un equipo
ese es el usuario que nombra el proxy, por su e-mail o su login —nunca la
identidad de git de la máquina en la que se ejecuta el studio—, y la aprobación llega, como
cualquier edición, como pull request.

## Las ediciones llegan como pull requests

Cuando un editor responde una pregunta en el change `pdf-invoices`, el studio:

1. escribe la respuesta en un worktree de la rama `studio/<user>/pdf-invoices`
   (el nombre de usuario en minúsculas, los demás caracteres convertidos en `-`), creado a partir
   de la rama base la primera vez y reutilizado para las ediciones posteriores de ese usuario en
   ese change;
2. hace commit con ese usuario como autor;
3. hace push de la rama y abre una pull request hacia la base, o actualiza la que
   ya está abierta, usando el bloque `pr:` de `alm.config.yaml`:

```yaml
pr:
  provider: github
  repo: acme/shop
  base: main
  token_env: GITHUB_TOKEN
```

La respuesta del studio lleva la URL de la pull request. Con estas ediciones no se escriben ni la
rama base ni la copia de trabajo propia del studio. `pr.base` es por defecto
`develop` cuando no está definido, así que nombra tu rama base. Specgate nunca hace merge: la pull
request se revisa como cualquier otra.

## Ejecutarlo

```bash
SPECGATE_PROXY_SECRET=… GITHUB_TOKEN=… specgate studio --team --port 4173
```

El studio sigue escuchando en 127.0.0.1. Pon el proxy en el mismo host, delante
de ese puerto. Sin `--team`, el studio es el local, sin
inicio de sesión y sin roles.

## Siguiente

- [El studio](studio.md)
- [Desde un ticket de Jira](from-a-ticket.md)
