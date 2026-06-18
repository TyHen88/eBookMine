import next from "eslint-config-next";

// eslint-config-next v16 ships a native flat-config array (core-web-vitals +
// typescript rules), so it can be spread directly — no FlatCompat needed.
const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "public/**"],
  },
];

export default eslintConfig;
