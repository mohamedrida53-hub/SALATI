# POLITISCAN

Analizador ideológico gamificado. El usuario escribe una idea política, el sistema la
clasifica dentro de un catálogo de **239 corrientes**, verifica las premisas fácticas del
texto y, si la propuesta reproduce el núcleo de una doctrina extremista documentada,
otorga un **Pin de la Vergüenza** con el histórico de lo que ocurrió cuando se aplicó.

Sin build, sin dependencias en el frontend, sin framework. Scripts clásicos, así que
`index.html` funciona incluso abierto con doble clic.

## Ejecutar

**Solo frontend** (motor heurístico local, sin API):

Abre `index.html` en el navegador. Funciona tal cual. Si quieres saltarte el intento de
llamada al backend, cambia en `index.html`:

```js
window.PS_CONFIG = { useApi: false };
```

**Con backend real** (clasificación por LLM, mucho más precisa):

```bash
cd politiscan/server && npm install
```

```bash
set ANTHROPIC_API_KEY=sk-ant-... && node server.js
```

Y abre `http://localhost:8787`. El servidor sirve también el frontend, así que
`/api/analyze` queda en el mismo origen y no hace falta CORS.

> Nota: en esta máquina no hay Node ni Python instalados (el `python.exe` de
> WindowsApps es el redirector del Store, no un intérprete). El frontend funciona igual
> con `file://`; para el backend necesitarás instalar Node 18+.

## Estructura

```
politiscan/
├── index.html              Estructura completa: gate 18+, consola, galería, vitrina, modal
├── styles.css              Todo el CSS. Tema oscuro único, tokens en :root
├── favicon.svg
├── DESIGN.md               Sistema de diseño: paleta, tipografía, semántica del color
├── js/
│   ├── ideologies.js       Catálogo: 19 familias, 239 entradas, 31 marcadas con pin
│   ├── factcheck.js        15 bulos frecuentes con corrección y fuentes (motor local)
│   ├── analyzer.js         Capa de análisis: llama al backend, cae a heurística local
│   └── app.js              Estado, render, progreso, persistencia
└── server/
    ├── system-prompt.md    ★ El prompt del sistema. Fuente única de la lógica del LLM
    ├── server.js           Backend de referencia (Node 18+, SDK de Anthropic)
    └── package.json
```

## Cómo encaja

`analyzer.js` es la única pieza que sabe si hay backend o no. Intenta
`POST /api/analyze`; si falla por lo que sea —sin servidor, sin red, `file://`— cae al
motor heurístico local **devolviendo exactamente el mismo contrato JSON**. La interfaz
nunca distingue entre uno y otro, solo muestra qué motor respondió en el pie del
resultado.

El contrato está documentado en la cabecera de `js/analyzer.js` y en `system-prompt.md`.
Los dos tienen que moverse juntos.

`server.js` carga el catálogo ejecutando el mismo `js/ideologies.js` que usa el
navegador, y lo inyecta en el prompt. Así los `id` que devuelve el modelo existen siempre
en el frontend, y `sanitize()` descarta cualquiera que no exista. Añadir una ideología es
editar un solo archivo.

## Motor local vs. backend

El heurístico local es una red de seguridad, no un sustituto. Coincidencia por palabras
clave sobre unas 140 entradas del catálogo, más señales transversales de autoritarismo y
un filtro de intención que distingue preguntar de defender. Acierta en textos explícitos
y falla en ironía, en argumentos indirectos y en cualquier cosa que no use el vocabulario
esperado. La app lo declara abiertamente en el pie de cada resultado.

El backend con LLM es el motor real: entiende contexto, detecta contradicciones internas
y verifica afirmaciones que no están en ninguna lista.

## Decisiones que conviene no deshacer

**El pin se otorga por lo que la propuesta hace, no por dónde cae en el espectro.**
Nacionalizar la banca no es un pin. Prohibir partidos sí. La lista de operaciones que lo
activan está en `system-prompt.md` y es deliberadamente corta y concreta. En cuanto el
pin se reparta por radicalidad en lugar de por antidemocracia, la app se convierte en un
juguete partidista y pierde toda utilidad.

**El fact-check se aplica igual en todas las direcciones.** Está escrito explícitamente
en el prompt. Un usuario que detecte asimetría deja de creer también las correcciones
acertadas, y con eso se pierde lo único que la app aporta de verdad.

**Preguntar no es defender.** Tanto el prompt como el heurístico local tratan "quiero
entender por qué el fascismo atrajo a tanta gente" como consulta, no como adhesión. Es la
diferencia entre una herramienta educativa y un detector de brujas.

**Cada ficha lleva su crítica, incluidas las democráticas.** `contrast` está poblado en
las 239 entradas. Si solo se criticaran las corrientes que a uno le desagradan, la
herramienta se leería como militante y su autoridad se evaporaría.

**El texto del pin es sobrio.** La sátira vive en la forma (el sello burocrático), no en
el contenido. Ver `DESIGN.md` §5.

## Pendientes conocidos

- El progreso vive en `localStorage` sin exportación: si el usuario borra datos del
  navegador, pierde el archivo. Un botón de exportar/importar JSON sería barato.
- El rate limit del backend está en memoria; en producción con varias instancias hace
  falta Redis o el limitador del proxy.
- El modal no atrapa el foco (ver `DESIGN.md` §7).
- No hay tests. Los casos de calibración de `system-prompt.md` son la base natural para
  una suite de regresión del clasificador.
- Los datos históricos y las cifras del catálogo están escritos a mano y deberían pasar
  revisión de alguien con formación en historia contemporánea antes de publicarse.
