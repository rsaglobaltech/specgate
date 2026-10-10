# Vertical (9:16) console-only video for social networks: the daily loop,
# and `done` refusing twice before it closes a requirement.
# Rendered by build.sh, which prepares $DEMO_DIR and the `specgate` alias.

Output scripts/demo/social/out/specgate-social.mp4
Output scripts/demo/social/out/specgate-social.gif

Set Shell "bash"
Set Width 1080
Set Height 1920
Set FontSize 30
Set LineHeight 1.25
Set Padding 48
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms
Set CursorBlink false
Set WindowBar Colorful
Set WindowBarSize 60

Hide
Type `source "$DEMO_ENV" && clear`
Enter
Sleep 1s
Show

Type "# ¿Tu PR dice «hecho»?"
Enter
Type "# ¿Y lo está? Specgate lo comprueba."
Enter
Sleep 2s

Type "specgate new 'El carrito suma el total'"
Enter
Sleep 3s

# The scenario, written in Spanish Gherkin.
Hide
Type `cp "$FILES/carrito.feature" features/el-carrito-suma-el-total.feature && python3 "$FILES/../obligation.py" && clear`
Enter
Sleep 1s
Show
Type "cat features/el-carrito-suma-el-total.feature"
Enter
Sleep 4s

Type "# Lo marco como hecho… sin test."
Enter
Type "specgate done REQ-002"
Enter
Sleep 4500ms

Hide
Type `cp "$FILES/carrito.test.js" test/carrito.test.js && clear`
Enter
Sleep 1s
Show
Type "# El test nombra el requisito:"
Enter
Type "# ese es el enlace."
Enter
Type "cat test/carrito.test.js"
Enter
Sleep 4s

Type "specgate done REQ-002"
Enter
Sleep 5s

Hide
Type `cp "$FILES/carrito.js" src/carrito.js && clear`
Enter
Sleep 1s
Show
Type "# Rechazado: el test falla."
Enter
Type "# Ahora, el código."
Enter
Type "cat src/carrito.js"
Enter
Sleep 3s

Type "specgate done REQ-002"
Enter
Sleep 4s

Type "specgate check"
Enter
Sleep 4s

Type "# El mismo gate corre en CI."
Enter
Type "# npx @rsaglobaltech/specgate init"
Enter
Sleep 4s
