#!/bin/sh
npm ci --omit=dev 2>/dev/null || true
cd server && npm ci --omit=dev --omit=peer --omit=optional
npx --yes prisma generate
rm -rf node_modules/@prisma/client/runtime/*sqlserver* \
       node_modules/@prisma/client/runtime/*postgresql* \
       node_modules/@prisma/client/runtime/*mysql* \
       node_modules/@prisma/client/runtime/*cockroachdb* \
       node_modules/@prisma/client/runtime/*.map \
       node_modules/@cloudflare
