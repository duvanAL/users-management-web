# Sistema visual

Panel oscuro para revisar operaciones durante sesiones de trabajo en escritorio, con luz ambiental moderada. El usuario confirmó el fondo oscuro y el acento verde.

Estrategia contenida. Fondo neutro oscuro, superficies diferenciadas por luminosidad y verde reservado a acciones, selección y confirmaciones. Tonos OKLCH, familia sans del sistema, números tabulares y escala tipográfica fija en rem.

Navegación lateral de 232 px en escritorio. Cabecera contextual, filtros y listas con divisores. Los detalles se organizan mediante pestañas. En móvil el menú se convierte en una hoja y los controles se distribuyen en una columna.

Controles de 44 px como mínimo. Radios de 6 a 12 px, foco de dos píxeles, etiquetas junto a iconos y mensajes de error próximos al campo. Transiciones de 160 ms y respeto por prefers-reduced-motion.

## Tokens

Todos los valores viven en `:root` de `src/app/globals.css`. Los componentes no usan colores, tamaños ni duraciones sueltos.

- Superficies por luminosidad: `--bg`, `--input`, `--sidebar`, `--surface`, `--head`, `--row-hover`, `--raised`, `--hover`.
- Estados: verde para activo y confirmado, ámbar para pendiente, rojo para fallo o bloqueo. El estado siempre lleva texto.
- Tipografía sobre base de 14 px (`87.5%`, respeta el tamaño configurado en el navegador): `--t-2xs` 11 px es el mínimo, `--t-xs` 12, `--t-sm` 13, `--t-md` 16, `--t-lg` 18, `--t-xl` 24, `--t-2xl` 28, `--t-stat` 35.
- Movimiento: `--dur` 160 ms para estados y navegación, `--dur-open` 200 ms para abrir, `--dur-exit` 120 ms para cerrar y `--dur-state` 320 ms para estados del ingreso. `--dur-focal` 380 ms es la entrada del ingreso, que termina en unos 500 ms. Toda interacción simple usa CSS, sin bibliotecas de animación.

## Patrones

- Sin etiquetas sobre los títulos. La ruta de la cabecera ubica al usuario y el título habla solo.
- Los filtros viven dentro del panel que filtran, como primera franja.
- El verde no decora filas: «Ver detalle» es neutro y se vuelve verde con hover o foco. Los avatares de otras personas son neutros; solo la identidad propia usa el tinte verde.
- Carga: skeleton la primera vez (aparece tras 120 ms) y contenido atenuado con `aria-busy` al actualizar. Nunca se reemplaza una tabla por un spinner.
- Vacío: dice por qué no hay datos y qué hacer. Un filtro sin coincidencias no se presenta como ausencia de registros.
- Tablas: se apilan por container query cuando su panel mide menos de 680 px, con la etiqueta de cada dato en `data-label`.
- Ingreso: escena inmersiva confirmada por el usuario. Núcleo tridimensional de puntos y conexiones con tres órbitas para usuarios, cuentas y archivos. Las señales aceleran durante la validación y cada campo correcto enlaza su etiqueta con el núcleo mediante una línea con un pulso. Al entrar, las órbitas se contraen sobre el núcleo mientras la navegación ocurre. Formulario independiente, sin retrasos artificiales de acceso y con mostrar/ocultar contraseña. Las credenciales rechazadas marcan los campos en rojo, tiñen la escena y devuelven el foco a la contraseña; un 429 o una caída de red solo muestran el mensaje. Bloq Mayús se avisa bajo la contraseña. Los accesos de demostración rellenan el formulario sin enviarlo. En móvil la escena se compacta encima del formulario y el kicker desaparece para no montarse sobre la esfera. El selector de movimiento existente conserva Completo, Reducido y Sistema; el canvas se pausa al ocultar la pestaña o salir de la vista, y la versión reducida es estática.
