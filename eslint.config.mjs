import coreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * Next 16 removed `next lint`, so ESLint is invoked directly and this file
 * replaces .eslintrc.json. Running ESLint itself means build output has to be
 * ignored here rather than inferred by Next.
 */
export default [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
  ...coreWebVitals,
  {
    /**
     * eslint-config-next 16 enables the React Compiler rules. They report real
     * problems in components written before those rules existed — impure calls
     * during render, use before declaration, and cascading renders from
     * setState in an effect — across two dozen files.
     *
     * Fixing them changes render behaviour, which does not belong in the same
     * change as a framework upgrade: a production problem afterwards should
     * point at one or the other, not both. They are reported rather than
     * enforced until that work lands, and are deliberately not switched off, so
     * every lint run keeps showing them.
     */
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];
