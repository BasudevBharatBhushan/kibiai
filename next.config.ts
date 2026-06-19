import type { NextConfig } from "next";
import path from "path";

const pivotheadExportStub = path.resolve(
  process.cwd(),
  "src/lib/pivot/pivotheadExportStubs.ts"
);
const pivotheadExportStubForTurbopack = "./src/lib/pivot/pivotheadExportStubs.ts";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cyktaxhjbwdottrailkn.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      xlsx: pivotheadExportStubForTurbopack,
      jspdf: pivotheadExportStubForTurbopack,
      "jspdf-autotable": pivotheadExportStubForTurbopack,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      xlsx: pivotheadExportStub,
      jspdf: pivotheadExportStub,
      "jspdf-autotable": pivotheadExportStub,
    };
    return config;
  },
};

export default nextConfig;



