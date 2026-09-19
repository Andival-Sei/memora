import type {VercelConfig} from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",
  installCommand: "npm install",
  outputDirectory: "apps/web/.next"
};
