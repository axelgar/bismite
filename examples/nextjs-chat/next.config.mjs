/** @type {import('next').NextConfig} */
export default {
  // The SDK ships TypeScript source (no build step) — let Next transpile it.
  transpilePackages: ["bismite"],
  // bismite.dev is the marketing site: the homepage serves the static landing page,
  // and the chat demo lives at /demo (moved from /). beforeFiles runs before the app
  // routes, so "/" maps to the landing without an ugly redirect.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
    };
  },
};
