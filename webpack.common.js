const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    sidplayer: './src/SidPlayer.ts',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src', 'SidPlayer.html'),
          to: path.resolve(__dirname, 'dist', 'index.html'),
        },
        {
          from: path.resolve(__dirname, 'src', 'SidPlayer.css'),
          to: path.resolve(__dirname, 'dist'),
        },
        {
          from: path.resolve(__dirname, 'src', 'sids'),
          to: path.resolve(__dirname, 'dist', 'sids'),
        },
        {
          from: path.resolve(__dirname, 'src', 'favicon.ico'),
          to: path.resolve(__dirname, 'dist'),
        },
        {
          from: path.resolve(__dirname, 'src', 'C64SidProcessor.js'),
          to: path.resolve(__dirname, 'dist'),
        },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: [
          path.resolve(__dirname, 'src'),
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'sidplayer.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  experiments: {
    topLevelAwait: true,
  },
};
