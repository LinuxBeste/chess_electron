/**
 * Webpack config for the Electron main process and preload script.
 *
 * Unlike the renderer, this targets 'electron-main' — no DOM, no browser APIs.
 * __dirname/__filename are set to false so Electron uses real file paths
 * instead of polyfill-driven ones (which break native module resolution).
 */

const path = require('path');

module.exports = {
  mode: 'production',
  /* electron-main target ensures Node.js built-ins are external and
     the bundle has access to Electron's process/ipc APIs */
  target: 'electron-main',
  entry: {
    main: './src/main/main.ts',
    preload: './src/main/preload.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.main.json',
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  /* Preserve the real __dirname/__filename — Electron's main process
     needs the actual filesystem path for native modules and IPC */
  node: {
    __dirname: false,
    __filename: false,
  },
};
