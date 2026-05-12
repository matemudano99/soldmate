// En GitHub Actions se pone GITHUB_PAGES=true para generar archivos estáticos.
// En Docker / desarrollo local se usa el modo 'standalone' (servidor Node).
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoName = "soldmate-mvp"; // nombre del repositorio en GitHub

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile packages that use React Native
  transpilePackages: [
    "app",
    "react-native",
    "react-native-web",
    "solito",
    "nativewind",
    "react-native-reanimated",
    "react-native-safe-area-context",
    "react-native-screens",
    "lucide-react-native",
    "react-native-svg",
    "@react-native/assets-registry",
  ],

  // 'export'     → HTML + CSS + JS estáticos (GitHub Pages)
  // 'standalone' → Servidor Node optimizado (Docker)
  output: isGithubPages ? "export" : "standalone",

  // GitHub Pages sirve desde /soldmate-mvp/ (nombre del repo)
  basePath: isGithubPages ? `/${repoName}` : "",
  assetPrefix: isGithubPages ? `/${repoName}/` : "",

  // next/image necesita un servidor para optimizar; en modo estático desactivamos la optimización
  images: {
    unoptimized: isGithubPages,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "lucide-react-native": "lucide-react",
    };
    return config;
  },
};

export default nextConfig;
