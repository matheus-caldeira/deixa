import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const ADAPTERS = [
  "@/infrastructure/database/**",
  "@/infrastructure/tmdb/**",
  "@/infrastructure/google-ai/**",
  "@/infrastructure/kokoro/**",
  "@/infrastructure/storage/**",
  "@/modules/*/infrastructure/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure/**", "@/modules/*/infrastructure/**", "@/modules/*/application/**"],
              message:
                "Componente React não importa infraestrutura nem casos de uso: receba dados por props.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ADAPTERS,
              message: "A borda chama casos de uso pelo container, nunca um adapter.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.ts", "src/modules/*/application/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure/**",
                "@/modules/*/infrastructure/**",
                "drizzle-orm",
                "drizzle-orm/**",
                "next",
                "next/**",
              ],
              message: "Domínio e aplicação dependem só de ports.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "src-tauri/target/**",
    "src-tauri/gen/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "data/**",
    "test-results/**",
    "playwright-report/**",
    "screenshots/**",
  ]),
]);

export default eslintConfig;
