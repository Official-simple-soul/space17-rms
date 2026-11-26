import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import { isLocalSupabase, LOCAL_STORAGE_PATH } from "./src/lib/files/local";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
/** This computer's own addresses, so a phone on the same network can open the development app. */
const ownAddresses = Object.values(networkInterfaces())
  .flatMap((list) => list ?? [])
  .filter((a) => a.family === "IPv4")
  .map((a) => a.address);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  // Development only. Local links and emails use 127.0.0.1; without this, pages opened there never
  // become interactive.
  allowedDevOrigins: ownAddresses,
  async rewrites() {
    return isLocalSupabase(supabaseUrl)
      ? [
          {
            source: `${LOCAL_STORAGE_PATH}/storage/v1/object/:path*`,
            destination: `${supabaseUrl}/storage/v1/object/:path*`,
          },
        ]
      : [];
  },
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Invitation links carry secrets in the URL, so never send a referrer off-site.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
