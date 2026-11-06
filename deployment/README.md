# Web in Azure Container Apps

The Next.js standalone container runs as non-root on port 3000. Browser requests go to this web application's BFF. The BFF forwards the user's original JWT to the existing services; tokens and backend credentials never enter public client configuration.

## Runtime configuration

- `JWT_SECRET`: secret reference, same Base64 signing key as User/Account Service.
- `WEB_SESSION_KEY`: separate Base64 key of exactly 32 random bytes, secret reference. Rotating it invalidates web sessions.
- `USERS_URL`, `ACCOUNTS_URL`, `FILES_URL`, `SEARCH_URL`: actual HTTPS backend base URLs, without trailing slash.
- `NOTIFICATIONS_URL`: internal HTTPS base URL of Notifications in the same Container Apps environment. Its port 8082 remains internal.
- `FILE_DOWNLOAD_ORIGIN`: exact origin of the B2 endpoint already configured in File Storage. Signed download URLs are checked against this allowlist.
- `WEB_ORIGINS`: exact public HTTPS origin of the web app, used for CSRF checks.
- `COOKIE_SECURE=true`: encrypted HttpOnly, SameSite=Lax cookies over HTTPS.
- `WEB_DEMO_ACCESS=false`: synthetic login shortcuts are off by default. Enable only in the isolated local Dev stack.

Use the existing `env-users-management-demo` in North Central US. Start with Consumption, 0.5 CPU, 1 GiB, minimum zero and maximum one web replica. The Kafka consumers remain at minimum one; HTTP scaling of this frontend must not control workers. Resources and logs can consume the Students credit.

The image is private in GHCR. Azure holds a read-packages registry credential as a secret. GitHub's publication job uses its temporary `GITHUB_TOKEN`; no registry password is committed.

## Delivery pipeline

1. Open a PR into `main`. CI checks formatting, TypeScript, unit coverage, browser tests, accessibility, dependency audit and a non-root production container. Security and dependency review run separately.
2. Promote the reviewed commit to `deploy`. `Cloud release` first calls the same reusable CI workflow, then publishes `ghcr.io/duvanal/users-management-web:<commit-sha>` with SBOM and provenance. There is no duplicate standalone CI run on the deploy push.
3. The deployment job uses the `production` GitHub environment. Its branch policy permits only `deploy`.
4. Azure OIDC trusts only `repo:duvanAL@200719598/users-management-web@1447389709:environment:production`. The user-assigned identity has Container Apps Contributor at the **web app resource only**, with no subscription-wide role and no database access.
5. Deployment updates only the immutable image, preserving runtime secrets and configuration. The job checks `/api/health` and verifies that the login HTML contains no synthetic Dev access panel.

Release runs directly on the `deploy` push so the environment branch policy sees `refs/heads/deploy`. Do not switch this deployment to `workflow_run`: that event uses the default branch context, which the production policy correctly rejects.

The federated subject must match the exact value emitted by GitHub. This repository uses the immutable owner/repository IDs in the subject; do not substitute the older name-only format. Issuer is `https://token.actions.githubusercontent.com` and audience is `api://AzureADTokenExchange`.

Environment variables in GitHub `production` are `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_WEB_APP`, `WEB_URL`. These are identifiers and URLs, not credentials. App secrets belong in Azure, not GitHub variables or `NEXT_PUBLIC_*`.

For the first setup only, manually run `Cloud release` on the reviewed `main` with `bootstrap_only=true`. This publishes an image and deliberately omits deployment because the web resource does not yet exist. Create/configure the app using that image, then grant its resource-scoped OIDC role and promote to `deploy`. Normal releases do not use the bootstrap flag. Buildx uses the `docker-container` driver because SBOM/provenance attestations are unsupported by the runner's default Docker driver.

## Verification and rollback

`/api/health` is liveness, not a complete dependency check. After release, verify actual authentication, own profile/accounts, authorization, search, file listing and notification history with a real user. Anonymous workspace routes must redirect to login and anonymous gateway requests must return 401. Never report local mock tests as proof of cloud connectivity.

The login requires an existing production user. Local accounts such as `admin@dev.local` are artificial and do not log in to cloud services. Render's free User Service may take over a minute to wake up; a 503 during cold start should be retried once the backend becomes ready, without changing credentials or creating extra users.

To roll back, select the preceding verified GHCR commit tag and update only this web app's image. Keep its session key, JWT key and endpoint configuration unchanged. On Express environments use app-level stop/start when a running process has not adopted a setting; revision suffixes and revision restart are unsupported. Confirm health after any restart.

To run locally, use the documented Dev Compose project. It uses artificial secrets, providers and data; never substitute cloud credentials into `infra/dev.env` or commit real values to `.env` files.
