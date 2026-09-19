import createNextIntlPlugin from "next-intl/plugin";
import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@memora/contracts", "@memora/domain", "@memora/ui"]
};

export default createNextIntlPlugin("./src/lib/i18n/request.ts")(nextConfig);
