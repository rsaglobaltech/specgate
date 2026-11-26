<!-- translation-of: e2c0dd97844c -->
# Empezar

Dos caminos, unos pocos comandos cada uno. Elige el que corresponde a tu carpeta.

**Necesitas:** Node.js 22 o posterior, git y el test runner que tu proyecto ya usa.

## Un proyecto existente

Un repositorio local cuyo código ya funciona.

1. Instala Specgate en el proyecto: `npm i -D @rsaglobaltech/specgate`
2. Adóptalo sin tocar código: `npx specgate adopt` — guarda el comando de tests que detecta, configura tu agente si hay uno instalado (preguntando antes), escribe las áreas que encontró en `docs/specs/adoption.md` en lugar de inventar requisitos y termina con una lista de lo que está listo. ¿Prefieres una app? `npx specgate studio` y pulsa **Adopt** en su pantalla de inicio.
3. Configura tu agente con un solo comando, sus comandos y el agente de Build: `npx specgate agents init --tool claude`
4. Escribe un comportamiento del que dependes, elegido de `docs/specs/adoption.md` cuando la adopción lo haya escrito: `npx specgate new "<a behaviour you rely on>"` — después sustituye la frase que escribió en `spec.md` y los `<placeholders>` de su escenario en `features/` por los reales
5. Nombra el nuevo id (`REQ-002`) en un test que lo demuestre — sirve uno que ya tengas — y entrégalo a través del gate: `npx specgate apply REQ-002`
6. Antes de cada pull request, ejecuta el gate que también ejecuta CI: `npx specgate check`

## Un proyecto nuevo

Una carpeta vacía, quizá con el brief de un cliente.

1. Crea el proyecto respondiendo unas pocas preguntas — `npx @rsaglobaltech/specgate@latest init` — y, en su carpeta, configura tu agente: `npx specgate agents init --tool claude`
2. Guarda el plan como `docs/brief.md` y convierte un módulo en un borrador que revisa una persona: `npx specgate propose --from-brief`
3. Cuando hayas leído el borrador, apruébalo tú, en tu terminal — un agente no puede, y `apply` lo espera: `npx specgate change approve <change-id>`
4. Escribe un test que nombre un requisito del borrador — sus ids empiezan en `REQ-002`; `REQ-001` es la línea base que escribió `init` — escribe el código y entrégalo: `npx specgate apply REQ-002`
5. Cuando todos los requisitos del change estén aplicados, haz merge en la especificación: `npx specgate archive <change-id>`
6. Antes de cada pull request, ejecuta el gate que también ejecuta CI: `npx specgate check`

## Siguiente

- [Conceptos](concepts.md) — las palabras: change, delta, gate, matriz
- [Referencia de comandos](commands.md) — todos los comandos
- [El studio](studio.md) — los mismos caminos en una app
- [Especificar un sistema que ya funciona](reverse.md) — requisitos redactados a partir del propio código
- [Unirte a un proyecto](quickstart.md) — otra persona lo configuró
- Paso a paso, con la salida grabada: [código existente](start/existing-1-adopt.md) · [un proyecto nuevo](start/scratch-1-install.md)
