// Metro config tuned for the pnpm monorepo: watch the workspace root and let
// Metro resolve the @elite/* packages (and their deps) from the repo-level
// node_modules as well as the app-local one.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo so changes to @elite/* hot-reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from both the app and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. With pnpm's symlinked store, disable hierarchical lookup so Metro uses
//    the explicit nodeModulesPaths above, and follow symlinks.
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;

// 4. Map the workspace package names to their source so the app consumes the
//    TypeScript source directly (no pre-build step needed in dev).
config.resolver.extraNodeModules = {
  '@elite/types': path.resolve(workspaceRoot, 'packages/types/src'),
  '@elite/core': path.resolve(workspaceRoot, 'packages/core/src'),
  '@elite/ui': path.resolve(workspaceRoot, 'packages/ui/src'),
  '@elite/i18n': path.resolve(workspaceRoot, 'packages/i18n/src'),
};

module.exports = config;
