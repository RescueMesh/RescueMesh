# RescueMesh en español

[Web pública](https://rescuemesh.github.io/RescueMesh/) · [Guía completa de instalación](INSTALL.es.md)

RescueMesh es un proyecto experimental para coordinar gratuitamente a propietarios de transacciones y mineros que construyen sus propias plantillas.

No roba comisiones del premio, no custodia bitcoins y no obliga a ningún minero. Busca que el minero acepte únicamente cuando la plantilla no empeora su resultado económico. El software tampoco puede crear hashrate ni garantizar cuándo aparecerá un bloque.

## Qué funciona en la versión 0.1

- cifrado local de transacciones con AES-256-GCM;
- API e interfaz bilingüe local sin entrada de raws, rastreadores ni recursos de terceros;
- simulador de coste marginal con aritmética entera;
- paquetes sellados con compromisos verificables;
- anuncios firmados, temporales y con prueba de trabajo anti-spam;
- registro Proof-of-Help firmado y resistente a duplicados;
- división umbral de claves para copias distribuidas y futuros coordinadores;
- análisis automático de secretos antes de publicar;
- laboratorio de propuestas que nunca despliega código automáticamente.

## Qué está bloqueado

- difusión de transacciones en mainnet;
- recepción de raws por Internet;
- escucha remota de la API;
- publicación social automática;
- actualización autónoma de código crítico.

Esto no es una limitación accidental. Es la frontera de seguridad hasta completar regtest, testnet4, revisión independiente e integración con un sistema de plantillas soberanas.

## Primer uso seguro

1. Ejecutar `npm run check`.
2. Ejecutar `npm run init` para crear secretos locales ignorados por Git.
3. Ejecutar `npm run doctor`.
4. Ejecutar `npm start`.
5. Abrir `http://127.0.0.1:39393` en español o `http://127.0.0.1:39393/en` en inglés.

No copies una transacción real en el navegador, en GitHub, en una incidencia ni en un argumento de terminal.
