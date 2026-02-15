import js from "@eslint/js";

export default [
  { ignores: ["build", "node_modules"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];