/**
 * Webpack config for the renderer (browser-side) bundle.
 *
 * Compiles TSX/TS → JS, serves via webpack-dev-server with HMR,
 * and injects the compiled app into index.html via HtmlWebpackPlugin.
 *
 * `historyApiFallback: true` is required because React Router (HashRouter)
 * uses the History API — without it, direct URL navigation would 404.
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDev = process.env.NODE_ENV === 'development';

module.exports = {
  mode: isDev ? 'development' : 'production',
  /* Target 'web' instead of 'electron-renderer' so the bundle works in both
     a browser (dev) and Electron's BrowserWindow (production) */
  target: 'web',
  entry: {
    renderer: './src/renderer/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].js',
  },
  devtool: isDev ? 'eval-source-map' : false,
  devServer: {
    port: 3000,
    hot: true,
    /* Force HMR WebSocket to connect via localhost even when the page is
       accessed via the network IP (prevents HMR WebSocket errors) */
    client: {
      webSocketURL: {
        hostname: 'localhost',
        port: 3000,
        pathname: '/ws',
        protocol: 'ws',
      },
    },
    /* Redirect all 404s to index.html so the React router can handle them */
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, 'dist/renderer'),
    },
    /* Proxy API and WebSocket requests to the chess API server.
       Start the API on port 25565: PORT=25565 ts-node src/index.ts */
    proxy: [
      {
        context: ['/auth', '/players', '/games', '/tournaments', '/admin', '/avatars', '/health', '/chess-ws'],
        target: 'http://localhost:25565',
        ws: true,
        changeOrigin: true,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json',
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      inject: true,
      favicon: './assets/icon.png',
    }),
  ],
};
