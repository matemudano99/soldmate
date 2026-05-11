module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,ts}",
    "../../packages/app/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
