# Declaración de permiso de alarma exacta — SALATI

Documento de apoyo para rellenar el formulario de Play Console. Se guarda en el
repositorio porque **hay que repetirlo en cada envío que cambie los permisos**, y
porque si algún día llega un rechazo conviene saber exactamente qué se declaró.

---

## 1 · Qué permiso se declara y por qué

`AndroidManifest.xml` (inyectado por `scripts/apply-native.mjs`) contiene los dos:

| Permiso | Para qué | Concesión |
|---|---|---|
| `SCHEDULE_EXACT_ALARM` | Android 12 | La concede el usuario |
| `USE_EXACT_ALARM` | Android 13+ | Automática, **pero Play la revisa** |

Declarar los dos es el patrón documentado por Google: el segundo cubre las
versiones modernas y el primero las antiguas. El que dispara la revisión es
`USE_EXACT_ALARM`.

**Categoría a elegir en el formulario: aplicación de alarma o temporizador.**
No es forzar la definición. SALATI es literalmente un despertador: suena a cinco
horas concretas del día, calculadas astronómicamente, y su función principal es
avisar en ese instante.

---

## 2 · Dónde está el formulario

```
Play Console → tu app → Contenido de la aplicación
  → Permisos de aplicaciones sensibles → Permiso de alarma exacta
```

En inglés: *App content → Sensitive app permissions → Exact alarm permission*.

Aparece sólo después de subir un bundle que declare el permiso, así que **sube
primero el AAB y rellena esto después**.

---

## 3 · Texto para pegar

Los revisores de Play trabajan en inglés. Usa la versión inglesa en el
formulario; la española está debajo por si el formulario sale traducido.

### Versión corta (si hay límite de caracteres)

> SALATI is a Muslim prayer times app. Its core, user-facing function is to
> alert the user at the five daily prayer times, which are astronomically
> calculated and change every day and with the user's location. Islamic prayer
> must be performed within a bounded time window — Maghrib's is only minutes
> long — so an alert that arrives late is useless to the user. The app plays the
> adhan (call to prayer) at the exact moment, which is the digital equivalent of
> an alarm clock. The permission is used for nothing else.

### Versión larga

> **Core functionality**
>
> SALATI is a Muslim prayer times application. Its primary purpose is to notify
> the user at the five obligatory daily prayer times (Fajr, Dhuhr, Asr, Maghrib
> and Isha) and to play the adhan, the traditional call to prayer, at that exact
> moment. This is the app's main screen and its reason to exist.
>
> **Why exact timing is essential, not a convenience**
>
> Prayer times are derived from the position of the sun at the user's precise
> coordinates. They are different every single day and different in every city,
> so they cannot be approximated or pre-set by the user.
>
> Islamic prayer is only valid inside a bounded time window. The window for
> Maghrib is particularly short. A notification delivered late — which is what
> inexact alarms do under Doze, where delays of 15 minutes or more are normal —
> would tell the user to pray at a time when the prayer is no longer valid. That
> is a functional failure of the app's only core feature.
>
> **User control**
>
> The alerts are entirely user-facing and user-controlled. The user enables them
> with an explicit switch, and can additionally silence individual prayers with
> a bell button next to each one — for example muting Fajr, which falls before
> dawn, while keeping the rest. Nothing is scheduled unless the user asks for it.
>
> **Scope**
>
> The permission is used exclusively to schedule these prayer notifications. The
> app has no background services, no tracking, no advertising and no other use of
> alarms.

### Versión española

> SALATI es una aplicación de horarios de oración musulmana. Su función
> principal es avisar al usuario en los cinco rezos diarios y hacer sonar el
> adhan en ese instante exacto. Los horarios se calculan astronómicamente a
> partir de las coordenadas del usuario, cambian cada día y en cada ciudad, así
> que no pueden aproximarse ni programarse a mano. La oración sólo es válida
> dentro de una ventana de tiempo acotada —la del Magrib dura pocos minutos—,
> de modo que un aviso que llega tarde no sirve. Los avisos los activa el
> usuario de forma explícita y puede silenciar cada rezo por separado. El
> permiso no se usa para nada más.

---

## 4 · Vídeo de demostración

Play suele pedir un enlace a un vídeo (YouTube, **no listado**, no privado) que
enseñe la funcionalidad. Un móvil grabando la pantalla durante 30–40 segundos
basta. Guion:

1. Abrir la app: se ve la lista con los cinco rezos y la cuenta atrás.
2. Abrir Ajustes y encender el interruptor de notificaciones y el del adhan.
3. Volver a la lista y tocar una campana para silenciar un rezo, y otra vez para
   reactivarla. Esto demuestra que es una función visible y controlada.
4. Enseñar una notificación llegando a la hora del rezo. Si no quieres esperar,
   usa el botón **Probar adhan** de Ajustes.

Nada de música de fondo ni cortes: se trata de que el revisor vea el flujo.

---

## 5 · Si lo rechazan

Esto **no es una situación de todo o nada**, y conviene saberlo antes de
angustiarse. El plugin `@capacitor/local-notifications` cae automáticamente a
alarmas inexactas cuando no tiene el permiso, en lugar de fallar: la app sigue
avisando, sólo que con menos precisión.

Plan B, en orden:

1. **Quitar `USE_EXACT_ALARM`** de la lista `PERMISOS` en
   `scripts/apply-native.mjs`, dejando sólo `SCHEDULE_EXACT_ALARM`. Eso saca a
   la app de la revisión restringida.
2. Con ese permiso, en Android 14+ el usuario tiene que concederlo a mano. El
   plugin expone `checkExactNotificationSetting()` y
   `changeExactNotificationSetting()` para comprobarlo y llevarle a los ajustes
   del sistema. Habría que añadir ese paso al encender el interruptor de avisos.
3. Si tampoco lo concede, los avisos siguen llegando de forma aproximada.

---

## 5 bis · Responsabilidades antes de publicar

Lo que **ya está blindado automáticamente**: `scripts/auditar-www.mjs` corre en
cada compilación y tumba el build si el paquete lleva algún script de origen
externo o si falta `LICENCIAS.txt`. Con eso, dos afirmaciones legales dejan de
depender de que alguien se acuerde.

Lo que **sigue dependiendo de ti**, por orden de riesgo:

| Punto | Estado | Por qué importa |
|---|---|---|
| **Licencia del adhan** | ✅ Cerrado (17 ago 2026) | Grabación CC BY-SA 4.0 de Wikimedia Commons, escuchada y aprobada por el responsable. Atribución en `LICENCIAS.txt`. La anterior venía de islamweb.net sin concesión de licencia. Decisión tomada: se usa la misma grabación para los cinco rezos. |
| **Botones de donación** | ✅ Permitidos, con condiciones | Ver el apartado 5 ter. No hacen falta ni entidad registrada ni Play Billing, **siempre que el donante no reciba nada a cambio**. |
| **Seguridad de los Datos** | ✅ Rellenado (17 ago 2026) | Declarada ubicación precisa, opcional, para el cálculo de los rezos. |

Sobre el adhan, que es el más serio: necesitas poder demostrar **de dónde salió
el archivo y bajo qué licencia**. Si no lo recuerdas, lo prudente es sustituirlo
por una grabación con licencia explícita (hay adhanes en dominio público y con
Creative Commons) y anotar la procedencia en `LICENCIAS.txt`, junto al resto.

---

## 5 ter · Donaciones: por qué Ko-fi y PCRF sí se pueden mantener

La política de pagos de Google exige su sistema de facturación para las compras
de contenido digital dentro de la app. Las donaciones de SALATI quedan fuera por
dos vías distintas:

**Ko-fi → pago entre particulares.** Cuando el 100 % de la propina llega al
creador y el pago **no da acceso a ningún contenido ni servicio digital**
—insignias, emojis, funciones extra, quitar publicidad—, Google lo trata como un
pago entre particulares y su facturación no es obligatoria.

**PCRF → donación a entidad exenta.** La política enumera expresamente las
donaciones a organizaciones exentas de impuestos entre las excepciones. PCRF es
una organización 501(c)(3) registrada, y el dinero no pasa por SALATI.

### Condiciones que hay que mantener

Esto deja de ser cierto en cuanto el donante reciba algo. Concretamente:

- **Nada de recompensas.** Ni funciones adicionales, ni insignia de mecenas, ni
  contenido exclusivo, ni quitar anuncios (no los hay). El botón dice «Invítame
  a un café» y no promete nada: así tiene que seguir.
- **Cuidado con los niveles de Ko-fi.** Si en tu página de Ko-fi activas
  membresías o una tienda que entreguen algo digital, la excepción decae y
  pasaría a ser una compra dentro de la aplicación sujeta a Play Billing.
- **El 100 % tiene que llegar a ti.** Las comisiones del procesador de pagos no
  cuentan; lo que rompería la excepción sería una plataforma quedándose parte.

### Detalle técnico

`wireExternalLink()` en `js/app.js` abre los dos enlaces con `@capacitor/browser`.
Conviene que salgan al navegador del sistema y no a una pestaña incrustada:
refuerza que el pago ocurre **fuera** de la aplicación, que es justo lo que
sostiene la excepción.

---

## 6 · Coherencia con el resto de la ficha

El texto de arriba afirma tres cosas que **tienen que seguir siendo ciertas** en
el resto del envío, o el revisor detectará la contradicción:

- Que no hay publicidad ni seguimiento → SALATI retiró la analítica por completo,
  también de la web. `js/analytics.js` quedó como envoltorio inerte y
  `scripts/auditar-www.mjs` tumba la compilación si se cuela cualquier script
  de origen externo en el paquete.
- Que el usuario controla los avisos uno a uno → es la función de las campanas,
  en `js/prayer-alerts.js`.
- Que se usa la ubicación para calcular los horarios → debe coincidir con lo
  declarado en Seguridad de los Datos y con la política de privacidad.

---

## 7 · Nombre del paquete: com.salatii.app

**Con doble «i».** Se define en un único sitio, `appId` de `capacitor.config.json`,
y desde ahí Capacitor lo propaga al `applicationId`, al `namespace`, al paquete
Java y a las autoridades del manifiesto cuando regenera `android/`.

Google Play rechazó la primera subida con dos errores que en realidad eran uno:

1. El paquete debía ser `com.salatii.app`.
2. Conflicto de autoridades de proveedor de contenido con
   `com.salati.app.androidx-startup`.

El segundo se explica solo: AndroidX Startup deriva la autoridad de su
`InitializationProvider` del `applicationId`, con la plantilla
`${applicationId}.androidx-startup`. Esa cadena tiene que ser única en toda la
tienda, así que al corregir el paquete el conflicto desapareció por sí mismo.

**Este valor no se puede volver a cambiar.** Play reserva el nombre del paquete
de por vida en cuanto se publica una versión: cambiarlo obligaría a abrir una
ficha nueva y empezar de cero con los usuarios. Por eso el workflow lo verifica
en dos momentos:

| Comprobación | Qué mira |
|---|---|
| «Verificar el nombre del paquete» | `applicationId` y `namespace` del `build.gradle` generado, y que no queden restos del paquete antiguo |
| «Verificar las autoridades del manifiesto fusionado» | Las autoridades reales tras la fusión, que es lo que Play inspecciona |

La segunda sólo puede correr después de compilar: las autoridades no están en
nuestro manifiesto, las aportan las librerías y sólo se resuelven al fusionarlo.
