# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## PWA and Android wrapper

Run `npm run build` to produce the web app, manifest, offline shell, and service
worker. The public `/download` route links to the latest GitHub Release APK and
explains Android sideloading and iOS Safari installation.

The Capacitor configuration uses the live production URL and application ID
`com.aliyudavid.mathify`:

```bash
npm ci
npm run build
npm run cap:add:android
npm run cap:sync
```

Native compilation is performed in GitHub Actions with Java 17 and does not
require Android Studio in Codespaces. The resulting debug APK is unsigned and
intended for direct testing, not Play Store publication. The service worker
never caches `/api/` requests or requests carrying authentication headers.
