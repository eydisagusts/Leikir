const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
// Find the Next.js workspace root
const workspaceRoot = path.resolve(projectRoot, "../dulur_global");

const config = getDefaultConfig(projectRoot);

// 1. Watch the workspace root so changes in Next.js folder trigger Fast Refresh
config.watchFolders = [workspaceRoot];

// 2. Resolve modules properly from both locations (if needed, although monorepo isn't strict here)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Let Metro know where to find node modules and resolve aliases correctly if they use '@/lib'
config.resolver.alias = {
  ...config.resolver.alias,
  '@': path.resolve(workspaceRoot, 'src')
};


module.exports = withNativeWind(config, { input: "./global.css" });
