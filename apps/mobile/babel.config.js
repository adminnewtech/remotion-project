module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // expo-router requires this; reanimated plugin MUST be last.
      'react-native-reanimated/plugin',
    ],
  };
};
