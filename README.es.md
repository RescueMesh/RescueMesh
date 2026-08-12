<p align="center">
  <img src="assets/rescuemesh-avatar.png" alt="Escudo de red de RescueMesh" width="160">
</p>

# RescueMesh

**Coordinación gratuita, sin custodia y con privacidad para mineros que deciden voluntariamente construir plantillas Bitcoin con transacciones de rescate válidas por consenso.**

[English](README.md) · [Español](README.es.md)

[Web pública](https://rescuemesh.github.io/RescueMesh/) · [Instalación](docs/INSTALL.es.md) · [Seguridad](SECURITY.md) · [Arquitectura](docs/ARCHITECTURE.md) · [Protocolo](docs/PROTOCOL.md) · [Economía](docs/ECONOMICS.md)

> **Estado actual: prototipo centrado en seguridad y limitado a regtest.** RescueMesh no difunde en mainnet, no se conecta a Bitcoin Core, no construye bloques de producción, no presta todavía un servicio público de minería y no promete confirmaciones. El repositorio implementa y prueba las piezas de coordinación descritas aquí; la ruta de minería real pertenece a la hoja de ruta.

## Contenido

- [El problema](#el-problema)
- [Qué es RescueMesh](#qué-es-rescuemesh)
- [Qué no es RescueMesh](#qué-no-es-rescuemesh)
- [Por qué podemos ganar todos](#por-qué-podemos-ganar-todos)
- [Arquitectura](#arquitectura)
- [Qué está implementado](#qué-está-implementado)
- [Funcionamiento exacto](#funcionamiento-exacto)
- [Modelo económico](#modelo-económico)
- [Privacidad y fronteras de datos](#privacidad-y-fronteras-de-datos)
- [Modelo de seguridad](#modelo-de-seguridad)
- [API HTTP local](#api-http-local)
- [Comandos](#comandos)
- [Instalación y primer inicio](#instalación-y-primer-inicio)
- [Configuración](#configuración)
- [Automatización y gobierno](#automatización-y-gobierno)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Preguntas frecuentes](#preguntas-frecuentes)
- [Hoja de ruta](#hoja-de-ruta)
- [Contribuciones y licencia](#contribuciones-y-licencia)

## El problema

Algunas transacciones Bitcoin válidas resultan difíciles para las políticas habituales de retransmisión o selección de plantillas de los pools. El propietario puede necesitar que un minero evalúe un paquete especial, mientras que el minero necesita proteger sus ingresos, validar el candidato y conservar el control de su plantilla. Revelar demasiado pronto ciertos datos también puede perjudicar la privacidad o permitir una transacción competidora.

El problema real no es simplemente enviar bytes a un servidor. Hay que encajar cuatro condiciones:

1. el propietario conserva la custodia y evita revelar material sensible;
2. el minero nunca está obligado a aceptar una plantilla deficitaria o no verificable;
3. ningún coordinador puede saltarse el consenso de Bitcoin ni inventar hashrate;
4. la cooperación debe ser auditable sin crear un token, un pool obligatorio o un guardián central.

RescueMesh es un experimento de protocolo abierto para resolver esa coordinación.

## Qué es RescueMesh

RescueMesh está diseñado como una malla de coordinadores y mineros operados de forma independiente. Sus piezas permiten:

- cifrar localmente los bytes de una transacción;
- representar un conjunto privado mediante compromisos públicos con sal;
- calcular si la inclusión aporta valor esperado no negativo al minero;
- anunciar capacidades temporales sin publicar raws, txids ni outpoints;
- intercambiar anuncios públicos firmados entre coordinadores;
- registrar trabajos públicos con datos económicos agregados;
- verificar trabajo parcial contra un trabajo previamente registrado;
- emitir recibos Proof-of-Help firmados y no transferibles;
- ofrecer una interfaz y una API únicamente locales;
- estudiar mejoras sin permitir que la automatización las despliegue.

Cada operador conserva el control de sus claves, política, nodo, conexión minera y decisión final sobre la plantilla. RescueMesh no custodia fondos ni define reglas de consenso alternativas.

## Qué no es RescueMesh

RescueMesh **no es**:

- una cartera, custodio o empresa de recuperación de claves;
- un acelerador ni una garantía de confirmación;
- una fuente de hashrate gratuito;
- una forma de minar sin realizar prueba de trabajo real;
- una forma de saltarse scripts, consenso o la decisión del minero;
- un pool ni un sustituto de Bitcoin Core;
- una base de datos pública de transacciones raw;
- un token, inversión, crédito o promesa de recompensa;
- un difusor mainnet operativo;
- un motivo para revelar una clave, semilla, outpoint o transacción real.

Si ningún minero real produce suficiente trabajo válido, no aparece un bloque. RescueMesh puede coordinar mejor, pero no puede alterar esa restricción física y de consenso.

## Por qué podemos ganar todos

RescueMesh no sostiene que el valor aparezca de la nada. La cooperación solo es positiva cuando un valor medible cubre el coste de oportunidad del minero.

| Participante | Beneficio posible | Protección del diseño |
| --- | --- | --- |
| Propietario de la transacción | Una ruta privada para un paquete difícil, sin recargo de RescueMesh | Mantiene la custodia; los bytes permanecen cifrados localmente; la vía gratuita devuelve <code>userAdditionalChargeSats: 0</code> |
| Minero | Comisiones ya existentes, espacio marginal libre, ingreso auxiliar verificado o ahorro de infraestructura | El planificador rechaza candidatos que no alcanzan su ganancia mínima; participar siempre es voluntario |
| Operador coordinador | Monitorización, compromisos, descubrimiento y contabilidad abiertos y compartidos | No obtiene poder sobre el consenso, los pagos del minero ni otras instalaciones |
| Cooperativa | Pruebas verificables de ayuda que el gobierno futuro podría usar para prioridad recíproca | Proof-of-Help está firmado, ligado a un trabajo, no es transferible y no promete canje |
| Ecosistema Bitcoin | Más diversidad en la construcción de plantillas y menos dependencia de un único servicio | Protocolo abierto, control local, sin directorio central obligatorio ni cambios de consenso |

Por tanto, “ganamos todos” tiene condiciones:

- RescueMesh no añade comisión, aunque la transacción mantiene su propia comisión minera;
- el minero solo participa si la operación cumple su política económica local;
- nadie recibe una promesa de bloque, pago o prioridad futura;
- el ingreso auxiliar solo cuenta si ya está realizado o puede verificarse;
- un candidato que desplaza transacciones más valiosas se rechaza o espera.

## Arquitectura

~~~mermaid
flowchart LR
    Owner["Entrada local del propietario"] --> Parser["Analizador local limitado"]
    Parser --> Store["Almacén sellado AES-256-GCM"]
    Store --> Bundle["Paquete privado + compromisos con sal"]
    Bundle --> Scheduler["Planificador de valor marginal"]
    Scheduler --> Job["Trabajo público agregado"]
    Job --> Discovery["Descubrimiento firmado y temporal"]
    Discovery <--> Peers["Coordinadores federados"]
    Job --> Adapter["Adaptador minero local"]
    Adapter --> Shares["Pruebas de trabajo registradas"]
    Shares --> Receipt["Libro Proof-of-Help firmado"]
    Adapter -. "ruta futura de producción" .-> Block["Envío de bloque válido por consenso"]
    Block -.-> Node["Nodo Bitcoin del operador"]
~~~

Las fronteras de confianza son intencionadas:

- la transacción sensible permanece en el equipo del propietario o de un coordinador de confianza;
- la capa pública solo transporta compromisos, economía agregada y capacidades;
- el adaptador minero es local salvo que exista un transporte cifrado revisado aparte;
- el nodo Bitcoin del minero es la autoridad final de validación y envío;
- un anuncio firmado sigue siendo una entrada no fiable: la firma identifica una clave, no demuestra honestidad.

La descripción técnica por componentes está en [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Qué está implementado

| Capacidad | Estado | Comportamiento real |
| --- | --- | --- |
| Inicialización local | **Implementado y probado** | Crea configuración regtest, clave maestra de 256 bits, par Ed25519 y token aleatorio sin reemplazar archivos existentes |
| Analizador de transacciones | **Implementado y probado** | Analiza serialización legacy y witness, CompactSize canónico, tamaños, peso, vsize, txid y wtxid; no valida UTXO, scripts ni consenso completo |
| Almacén cifrado | **Implementado y probado** | Cifra con AES-256-GCM, autentica la metadata por digest y escribe atómicamente |
| Paquetes sellados | **Implementado y probado** | Crea manifiesto privado y sobre público con compromisos y totales; permite verificar una apertura posterior |
| Planificador marginal | **Implementado y probado** | Calcula desplazamiento, coste de oportunidad y ganancia con enteros; el recargo al propietario es cero |
| Anuncios firmados | **Implementado y probado** | Crea y verifica registros Ed25519 temporales con pequeña prueba de trabajo SHA-256 |
| Registro de anuncios | **Implementado y probado** | Rechaza registros caducados, antiguos, falsificados o con prueba insuficiente y purga los caducados |
| Gossip federado | **Parcialmente implementado y probado** | Envía y obtiene anuncios públicos mediante semillas HTTPS o loopback con límites, tiempos máximos y aislamiento de errores |
| Registro de trabajos públicos | **Implementado y probado** | Conserva en memoria trabajos agregados, limitados y temporales; crearlos exige el token local |
| Proof-of-Help | **Implementado y probado** | Comprueba cabeceras de 80 bytes contra tip, raíz y objetivo registrados; evita duplicados, firma recibos y encadena el libro |
| División umbral | **Primitiva implementada y probada** | Divide secretos de 16–4096 bytes en participaciones K-de-N con autocontrol sobre GF(256); no existe ceremonia de liberación automática |
| Adaptador Stratum V1 | **Primitiva implementada y probada** | Flujo local subscribe/authorize/notify/submit con límites; usa trabajos sintéticos y <code>npm start</code> todavía no lo conecta |
| Interfaz y API locales | **Implementado y probado** | Sirve español e inglés en loopback con cabeceras estrictas y API de datos públicos |
| Web GitHub Pages | **Publicada** | Publica una lista cerrada de diez archivos; documenta y simula la economía dentro del navegador |
| Bitcoin Core RPC/IPC | **No implementado** | No hay conexión a nodo, consulta UTXO, construcción de bloques ni difusión |
| Plantillas mineras de producción | **No implementado** | No hay coinbase, witness commitment, pagos ni flujo real de shares |
| Transporte Tor | **No implementado** | Un anuncio puede describir un endpoint onion, pero gossip necesita todavía un adaptador al proxy Tor |
| DATUM / Stratum V2 | **Planificado** | Son adaptadores candidatos y requieren análisis de amenazas propio |
| Pruebas de validez oculta | **Investigación** | Necesarias para que el minero compruebe validez e ingresos sin ver el conjunto privado |
| Mainnet | **Bloqueado deliberadamente** | La validación siempre se niega porque no existe broadcaster |

## Funcionamiento exacto

### 1. Identidad y secretos locales

<code>npm run init</code> crea:

- <code>config.local.json</code>, limitado a regtest y loopback;
- <code>runtime/secrets/master.key</code>, para cifrar;
- <code>signing-private.pem</code> y <code>signing-public.pem</code>, para firmar anuncios y recibos;
- <code>runtime/secrets/api.token</code>, para autorizar escrituras locales.

Los archivos se crean de forma exclusiva. No se sobrescribe una clave existente ni se repara silenciosamente medio par de firma. En sistemas POSIX se aplican permisos privados; Windows requiere además disciplina de ACL y copias de seguridad.

### 2. Entrada local de la transacción

La vía sensible actual es la consola, no el navegador ni la API. El hexadecimal se pasa por entrada estándar para evitar el historial normal:

~~~bash
printf '%s' "$RAW_TX" | node src/cli.mjs seal --id example-regtest
~~~

En este prototipo solo deben utilizarse datos sintéticos de regtest.

El analizador limita bytes, entradas, salidas, scripts y witness; comprueba la estructura y calcula metadata. No demuestra que las firmas sean válidas, que existan los inputs, que no haya doble gasto, que la comisión anunciada sea correcta ni que Bitcoin Core acepte el bloque.

### 3. Sellado autenticado

Los bytes se cifran con AES-256-GCM y un nonce nuevo de 96 bits. Los datos autenticados incluyen identificador, esquema y digest de metadata. La metadata suministrada no se escribe en claro. Cualquier modificación del ciphertext, etiqueta o datos autenticados provoca un fallo.

El archivo queda en <code>runtime/</code>, excluido de Git. Si un atacante obtiene tanto el archivo como la clave maestra, puede descifrarlo: el cifrado no sustituye la seguridad del equipo.

### 4. Manifiesto privado y compromiso público

Cada transacción recibe un rol:

- <code>rescue</code>: necesita inclusión especial;
- <code>sponsor</code>: transacción independiente opcional que aporta valor al minero;
- <code>standard</code>: otra transacción ordinaria del conjunto.

El manifiesto privado contiene txids, roles, comisiones, tamaños, caducidad y sal aleatoria. El sobre público contiene únicamente:

- identificador opaco;
- número de transacciones y roles;
- comisión y vsize totales;
- raíz de compromisos con sal;
- compromiso del manifiesto privado;
- caducidad.

No se usa la raíz Merkle txid normal: con una sola transacción revelaría el txid. Una apertura posterior reconstruye los compromisos y demuestra que el manifiesto no cambió.

### 5. Admisión económica

El planificador calcula qué bytes desplazarían otras transacciones, los valora a la tasa marginal y suma únicamente fuentes aceptadas de valor para el minero. Después compara la ganancia neta con el mínimo del propio minero.

Que una simulación sea aceptada solo significa que sus números cumplen la fórmula. No valida la transacción, no comprueba ingresos externos y no reserva espacio.

### 6. Trabajo público agregado

Un operador local autorizado puede registrar un <code>rescuemesh/public-job/v1</code> temporal con:

- identificador seguro;
- compromiso SHA-256 del paquete;
- vsize y comisión agregados;
- ganancia minera mínima;
- capacidades solicitadas;
- creación, caducidad y digest.

La API rechaza recursivamente campos raw, txid sensible, outpoint, clave privada, semilla, contraseña o credencial. El almacén está limitado, vive en memoria y elimina trabajos caducados.

### 7. Descubrimiento y gossip

Un anuncio <code>rescuemesh/announcement/v1</code> contiene:

- node id derivado de la clave pública Ed25519;
- clave pública y endpoint HTTPS, onion o loopback permitido;
- capacidades;
- digest de política;
- emisión y caducidad;
- prueba anti-spam SHA-256;
- firma Ed25519.

La duración predeterminada es de 30 minutos y nunca se aceptan más de 60. La dificultad por defecto exige 16 bits iniciales a cero. Endpoint y clave pública son metadata pública y enlazable; no proporcionan anonimato por sí solos.

Cuando se activa explícitamente, el bucle crea un anuncio, lo envía a semillas configuradas, obtiene sus registros y conserva solo entradas válidas y nuevas. Los errores de un peer quedan aislados. Hay un máximo de 32 semillas y tiempos de espera limitados.

### 8. Minería y shares

La primitiva Stratum V1 local soporta:

- <code>mining.subscribe</code>;
- <code>mining.authorize</code>;
- <code>mining.notify</code>;
- <code>mining.set_difficulty</code>;
- <code>mining.submit</code>;
- límites de clientes, mensajes y trabajos retenidos.

Cada share debe referirse a un trabajo entregado a esa sesión. El verificador Proof-of-Help analiza una cabecera Bitcoin de 80 bytes y comprueba:

1. que el previous-block hash coincide con el tip registrado;
2. que la raíz Merkle coincide con el trabajo;
3. que el doble SHA-256 alcanza el objetivo registrado por el coordinador.

Esto demuestra trabajo sobre un compromiso concreto. No demuestra por sí solo que las transacciones ocultas sean válidas.

### 9. Contabilidad Proof-of-Help

Para un share válido y no repetido se puede emitir un recibo firmado que liga:

- id del share;
- sujeto participante;
- id del trabajo;
- unidades de trabajo derivadas del objetivo;
- fecha y clave pública del emisor.

Cada entrada enlaza el digest anterior, por lo que alterar, reordenar o eliminar elementos es detectable. Proof-of-Help no es dinero, no se transfiere y no garantiza pago. Un gobierno futuro podría usarlo como prueba auditable para prioridad recíproca.

### 10. Ruta de bloque real

Esta fase **no existe todavía**. Una versión de producción tendría que:

1. validar el conjunto privado contra un estado UTXO comprometido;
2. demostrar o comprobar que no hay doble gasto;
3. construir coinbase y witness commitment;
4. respetar peso y sigops;
5. ligar la política de pago del minero;
6. caducar trabajo al cambiar el tip;
7. enviar el bloque completo mediante el nodo Bitcoin del operador;
8. gestionar rechazo, reorg, stale work e incidentes.

Hasta implementar y probar todo esto en regtest y signet/testnet4, además de revisión independiente, no debe utilizarse material real.

## Modelo económico

### Regla de conservación

RescueMesh no crea bitcoins ni garantiza beneficios. Busca situaciones en las que valor real y comprobable supera el coste de inclusión.

~~~text
bytes_desplazados = max(0, vsize_rescate - espacio_libre)
coste_oportunidad = ceil(bytes_desplazados × tasa_marginal)
beneficio_bruto = comision_rescate + ingreso_auxiliar + ahorro_infraestructura
ganancia_neta = beneficio_bruto - coste_oportunidad
aceptar si ganancia_neta >= minimo_del_minero
recargo RescueMesh al propietario = 0
~~~

La implementación utiliza enteros y milisatoshis por vbyte para evitar errores de coma flotante.

### Ejemplo

Para un paquete de 12.318 vB que paga 12.318 sats:

- con 12.318 vB realmente libres, el coste de desplazamiento es cero y el minero obtiene la comisión existente;
- sin espacio libre y con tasa marginal de 5 sat/vB, el coste es 61.590 sats y la ganancia neta es −49.272 sats;
- el planificador rechaza o espera salvo que un ingreso auxiliar comprobable o un ahorro real cierre la diferencia.

“Gratis para el propietario” significa que RescueMesh no añade comisión. No elimina la comisión firmada, la electricidad, el coste de oportunidad ni un servicio independiente elegido fuera del protocolo.

### Fuentes de valor aceptables

- comisión ya comprometida por el paquete;
- espacio marginal que realmente quedaría vacío;
- ingresos realizados de merge-mining u otra fuente auxiliar;
- ahorro medible en pool o infraestructura;
- transacción sponsor independiente y opcional.

Promesas futuras, estimaciones no verificables y precios de tokens deben valorarse en cero por una política automática de producción.

## Privacidad y fronteras de datos

| Dato | Capa local/privada | Capa pública | GitHub Pages |
| --- | --- | --- | --- |
| Transacción raw | Almacén local cifrado | Prohibida | Prohibida |
| Txids y outpoints | Manifiesto privado / análisis temporal | Ausentes | Ausentes |
| Claves privadas | <code>runtime/secrets/</code> | Nunca se transmiten | Ausentes |
| Token API | Archivo local y cabecera de autorización | Nunca se anuncia | Ausente |
| Vsize y comisión agregados | Disponibles | Pueden aparecer en trabajos | Solo simulación sintética |
| Compromisos con sal | Se crean localmente | Se pueden compartir | Solo documentación |
| Clave pública y endpoint | Se crean localmente | Anuncio público | No se listan automáticamente |
| Capacidades y política | Se crean localmente | Anuncio público | Solo documentación |
| Recibo Proof-of-Help | Libro local / receptor elegido | Depende de la política del operador | Ausente |

Hechos importantes:

- el cifrado no protege un ordenador comprometido mientras está funcionando;
- endpoint y clave pública pueden enlazarse;
- tamaño, comisión, horario y capacidades agregados pueden crear huella;
- la federación actual no es una red de anonimato;
- Tor, diversidad de peers, tráfico de cobertura y resistencia a eclipses están pendientes;
- nunca debe pegarse un secreto en GitHub, incidencias, chats o web pública.

## Modelo de seguridad

### Invariantes aplicados

- La API escucha en <code>127.0.0.1</code> y un bind remoto falla cerrado.
- No puede habilitarse transporte raw por HTTP.
- Mainnet siempre se rechaza porque no existe broadcaster.
- Las claves de configuración desconocidas se rechazan.
- Las escrituras exigen un token largo comparado en tiempo constante.
- Se limitan o comprueban cuerpos, tasas, métodos, tipo MIME, Host y origen.
- Los nombres de campos sensibles se rechazan recursivamente.
- Los errores públicos no exponen excepciones internas.
- La web aplica CSP restrictiva y cabeceras de aislamiento.
- No carga scripts, fuentes, trackers ni código ejecutable inline de terceros.
- Los anuncios están firmados, caducan y necesitan prueba anti-spam.
- El almacén usa cifrado autenticado y creación exclusiva/atómica.
- Las acciones CI se fijan a commits inmutables.
- CI prueba Linux y Windows; CodeQL y secretos se analizan automáticamente.
- Pages publica solo una lista cerrada de archivos estáticos.
- La automatización investigadora puede abrir incidencias, pero no cambiar código ni desplegar.
- La rama <code>main</code> exige CI y CodeQL, y prohíbe borrado y force-push.

### Riesgos pendientes

- **Validez de plantilla oculta:** el minero aún no puede comprobar todo el conjunto privado y un coordinador malicioso podría desperdiciar hashrate.
- **Robo de transacción:** ciertos scripts inusuales o futuros pueden permitir una transacción competidora si se revelan.
- **Manipulación económica:** un peer puede mentir sobre ingresos externos o costes.
- **Denegación de servicio:** la prueba anti-spam no detiene un ataque dirigido.
- **Sybil:** una firma válida no demuestra que el operador sea único u honesto.
- **Privacidad del endpoint:** la infraestructura de descubrimiento puede ser identificable.
- **Permisos Windows:** los modos POSIX son aproximados y se necesitan ACL revisadas.
- **Errores de implementación:** pruebas y CodeQL reducen riesgo, pero no sustituyen una auditoría.

Consulta [THREAT_MODEL.md](docs/THREAT_MODEL.md), [SECURITY.md](SECURITY.md) y [MAINNET_CHECKLIST.md](docs/MAINNET_CHECKLIST.md). Las vulnerabilidades deben comunicarse mediante el reporte privado de GitHub, nunca publicando pruebas sensibles.

## API HTTP local

Base predeterminada: <code>http://127.0.0.1:39393</code>.

| Método y ruta | Autorización | Función |
| --- | --- | --- |
| <code>GET /</code> | Frontera loopback | Panel español |
| <code>GET /en/</code> | Frontera loopback | Panel inglés |
| <code>GET /health</code> | Ninguna | Versión, red, bloqueos, uptime y contadores |
| <code>GET /v1/capabilities</code> | Ninguna | Capacidades y limitaciones |
| <code>GET /v1/announcements</code> | Ninguna | Anuncios válidos no caducados |
| <code>POST /v1/announcements</code> | Validación pública estricta | Acepta un anuncio público firmado |
| <code>GET /v1/jobs</code> | Ninguna | Trabajos públicos agregados |
| <code>POST /v1/jobs</code> | <code>Authorization: Bearer …</code> | Registra un trabajo agregado |
| <code>POST /v1/simulate</code> | Ninguna | Ejecuta el cálculo marginal |

Los límites predeterminados son 32 KiB por JSON y 120 solicitudes por minuto. Los cuerpos deben usar <code>application/json</code>. Las rutas conocidas rechazan métodos no permitidos.

No existe endpoint para subir, recuperar o difundir una transacción raw.

## Comandos

| Comando | Resultado |
| --- | --- |
| <code>npm run init</code> | Crea configuración y secretos sin sobrescribir |
| <code>npm run doctor</code> | Comprueba secretos, loopback, bloqueo raw y red |
| <code>npm start</code> | Inicia panel y API locales |
| <code>npm run simulate -- --vsize 12318 --fee 12318 --free-space 12318 --marginal-rate 1</code> | Evalúa un candidato |
| <code>node src/cli.mjs seal --id example-regtest</code> | Lee por stdin y cifra localmente |
| <code>node src/cli.mjs announcement</code> | Crea un anuncio firmado, pero no lo difunde |
| <code>npm run idea-lab</code> | Genera propuestas deterministas no fiables |
| <code>npm run build:pages</code> | Construye la lista pública en <code>runtime/pages</code> |
| <code>npm run check</code> | Ejecuta lint, escaneo de secretos y pruebas |

Todos los comandos directos de <code>src/cli.mjs</code> aceptan <code>--config &lt;ruta&gt;</code>.

## Instalación y primer inicio

Requisitos:

- Windows, macOS o Linux actualizado;
- Git;
- Node.js 20.11 o posterior, con npm;
- unos 100 MB libres.

Para el prototipo regtest no hace falta ASIC, nodo Bitcoin completo ni cuenta RescueMesh. La minería e integración reales exigirían hardware o infraestructura externa que esta versión no proporciona.

~~~bash
git clone https://github.com/RescueMesh/RescueMesh.git
cd RescueMesh
npm run check
npm run init
npm run doctor
npm start
~~~

Abrir:

- Español: <http://127.0.0.1:39393>
- Inglés: <http://127.0.0.1:39393/en/>

Se detiene con <code>Ctrl+C</code>. La versión 0.1 no tiene paquetes externos de ejecución, así que no requiere <code>npm install</code>. Consulta [INSTALL.es.md](docs/INSTALL.es.md).

### Web pública y servicio local

- [GitHub Pages](https://rescuemesh.github.io/RescueMesh/) es una web estática común: explica y simula la economía dentro del navegador.
- El servicio <code>127.0.0.1</code> es una instancia diferente en cada ordenador y contiene sus claves, configuración y estado.
- Pages no puede leer claves, trabajos, API ni archivos del visitante.
- Apagar la instancia local no desconecta la documentación pública.

## Configuración

| Ajuste | Valor inicial | Función |
| --- | --- | --- |
| <code>network</code> | <code>regtest</code> | Red local de pruebas |
| <code>api.host</code> | <code>127.0.0.1</code> | Solo el propio equipo |
| <code>api.port</code> | <code>39393</code> | Puerto del panel y API |
| <code>api.maxBodyBytes</code> | <code>32768</code> | Límite de cuerpo JSON |
| <code>api.requestsPerMinute</code> | <code>120</code> | Límite temporal |
| <code>discovery.enabled</code> | <code>false</code> | Federación desactivada |
| <code>discovery.automaticAnnounce</code> | <code>false</code> | Sin anuncio automático |
| <code>discovery.minimumPowBits</code> | <code>16</code> | Trabajo anti-spam mínimo |
| <code>discovery.maximumTtlSeconds</code> | <code>1800</code> | Vida máxima predeterminada |
| <code>economics.minimumNetGainSats</code> | <code>0</code> | Rechaza pérdida esperada |
| <code>economics.maximumRescueVsize</code> | <code>100000</code> | Límite de política |
| <code>economics.maximumFreeJobsPerTemplate</code> | <code>1</code> | Vía gratuita conservadora |
| <code>security.allowRemoteApi</code> | <code>false</code> | Bloquea escucha remota |
| <code>security.allowRawTransactionHttp</code> | <code>false</code> | Invariante; otro valor falla |
| <code>mainnet.enabled</code> | <code>false</code> | Primer interlock |
| <code>mainnet.submissionEnabled</code> | <code>false</code> | Segundo interlock |

Aunque se activen ambos interlocks y la variable explícita, el programa se detiene porque el broadcaster no está implementado.

No expongas la API mediante cambio de host, port forwarding, proxy inverso o firewall. Una futura capa remota necesitará cifrado, autenticación y análisis propio.

## Estructura del repositorio

~~~text
src/bitcoin/       análisis limitado de transacciones
src/coordinator/   trabajos públicos agregados
src/discovery/     registro firmado y gossip HTTPS
src/economics/     planificador de valor marginal
src/http/          API loopback y servidor web endurecido
src/mining/        primitiva Stratum V1 local
src/protocol/      compromisos, anuncios y Proof-of-Help
src/security/      claves, cifrado y división umbral
web/               interfaz bilingüe
scripts/           validación, Pages, investigación y monitorización
test/              pruebas de seguridad, protocolo, web y economía
docs/              arquitectura, amenazas, RFC y operación
research/          entradas públicas del laboratorio de ideas
runtime/           estado local generado, ignorado y no publicado
~~~

## Automatización y gobierno

### Seguridad continua

Cada pull request y cambio de <code>main</code> ejecuta:

- comprobación del repositorio;
- escaneo de patrones secretos;
- pruebas completas en Linux y Windows;
- CodeQL para JavaScript;
- construcción Pages con lista cerrada.

Dependabot propone semanalmente actualizaciones. Las acciones externas se fijan por digest de commit completo.

### Investigación automática

Idea Lab combina primitivas públicas y abre como máximo una incidencia de revisión dos veces al mes. El monitor upstream revisa semanalmente publicaciones de Bitcoin Core, Stratum V2, DATUM y proyectos relacionados. Su salida no es fiable:

- puede proponer;
- no puede fusionar;
- no puede modificar el repositorio;
- no puede desplegar;
- no puede manipular secretos;
- no puede activar mainnet.

### Política de decisiones

- documentación y pruebas: revisión de mantenimiento;
- API pública y descubrimiento: RFC y revisión de seguridad;
- criptografía, pagos, raws y minería: RFC y dos revisiones independientes;
- interlocks mainnet: unanimidad, revisión externa y versión explícita.

Consulta [GOVERNANCE.md](GOVERNANCE.md), [CONTRIBUTING.md](CONTRIBUTING.md) y [AUTOMATION.md](docs/AUTOMATION.md).

## Limitaciones conocidas

1. **No hay rescate real completo:** las primitivas no están conectadas a una plantilla Bitcoin de producción.
2. **No hay validación de consenso:** el parser no ejecuta scripts ni consulta UTXO.
3. **No hay adaptador de nodo:** no existe RPC, IPC, ZeroMQ ni envío P2P.
4. **No hay servicio minero vivo:** Stratum es local, sintético en pruebas y no se inicia por CLI.
5. **No hay prueba de validez oculta:** el minero no puede verificar independientemente el paquete privado.
6. **No hay distribución onion automática:** Tor y bootstrap están pendientes.
7. **No existe beneficio garantizado:** depende de datos económicos correctos y valor real.
8. **No existe confirmación garantizada:** el trabajo puede no alcanzar nunca el objetivo de red.
9. **No existe ceremonia de claves de producción:** la división umbral es una librería.
10. **No existe aún auditoría independiente:** pruebas y CodeQL no demuestran ausencia de vulnerabilidades.

## Preguntas frecuentes

### ¿RescueMesh envía transacciones Bitcoin hoy?

No. La difusión mainnet no existe y está bloqueada. La web pública nunca envía transacciones.

### ¿Puede confirmar sin mineros?

No. Un minero debe producir un bloque que alcance el objetivo de red y cumpla el consenso.

### ¿El propietario mantiene el premio o importe completo?

RescueMesh no añade comisión. La comisión ya firmada y cualquier sponsor independiente siguen teniendo su efecto. RescueMesh no puede reescribir una transacción firmada sin la autoridad necesaria.

### ¿Por qué participaría gratis un minero?

“Gratis” significa sin recargo para el propietario. El minero solo participa cuando comisiones existentes, espacio libre, ingreso auxiliar realizado o ahorro verificable alcanzan su mínimo.

### ¿Ve el minero la transacción raw?

No mediante la API pública actual. La producción necesitará un coordinador local de confianza para el minero o una prueba de validez oculta revisada. El prototipo aún no resuelve esa confianza final.

### ¿Oculta RescueMesh la IP?

No. Loopback evita exponer la API, pero HTTPS público revela un endpoint. Tor está pendiente y no debe suponerse anonimato.

### ¿Proof-of-Help es dinero?

No. Es un recibo firmado de trabajo válido para un trabajo concreto; no se transfiere ni promete pago o canje.

### ¿Sirve <code>bootstrap.dat</code> como nodo?

No para la ruta de producción que falta. Puede ayudar a cargar datos en software compatible, pero no es un nodo validador, minero, wallet ni broadcaster por sí mismo.

### ¿La web local publica mis archivos?

No con la configuración inicial, porque escucha únicamente en <code>127.0.0.1</code>. No debe exponerse por túnel o proxy sin una revisión nueva.

### ¿La web pública depende del ordenador del fundador?

No. GitHub Pages aloja la documentación común. La instancia funcional de cada operador permanece en su equipo.

### ¿Una idea automática puede cambiar producción?

No. Solo puede abrir una incidencia. La protección de rama y el gobierno exigen revisión y pruebas humanas.

### ¿Es seguro usar material real?

No en la versión 0.1. Solo deben usarse fixtures sintéticos de regtest hasta completar integraciones, checklist mainnet y revisión externa.

## Hoja de ruta

### 0.1 — base segura

Implementado: cifrado local, compromisos, planificador entero, descubrimiento firmado, Proof-of-Help, panel, parser limitado, Stratum V1 sintético, división umbral y bloqueo mainnet.

### 0.2 — integración regtest

Pendiente: adaptador Bitcoin Core, fixtures diferenciales, coinbase y witness, pruebas de propiedades y persistencia firmada de trabajos.

### 0.3 — adaptadores cooperativos

Pendiente: DATUM, Stratum V2 Job Declaration, reparto ciego, contabilidad auxiliar realizada y gossip Tor.

### 0.4 — trabajos sellados con pruebas

Investigación: declaración de validez, prueba de comisión mínima, benchmarks criptográficos y revisión independiente.

### 1.0 — candidata de producción

Exige completar [MAINNET_CHECKLIST.md](docs/MAINNET_CHECKLIST.md), operadores independientes, versiones reproducibles y auditoría externa. No se promete fecha ni resultado.

## Contribuciones y licencia

Se aceptan contribuciones que respeten los invariantes:

1. discutir cambios de protocolo mediante RFC;
2. usar solo datos sintéticos;
3. añadir pruebas para supuestos criptográficos, económicos y de consenso;
4. ejecutar <code>npm run check</code>;
5. explicar el impacto de seguridad;
6. no adjuntar nunca secretos ni transacciones reales.

RescueMesh utiliza licencia **AGPL-3.0-only**. Quien modifique y exponga el servicio por red debe publicar el código fuente correspondiente bajo la misma licencia.

Es software experimental sin promesa de idoneidad, beneficio, confirmación o seguridad mainnet.
