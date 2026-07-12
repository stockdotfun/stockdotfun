// The indexer has no CSS. Ponder uses Vite, which otherwise walks up the
// directory tree and picks up the frontend's Tailwind PostCSS config
// (@tailwindcss/postcss, not installed here). This empty config stops that
// search so `ponder start` doesn't try to load the app's PostCSS pipeline.
export default { plugins: {} };
