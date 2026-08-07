# POLITISCAN · Sistema de diseño

## 1. Concepto: "laboratorio clandestino"

La estética tiene una función, no es decoración. La app pide al usuario que escriba algo
que probablemente no diría en voz alta, y luego le devuelve un juicio. Esa transacción
necesita dos señales visuales simultáneas:

1. **Discreción** — "aquí puedes escribir sin que te miren". Superficie casi negra,
   contraste bajo en lo secundario, cero elementos festivos.
2. **Instrumentación** — "esto es una medición, no una opinión". Monoespaciada para todo
   lo que sea lectura de aparato, retícula técnica de fondo, numeración de expedientes.

Lo que deliberadamente **no** se hace: iconografía de partido, banderas, colores de
espectro político (azul/rojo/morado como identidad), caricaturas. En cuanto la interfaz
adopta la paleta de un bando, la herramienta se lee como propaganda del contrario y el
usuario deja de conceder autoridad al fact-check. La neutralidad cromática es una
decisión de credibilidad, no de gusto.

## 2. Paleta

Un solo tema, oscuro. No hay modo claro y es intencional: rompería el concepto y
duplicaría la superficie de mantenimiento sin beneficio real.

### Superficies

| Token | Hex | Uso |
|---|---|---|
| `--void` | `#08090B` | Fondo de página |
| `--panel` | `#0E1014` | Tarjetas, consola |
| `--panel-2` | `#14171D` | Barras, pies de tarjeta |
| `--panel-3` | `#1A1E26` | Hover de controles |
| `--line` | `#242932` | Bordes visibles |
| `--line-soft` | `#1B2029` | Separadores internos |

### Tinta

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#E9EAEE` | Texto principal (contraste ~15:1 sobre `--void`) |
| `--ink-2` | `#B9BEC8` | Párrafos secundarios (~9:1) |
| `--muted` | `#7E8794` | Etiquetas, metadatos (~4.8:1) |
| `--dim` | `#555D6B` | Marcas de agua, contenido bloqueado |

### Señales

| Token | Hex | Significado — **estricto** |
|---|---|---|
| `--alert` | `#FF3B30` | Riesgo. Pin, extremismo, verdicto FALSO, botón de acción |
| `--amber` | `#FFB627` | Advertencia. Señales autoritarias, verdicto ENGAÑOSO/IMPRECISO |
| `--fact` | `#2FD4C4` | Verificación. Módulo de fact-check, fuentes, preguntas abiertas |
| `--ok` | `#4ADE80` | Confirmado. Verdicto VERIFICADO |
| `--violet` | `#8B6BFF` | Reservado (sin uso todavía) |

**La regla que sostiene todo el sistema**: el rojo nunca decora. Cada vez que aparece,
el usuario debe poder señalar qué va mal. Si el rojo se usa para bordes bonitos o
acentos de marca, deja de significar "peligro" y el Pin de la Vergüenza pierde su carga
en la primera sesión. El único rojo no-alerta admitido es el punto de marca de la
cabecera, que actúa como piloto de "sistema encendido".

El cian (`--fact`) es el contrapeso emocional: cuando la app corrige al usuario, lo hace
en frío, no en rojo. La corrección no es un castigo.

## 3. Tipografía

```
Display  Space Grotesk 700   → titulares, nombres de ideología, cifras grandes
Cuerpo   Inter 400/650       → párrafos, explicaciones, fact-check
Mono     JetBrains Mono 400  → etiquetas, veredictos, fuentes, entrada del usuario
```

Fallbacks del sistema en las tres, así que la app no depende de red. Si quieres
autoalojarlas, descarga los `.woff2` a `assets/fonts/` y añade las `@font-face`; no hay
`<link>` a Google Fonts precisamente para que funcione con `file://` y sin conexión.

Decisiones que importan:

- **El textarea es monoespaciado.** El usuario escribe "en la máquina", no en un editor
  de texto. Cambia sutilmente el registro de lo que la gente escribe.
- **Los nombres de ideología van en display grande**, no en mono. Son el contenido
  histórico, no una lectura de instrumento: merecen peso editorial.
- **Las fuentes del fact-check van en mono a 11px.** Densas, secas, verificables. Una
  cita bibliográfica en tipografía de cuerpo parece opinión; en mono parece registro.
- Interletraje negativo (`-0.03em`) en display, positivo (`+0.1em`) en mono. Es lo que
  produce la sensación de "terminal + editorial" en la misma página.

Escala: `clamp()` en todos los titulares. No hay breakpoints tipográficos manuales.

## 4. Retícula y espacio

- Ancho máximo `1180px`. Los párrafos van limitados a `58-66ch`: por encima de eso la
  lectura de texto histórico denso se degrada mucho.
- Retícula de fondo de `44px` a `.022` de opacidad. Debe percibirse solo cuando se busca.
  Si se ve a primera vista, está mal calibrada.
- Radios: `4px` para controles, `10px` para tarjetas. Nada más redondo — la app no es
  amable, es precisa.
- Espaciado por `clamp()` en `--gap` y `--pad`, sin media queries de layout salvo en el
  breakpoint de 640px.

## 5. Componentes con carga semántica

### Consola de entrada
Barra de título con tres puntos y nombre de archivo (`entrada_libre.txt`). Comunica
"esto es un buffer, no un post". Durante el análisis, una línea de escaneo roja recorre
el textarea: es el único momento en que la interfaz se mueve sin que el usuario actúe.

### Medidor de afinidad
Anillo cónico con el porcentaje al centro. Deliberadamente **no** es una barra de
progreso: una barra sugiere avance hacia una meta, un dial sugiere medición.

### Tarjeta de match
Borde izquierdo de 3px codificado por riesgo — gris (democrática), ámbar (riesgo 1),
naranja (riesgo 2), rojo (riesgo 3, con resplandor interior). El usuario aprende el
código en tres análisis y a partir de ahí lo lee sin texto.

### Pin de la Vergüenza
Fondo de rayas diagonales al 4,5 % + sello rotado con doble borde. La sátira está en la
**forma** (un sello burocrático absurdo), nunca en el **texto**: el contenido del pin es
histórico y sobrio. Si el texto también fuera satírico, el usuario descartaría los datos
junto con la broma. La sátira abre; el dato cierra.

### Tarjetas bloqueadas
`████████` en lugar del nombre, trama diagonal encima, mitad de altura que las abiertas.
Legible como "expediente censurado" en vez de "contenido de pago", que es la asociación
que arruinaría la mecánica.

### Mapa de ejes
Cuadrícula 2:1 con punto luminoso. Sin etiquetas de partidos ni cuadrantes coloreados:
solo la posición del texto analizado. Añadir nombres de partidos convertiría un
instrumento en una acusación.

## 6. Movimiento

- Entrada de tarjetas escalonada, 380 ms, `cubic-bezier(.2,.7,.3,1)`, desplazamiento de
  14px. Suficiente para que el resultado se lea como algo que "llega".
- Línea de escaneo: 1,15 s en bucle, solo durante el análisis.
- Pulso del punto de marca: 2,6 s. Es el latido de la app.
- `prefers-reduced-motion: reduce` desactiva todo, incluido el scroll suave.

Nada rebota, nada gira, no hay confeti al desbloquear. La recompensa de esta app es
información, no celebración.

## 7. Accesibilidad

- Contraste AA cumplido en todos los pares de texto/fondo en uso.
- El color nunca es el único portador de información: cada veredicto lleva etiqueta
  textual (`FALSO`, `ENGAÑOSO`…) además de color; cada nivel de riesgo lleva la marca
  `⚠ PIN` cuando corresponde.
- Foco visible en cian a 2px con offset de 3px sobre todo elemento interactivo.
- La galería usa `<button>` reales, navegables con teclado; el modal cierra con `Escape`.
- Las tarjetas bloqueadas llevan `aria-label` explicando que están bloqueadas, porque
  `████████` no se lee bien en un lector de pantalla.

**Pendiente para producción**: trampa de foco dentro del modal y `aria-live` en el
contenedor de resultados para que el análisis se anuncie al completarse.

## 8. Adaptación a móvil

Un solo breakpoint real (640px):
- El sello del pin se oculta (rota fuera de la caja en anchos pequeños).
- La consola apila los ejemplos sobre el botón.
- El medidor baja a 76px.
- La retícula de tarjetas pasa a `minmax(150px, 1fr)`.

El textarea nunca baja de 16px de fuente: por debajo, iOS hace zoom automático al enfocar
y descoloca el layout.
