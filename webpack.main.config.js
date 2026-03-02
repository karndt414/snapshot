const webpack = require('webpack');
module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main.js',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify('https://fkviyesjakytcjpwmpvg.supabase.co'),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_iGDjvy9SDOaI04f8bdgohA_B0mPnWH3'),
      'process.env.SNAPSHOT_SERVER_URL': JSON.stringify('https://szildajorbodyqjkddzx.supabase.co'), // Replace with your server URL
      'process.env.SNAPSHOT_API_KEY': JSON.stringify('sb_publishable_4cRWlmo693rt6aPU8Tmqjg_ZDnfLWJV'), // Replace with your API key
    }),
  ],
};