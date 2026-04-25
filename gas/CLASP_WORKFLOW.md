# CLASP Workflow (Apps Script via VS Code)

This project is configured to use clasp for Google Apps Script development.

## 1) One-time auth

Run:

npm run gas:login

Complete Google OAuth in browser and paste the full localhost redirect URL back into terminal.

## 2) Clone existing script

Use your script ID:

npm run gas:clone -- 1yzo7jChly3Er-LDECdyvvMdYC6-nQLuQMMXp2xXwRaG2H2xiLYkisL0L

For the second sheet (MEN MATERIAL), clone in a separate folder:

mkdir -p gas/apps-script/men-material
cd gas/apps-script/men-material
npm run gas:clone -- 1U2nqRQZxDxmnajTy1vfSyRbX5esE72XNC795BhFtniZh600rLDgadXwn

This creates a local Apps Script project folder with files such as `Code.gs`, `Index.html`, and `appsscript.json`.

## 3) Daily development

Pull latest cloud code before editing:

npm run gas:pull

Push local changes:

npm run gas:push

Create a new immutable project version:

npm run gas:version -- "JSON API mode update"

Deploy web app version:

npm run gas:deploy

List deployments:

npm run gas:deploy:list

## 4) API contract checks before push

From your clasp project root on Windows PowerShell, run:

Get-ChildItem -Recurse -File | Select-String -Pattern 'function doGet\\('
Get-ChildItem -Recurse -File | Select-String -Pattern 'function doPost\\('
Get-ChildItem -Recurse -File | Select-String -Pattern 'function APP_saveEntry\\('
Get-ChildItem -Recurse -File | Select-String -Pattern 'google\\.script\\.run'

Or run packaged checks:

npm run gas:check:entrypoints
npm run gas:check:script-run

Expected:

- exactly 1 `doGet`
- exactly 1 `doPost`
- exactly 1 `APP_saveEntry`
- zero `google.script.run` in HTML that has been migrated to fetch API

## 5) Direct API smoke test

Open:

https://script.google.com/macros/s/AKfycbx_sSqGvqWTnW8--DSirt9SH-hMMuDenZUz08ea50M1i3cJmG7Y0aLdhChBWVEKvQeg/exec?action=records&token=Lace%20%26%20Gayle

Expected JSON payload (not HTML).

## 6) Frontend base URL rule

For GAS-hosted HTML, use:

const GAS_API_BASE = window.location.origin + window.location.pathname;

Avoid hardcoded domain URLs in frontend code.
