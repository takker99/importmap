import { assert, assertEquals, assertThrows } from "@std/assert";
import { type ImportMap, isImportMap } from "./import_map.ts";
import { resolveImportMap, resolveModuleSpecifier } from "./resolve.ts";

interface TestData {
  importMap: ImportMap;
  importMapBaseURL: string;
  baseURL: string;
  expectedResults?: Record<string, unknown>;
  expectedParsedImportMap?: ImportMap;
  tests?: Record<string, TestData>;
}

async function runTests(
  data: TestData,
  t: Deno.TestContext,
) {
  const {
    tests,
    importMap,
    importMapBaseURL,
    baseURL,
  } = data;
  if (!tests) {
    const { expectedResults, expectedParsedImportMap } = data;
    if (!isImportMap(importMap) || expectedParsedImportMap === null) {
      assert(!isImportMap(importMap));
      return;
    }
    const resolvedImportMap = resolveImportMap(
      importMap,
      new URL(importMapBaseURL),
    );
    if (expectedParsedImportMap) {
      assertEquals(resolvedImportMap, expectedParsedImportMap);
    }
    if (!expectedResults) return;
    for (
      const [key, expectedResult] of Object.entries(expectedResults)
    ) {
      if (expectedResult === null) {
        assertThrows(() => {
          resolveModuleSpecifier(
            key,
            resolvedImportMap,
            new URL(baseURL),
          );
        });
      } else {
        const resolvedModuleSpecifier = resolveModuleSpecifier(
          key,
          resolvedImportMap,
          new URL(baseURL),
        );
        assertEquals(resolvedModuleSpecifier, expectedResult);
      }
    }
    return;
  }
  for (const [testName, test] of Object.entries(tests)) {
    await t.step(testName, (t) => {
      const inheritedTestData = {
        importMap: test.importMap || importMap,
        importMapBaseURL: test.importMapBaseURL || importMapBaseURL,
        baseURL: test.baseURL || baseURL,
        expectedParsedImportMap: test.expectedParsedImportMap,
        expectedResults: test.expectedResults,
        tests: test.tests,
      };
      return runTests(inheritedTestData, t);
    });
  }
}

// testdata from https://github.com/web-platform-tests/wpt/tree/master/import-maps/data-driven/resources
const testdataDir = "./testdata";
for await (const { name } of Deno.readDir(testdataDir)) {
  Deno.test(
    name,
    async (t) =>
      await runTests(
        (await import(`./${testdataDir}/${name}`, { with: { type: "json" } }))
          .default,
        t,
      ),
  );
}
