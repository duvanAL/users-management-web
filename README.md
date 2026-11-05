# Gestión — aplicación web Dev

Interfaz en español para los microservicios de usuarios, cuentas, archivos, búsqueda y notificaciones. Next.js 16, React 19 y TypeScript. Diseño oscuro con acento verde, navegación adaptable y permisos ADMIN, REVIEWER y MEMBER.

## Arrancar

Requisitos — Docker Desktop en modo Linux, con unos 6 GiB de RAM disponibles para el conjunto. Node 24 y npm solo son necesarios para ejecutar verificaciones desde Windows. La primera compilación descarga imágenes y dependencias.

Desde esta carpeta ejecuta en PowerShell

```powershell
./Start-Dev.ps1
```

O ejecuta `npm run dev:up`. Abre http://localhost:3000. No necesitas credenciales cloud. Los datos y claves de Compose son artificiales, exclusivos del laboratorio local.

Accesos de demostración

- ADMIN — `admin@dev.local` / `DevAdmin123!`
- REVIEWER — `auditor@dev.local` / `DevReview123!`
- MEMBER — `usuario@dev.local` / `DevMember123!`

`npm run dev:down` detiene y retira los contenedores del proyecto. Conserva los volúmenes con tus datos Dev. `npm run dev:logs` muestra los registros. No uses las credenciales Dev fuera de este entorno.

## Funciones

- Resumen con datos reales de las APIs locales, cuentas propias, archivos propios y actividad reciente.
- Usuarios — listado, filtro, detalle, creación, edición, activación, cambio de rol y eliminación por ADMIN. REVIEWER tiene lectura. MEMBER consulta su perfil.
- Cuentas — consulta por propietario para ADMIN y REVIEWER, consulta personal para MEMBER y apertura por ADMIN. El backend exige propietario al listar. No se agregaron saldos ni transferencias.
- Archivos — carga, listado paginado, descarga a través del servidor web, reemplazo con control de revisión y eliminación. ADMIN opera sobre cualquier propietario. Los demás roles operan sobre sí mismos. PDF, PNG y JPEG, máximo 10 MiB, con validación real del servicio.
- Búsqueda — usuarios y cuentas en OpenSearch, consulta con espera de 300 ms, paginación y aislamiento de MEMBER. La sincronización usa Kafka y Outbox, por lo que es eventual.
- Notificaciones — historial persistente PENDING, SENT y FAILED con filtros y paginación. MEMBER ve solo sus eventos. El proveedor local acepta o rechaza correos artificiales. SENT representa aceptación del proveedor de prueba, no entrega a un buzón real.
- Estados de carga, vacío, error y reintento. Formularios con etiquetas, diálogos nativos, foco visible, navegación móvil por teclado y movimiento reducido.

## Arquitectura local

El navegador llama al BFF de Next.js en el mismo origen. El BFF valida la sesión y envía el JWT original al microservicio correspondiente. Nunca entrega el JWT al JavaScript del navegador.

- `src/lib/server.ts` — validación JWT compatible con JJWT, sesión JWE cifrada AES-256-GCM, cookie HttpOnly/SameSite, vencimiento, comprobación de Origin, solicitudes limitadas y traducción de errores.
- `src/app/api/auth/[action]/route.ts` — login, sesión y logout. Login con límite de intentos en memoria para Dev.
- `src/app/api/gateway/[service]/[...path]/route.ts` — lista explícita de operaciones y roles. No es un proxy de destinos arbitrarios. Los archivos pasan por User Service para conservar su integración síncrona existente.
- `src/app/api/download/route.ts` — valida propietario y origen permitido de la URL firmada, descarga desde S3 y transmite el archivo como adjunto al navegador. Las URLs internas no se exponen al cliente.
- `src/components/modules.tsx` — pantallas y operaciones. `shell.tsx` contiene navegación y sesión visual. `ui.tsx` contiene estados, diálogos y paginación.
- `compose.dev.yml` — PostgreSQL 17, Kafka 3.9, Valkey 8, OpenSearch 3.6, S3Mock, proveedor de correo artificial y los cinco servicios reales.
- `infra/fixtures.sql` — tres usuarios y dos cuentas artificiales iniciales. Se ejecuta una vez al crear el volumen PostgreSQL.
- `infra/bootstrap.mjs` — tópicos Kafka, bucket versionado y proyección inicial desde SQL de los productores. Los consumidores procesan los cambios posteriores.
- `infra/mock-mail.mjs` — proveedor de correo artificial. Solo para pruebas locales.

Los puertos publicados se enlazan a 127.0.0.1. Las dependencias internas sin autenticación del laboratorio no se publican. La web usa 3000 y las APIs 18080–18084. El control de fallos del proveedor artificial usa 18086.

## Cambios necesarios en los backends

Se encuentran en worktrees separados, bajo `../90-archivo/integraciones/web-dev/`, en la rama local `feat/web-dev`. Compose compila esos árboles para no mezclar cambios previos de las copias originales.

- User Service — `ProfileRestController`, GET `/api/me`, consulta el usuario correspondiente al sujeto del JWT.
- Account Service — `PersonalAccountsController`, GET `/api/me/accounts`, consulta las cuentas del sujeto del JWT. Security permite ese endpoint a usuarios autenticados y conserva los permisos previos del resto.
- Notification Service — puerto de historial, adaptador JDBC y GET `/api/notifications`. El registro del historial se activa únicamente con `APP_HISTORY_ENABLED=true`. Está desactivado por defecto para conservar el despliegue actual. Migración explícita `V20261104_01__notification_history.sql`, aplicada por Compose. Conserva los contratos y tópicos existentes.
- File Storage y Search — sin cambios de código para esta app. Se compilan sus fuentes existentes.

No se hizo despliegue web, publicación de repositorio ni cambio de secretos cloud. Antes de desplegar se requiere un plan específico de accesos, migraciones, secretos, HTTPS, cookies seguras y proveedores reales.

## Variables del servidor web

Compose las configura automáticamente con valores Dev. `.env.example` documenta las variables para otro entorno local.

- `JWT_SECRET` — mismo secreto Base64 de los servicios locales. Algoritmo HS256, HS384 o HS512 según longitud de la clave, igual que JJWT.
- `WEB_SESSION_KEY` — clave Base64 independiente de exactamente 32 bytes para cifrar la cookie.
- `USERS_URL`, `ACCOUNTS_URL`, `FILES_URL`, `SEARCH_URL`, `NOTIFICATIONS_URL` — destinos internos fijos. El gateway de archivos llama User Service.
- `FILE_DOWNLOAD_ORIGIN` — origen exacto permitido del proveedor de objetos, `http://s3:9090` en Docker Dev.
- `WEB_ORIGINS` — orígenes permitidos para operaciones que modifican datos. Por defecto localhost y 127.0.0.1 en el puerto 3000.
- `COOKIE_SECURE` — `false` para HTTP local. En un futuro despliegue HTTPS debe ser `true`.

No existen variables NEXT_PUBLIC con secretos. `infra/dev.env` contiene únicamente valores artificiales para las pruebas de sesión. Nunca copies secretos de Azure, Render, Aiven o Backblaze a esos archivos.

## Verificar

Con Compose activo

```powershell
npm ci
npm run typecheck
npm run build
npm test
```

Playwright ejecuta pruebas HTTP contra el BFF y los servicios reales del entorno local. Comprueba roles, CSRF, cookies cifradas, expiración, alteración de sesión, entradas inválidas, tamaño de archivo, CRUD de usuarios, búsqueda eventual, apertura de cuenta, historial de envío y fallo, idempotencia y ciclo de vida del archivo. El informe se genera en `playwright-report/`.

Las pruebas solo crean datos artificiales. Eliminan sus usuarios y archivos al terminar. Account Service no ofrece eliminación de cuentas, por lo que la prueba de apertura deja una cuenta artificial adicional para el usuario de demostración. El historial conserva los eventos de prueba para permitir revisar éxito y fallo.

El proveedor artificial se pone temporalmente en modo de fallo durante una prueba y se restaura al terminar. No ejecutes la suite sobre entornos cloud ni cambies sus URLs para apuntar a producción.

Los backends modificados también se verifican con `./mvnw.cmd -B -ntp verify` desde cada worktree, usando JDK 17 y Docker para Testcontainers.

## Alcance Dev

B2 se simula mediante una API S3 versionada compatible y Brevo mediante un servidor HTTP local. Los binarios están en el proveedor S3 local, PostgreSQL guarda metadatos. Kafka, Outbox, autorización, transacciones, búsqueda y caché se ejecutan realmente en contenedores. Esta verificación no prueba conectividad cloud, entrega de correo real ni políticas de un futuro despliegue.

La proyección inicial usa snapshots de PostgreSQL al arrancar el inicializador. Si arrancas de nuevo, el script evita reemplazar revisiones más nuevas. Los cambios posteriores llegan por consumidores independientes de Kafka.

## Evidencia de esta entrega

Ver `docs/verification.json` y las capturas en `docs/screenshots/`. Se verificaron 305 pruebas de usuarios, 11 de cuentas, 28 de notificaciones y seis escenarios HTTP completos de la app. El archivo artificial `ejemplo-ui.pdf` del administrador queda disponible como demostración de la carga y el reemplazo realizados en el navegador.
