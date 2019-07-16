module.exports.presets = [
  [
    '@babel/env',
    {
      targets: 'last 2 versions',
      useBuiltIns: 'usage',
      corejs: 3,
    },
  ],
];
