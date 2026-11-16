const reportDir = process.env.STRYKER_REPORT_DIR;
if (!reportDir)
  throw new Error(
    "Use npm run test:mutation to create an isolated test database and report directory",
  );

export default {
  // All TypeScript config references are inside this repository; no sandbox path rewrite is needed.
  // TypeScript 7 removed the API used by Stryker 10 for rewriting.
  tsconfigFile: ".stryker-no-rewrite-tsconfig.json",
  ignorePatterns: [
    ".harness/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    "test-results/**",
    "playwright-report/**",
    "dist/**",
  ],
  testRunner: "command",
  commandRunner: {
    command:
      process.env.STRYKER_TEST_MODE === "e2e"
        ? "node scripts/mutation-e2e.mjs"
        : "npx vitest run --no-file-parallelism",
  },
  coverageAnalysis: "off",
  concurrency: 1,
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: `${reportDir}/index.html` },
  jsonReporter: { fileName: `${reportDir}/mutation.json` },
  timeoutMS: 30000,
};
