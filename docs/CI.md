# Integración continua

CI ejecuta en push a develop/main/deploy y en PR, con permisos contents:read, acciones fijadas por SHA, cancelación de ejecuciones obsoletas y tiempos máximos. No despliega ni accede a credenciales cloud.

## Controles automáticos

- Quality and coverage: instalación reproducible npm ci, Prettier, TypeScript, Vitest con V8, build de producción y npm audit (falla con vulnerabilidades altas/críticas).
- Desktop and mobile browsers: Chromium, Firefox, WebKit desktop y WebKit móvil; acceso, errores, foco, contraseña, preferencia de movimiento, navegación y accesibilidad WCAG A/AA grave/crítica con axe.
- Production container: imagen multi-stage Next standalone, usuario node sin privilegios, comprobación de /api/health y /login. /api/health es liveness, no disponibilidad de dependencias.
- Security: CodeQL JavaScript/TypeScript, revisión de nuevas dependencias en PR y ejecución semanal. Dependabot propone actualizaciones npm, Docker y Actions hacia develop.

## Qué demuestra cada nivel

`npm run test:unit`: prueba el BFF real con cookies y transporte simulados. Incluye JWT HS256/384/512, sesiones cifradas, caducidad, roles, CSRF, límites, multipart, idempotencia, sanitización y origen de descargas. Los umbrales de cobertura aplican exclusivamente a src/lib/server.ts y rutas API: líneas/funciones/sentencias 95%, ramas 85%. No representan cobertura total de React.

`npm run build && npm run test:e2e`: ejecuta la compilación standalone real en 3100 contra un proveedor artificial en 3199. No demuestra transacciones, Kafka, OpenSearch ni entrega real. Las pruebas fallidas guardan capturas, vídeo, trazas, JUnit e informe HTML. Las trazas pueden contener sesiones artificiales; retención 7 días.

`npm run test:stack`: usa http://localhost:3000 y todos los servicios reales de Compose Dev. Prueba aislamiento, usuarios, cuentas, proyección eventual, historial de envío/fallo y ciclo completo de archivos. Genera datos exclusivamente artificiales. Deja una cuenta artificial porque el backend no ofrece borrado de cuentas. Nunca apuntar esta suite a producción.

## Full stack en GitHub

Workflow manual Full stack, limitado a develop/main/deploy. Requiere el secreto BACKEND_READ_TOKEN: token de lectura Contents:read para los cinco repositorios listados en infra/ci/backends.json (Files y Search son privados). El GITHUB_TOKEN del frontend no puede leer esos repositorios. No se usa ese secreto en PR ni en código de forks. El token solo se pasa al paso de preparación y no se escribe en archivos o configuración Git.

Las fuentes se descargan por commit SHA. Los tres parches en infra/ci/patches contienen las adaptaciones Dev ya existentes (perfil propio, cuentas propias e historial). Evitan depender de carpetas locales no versionadas; no alteran los repositorios backend. Al integrar estos cambios en sus repositorios, actualizar el manifiesto y retirar los parches equivalentes.

El preparador genera .ci/compose.json con rutas absolutas, después el workflow construye los cinco servicios, arranca PostgreSQL/Kafka/Valkey/OpenSearch/S3Mock/correo artificial, ejecuta la suite y elimina contenedores y volúmenes al terminar. Presupuesto de ejecución: 45 minutos. Se conserva diagnóstico de servicios y pruebas 7 días. No equivale a pruebas con Backblaze/Brevo reales.

Para comprobar las fuentes sin GitHub desde el workspace existente: `python infra/ci/prepare-stack.py --local`. Requiere .ci/workspace vacía. En un clon independiente se usa el modo GitHub con BACKEND_READ_TOKEN.

## Antes de promover a deploy

Requerir en las reglas de rama Quality and coverage, Desktop and mobile browsers y Production container, revisión de PR y conversaciones resueltas. CODEOWNERS identifica rutas sensibles pero por sí solo no obliga una revisión. Las reglas se configuran en GitHub Settings y requieren los nombres de checks de una primera ejecución. Full stack debe pasar cuando cambian contratos; hasta configurar su token, su validación cloud queda pendiente.

La imagen de producción todavía necesita secretos y URLs correctas para ofrecer las funciones autenticadas. No contiene credenciales ni arranca Docker Dev. No hay publicación de imagen ni despliegue automático en estos workflows.
