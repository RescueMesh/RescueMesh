# Instalar RescueMesh

Esta guía instala una instancia local e independiente. No conecta una cartera, no abre puertos a Internet y no activa mainnet.

## Requisitos

- Windows, macOS o Linux actualizado;
- Git;
- Node.js 20.11 o posterior, que incluye `npm`;
- al menos 100 MB libres para el código y los archivos locales del prototipo.

No hace falta un ASIC, un nodo Bitcoin completo ni una cuenta de RescueMesh para ejecutar el prototipo en regtest. Esos componentes sí serían necesarios para funciones de minería o integración que todavía están fuera de esta versión.

## Instalación

Abre PowerShell, Terminal o una consola y ejecuta:

```text
git clone https://github.com/RescueMesh/RescueMesh.git
cd RescueMesh
npm run check
npm run init
npm run doctor
npm start
```

Después abre `http://127.0.0.1:39393`.

No es necesario ejecutar `npm install`: RescueMesh no tiene dependencias de ejecución externas en esta versión.

## Qué hace cada paso

1. `git clone` descarga únicamente el repositorio público.
2. `npm run check` revisa el código, busca patrones de secretos y ejecuta todas las pruebas.
3. `npm run init` genera claves y un token exclusivos para ese equipo dentro de `runtime/`.
4. `npm run doctor` confirma que la red es regtest, la API escucha solo localmente y la difusión mainnet no existe.
5. `npm start` abre la interfaz únicamente en el propio ordenador.

## Límites de seguridad

- No pegues transacciones reales, claves privadas, semillas, outpoints ni credenciales en la web pública.
- No publiques ni sincronices la carpeta `runtime/` con servicios en la nube.
- No cambies la escucha de `127.0.0.1` por `0.0.0.0`.
- No utilices material real hasta completar revisión independiente y las listas de comprobación de testnet/mainnet.
- Detén la instancia con `Ctrl+C` en la consola donde se está ejecutando.

La web pública explica el proyecto y ejecuta el simulador en el navegador. El servicio local es el único que muestra el estado real de la instancia de cada operador.
