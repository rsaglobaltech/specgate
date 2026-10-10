# Specgate, day to day, from an empty directory — a real session, nothing
# hidden but the shell prompt. Uses the published npm package.
# Rendered by build.sh, which substitutes the size settings below.

Output "__OUT__.mp4"
Output "__OUT__.gif"

Set Shell "bash"
Set Width __WIDTH__
Set Height __HEIGHT__
Set FontSize __FONT__
Set LineHeight 1.2
Set Padding 40
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set CursorBlink false
Set WindowBar Colorful

Hide
Type `source "$DEMO_ENV" && clear`
Enter
Sleep 500ms
Show

# ── 1. A new project ───────────────────────────────────────────────────────
Type "# Specgate en el día a día — desde cero"
Enter
Sleep 1500ms
Type "mkdir tienda && cd tienda && git init -q"
Enter
Type "npm init -y > /dev/null && npm pkg set scripts.test='node --test'"
Enter
Sleep 1500ms

# ── 2. Install and adopt ───────────────────────────────────────────────────
Type "# 1) Instalar y adoptar"
Enter
Type "npm i -D @rsaglobaltech/specgate"
Enter
Sleep 4s
Type "npx specgate init --no-capabilities"
Enter
Sleep 5s
Type "clear"
Enter
Type "# Que el gate corra los tests (una vez):"
Enter
Type "npx specgate config set test_cmd 'npm test'"
Enter
Sleep 2500ms
Type "npx specgate done REQ-001   # la línea base: lo de hoy pasa"
Enter
Sleep 4s
Type "clear"
Enter

# ── 3. A requirement ──────────────────────────────────────────────────────
Type "# 2) Un requisito nuevo"
Enter
Type "npx specgate new 'El carrito suma el total'"
Enter
Sleep 4s
Type "# Escribo la obligación…"
Enter
Type "vim '+/The system MUST' spec.md"
Enter
Sleep 1500ms
Type "cc"
Set TypingSpeed 25ms
Type "El sistema DEBE sumar precio por cantidad de cada línea."
Escape
Sleep 500ms
Type "jdddd"
Sleep 800ms
Type ":wq"
Enter
Set TypingSpeed 40ms
Type "tail -3 spec.md"
Enter
Sleep 2500ms
Type "clear"
Enter

Type "# …y el escenario, con valores concretos:"
Enter
Set TypingSpeed 18ms
Type "cat > features/el-carrito-suma-el-total.feature <<'EOF'"
Enter
Type "# language: es"
Enter
Type "Característica: El carrito suma el total"
Enter
Enter
Type "  @REQ-002 @SCN-002"
Enter
Type "  Escenario: Dos taladros suman 99,80 €"
Enter
Type "    Dado un carrito con 2 taladros de 49,90 €"
Enter
Type "    Cuando se calcula el total"
Enter
Type "    Entonces el total es 99,80 €"
Enter
Type "EOF"
Enter
Set TypingSpeed 40ms
Sleep 1s
Type "npx specgate status"
Enter
Sleep 4s
Type "clear"
Enter

# ── 4. Test first ─────────────────────────────────────────────────────────
Type "# 3) Primero el test. Nombrar REQ-002 es el enlace."
Enter
Set TypingSpeed 18ms
Type "mkdir -p test src && cat > test/carrito.test.js <<'EOF'"
Enter
Type `const test = require("node:test");`
Enter
Type `const assert = require("node:assert");`
Enter
Type `const { total } = require("../src/carrito");`
Enter
Enter
Type `test("REQ-002 SCN-002: dos taladros suman 99,80 €", () => {`
Enter
Type `  assert.strictEqual(total([{ precio: 49.9, cantidad: 2 }]), 99.8);`
Enter
Type "});"
Enter
Type "EOF"
Enter
Set TypingSpeed 40ms
Sleep 1s
Type "npx specgate done REQ-002   # ¿hecho?"
Enter
Sleep 6s
Type "clear"
Enter
Type "# No: el test falla. Ahora el código."
Enter
Set TypingSpeed 18ms
Type "cat > src/carrito.js <<'EOF'"
Enter
Type "const total = (lineas) =>"
Enter
Type "  Math.round(lineas.reduce((t, l) => t + l.precio * l.cantidad, 0) * 100) / 100;"
Enter
Type "module.exports = { total };"
Enter
Type "EOF"
Enter
Set TypingSpeed 40ms
Sleep 800ms
Type "npx specgate done REQ-002"
Enter
Sleep 5s
Type "clear"
Enter

# ── 5. Before the pull request ────────────────────────────────────────────
Type "# 4) Antes del PR: el gate completo"
Enter
Type "npx specgate check 2>&1 | tail -2"
Enter
Sleep 4s
Type "npx specgate ci init --provider github > /dev/null && ls .github/workflows"
Enter
Sleep 2500ms
Type "git add -A && git commit -qm 'REQ-002: el carrito suma el total' && git log --oneline"
Enter
Sleep 3s
Type "# El mismo gate corre en CI."
Enter
Type "# Cada día: status · new · test · done · check"
Enter
Sleep 5s
