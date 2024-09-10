import {
  err,
  isEndsSlash,
  isNotNull,
  isURLString,
  mapObject,
  panic,
  sortObject,
} from "./utils.ts";
import type { ImportMap, ModuleSpecifierMap, Scopes } from "./import_map.ts";

/** https://html.spec.whatwg.org/multipage/webappapis.html#sorting-and-normalizing-a-module-specifier-map */
const sortAndNormalizeSpecifierMap = (
  originalMap: ModuleSpecifierMap,
  baseURL: URL,
): Ok<ModuleSpecifierMap> => {
  const warnings: Warning[] = [];
  const specifierMap = sortObject(mapObject(
    originalMap,
    (value, specifierKey) => {
      const res = normalizeSpecifierKey(
        specifierKey,
        baseURL,
      );
      const normalizedSpecifierKey = unwrapOk(res);
      if (!isNotNull(normalizedSpecifierKey)) {
        warnings.push(...warns(res));
        return;
      }

      const nullPair = [normalizedSpecifierKey, null] as const;
      if (!isNotNull(value)) {
        warnings.push({
          name: "addresses need to be strings.",
          key: specifierKey,
        });
        return nullPair;
      }
      const addressURL = resolveUrlLikeModuleSpecifier(value, baseURL);
      if (!isNotNull(addressURL)) {
        warnings.push({
          name: "the address was invalid.",
          key: specifierKey,
          value,
        });
        return nullPair;
      }
      if (
        isEndsSlash(specifierKey) && !isEndsSlash(serializeURL(addressURL))
      ) {
        warnings.push({
          name:
            "the address was invalid since it was not a URL that started with the base URL.",
          key: specifierKey,
          value: `${addressURL}`,
        });
        return nullPair;
      }
      return [normalizedSpecifierKey, serializeURL(addressURL)];
    },
  ));
  return createOk(specifierMap, warnings);
};

/** https://url.spec.whatwg.org/#concept-url-serializer */
const serializeURL = <T extends URL | null>(
  url: T,
): T extends URL ? string : undefined =>
  url?.href as T extends URL ? string : undefined;

/** https://wicg.github.io/import-maps/#sort-and-normalize-scopes */
const sortAndNormalizeScopes = (
  originalMap: Scopes,
  baseURL: URL,
): Ok<Scopes> => {
  const warnings: Warning[] = [];
  const scopes = sortObject(
    mapObject(originalMap, (potentialSpecifierMap, scopePrefix) => {
      let scopePrefixURL;
      try {
        scopePrefixURL = new URL(scopePrefix, baseURL);
      } catch {
        warnings.push({
          name: "scope prefix URL was not parseable.",
          key: scopePrefix,
        });
        return;
      }
      const res = sortAndNormalizeSpecifierMap(
        potentialSpecifierMap,
        baseURL,
      );
      warnings.push(...warns(res));
      return [
        serializeURL(scopePrefixURL),
        sortObject(unwrapOk(res)),
      ];
    }),
  );
  return createOk(scopes, warnings);
};

/** https://html.spec.whatwg.org/multipage/webappapis.html#normalizing-a-specifier-key */
const normalizeSpecifierKey = (
  specifierKey: string,
  baseURL: URL,
): Ok<string | null> => {
  if (!specifierKey.length) {
    return createOk(null, [{
      name: "specifier key cannot be an empty string.",
    }]);
  }
  const url = resolveUrlLikeModuleSpecifier(specifierKey, baseURL);
  return createOk(isNotNull(url) ? serializeURL(url) : specifierKey);
};
/** https://html.spec.whatwg.org/multipage/webappapis.html#resolving-a-url-like-module-specifier */
const resolveUrlLikeModuleSpecifier = (
  specifier: string,
  baseURL: URL,
): URL | null => {
  try {
    return new URL(
      specifier,
      startsWith(specifier, ["/", "./", "../"]) ? baseURL : undefined,
    );
  } catch {
    return null;
  }
};

const startsWith = (str: string, searches: string[]) =>
  searches.some((search) => str.startsWith(search));

const specialProtocols = [
  "ftp:",
  "file:",
  "http:",
  "https:",
  "ws:",
  "wss:",
];
/* https://url.spec.whatwg.org/#is-special */
const isSpecial = (asURL: URL) => specialProtocols.includes(asURL.protocol);

const MUST_BE_URL = /*#__PURE__*/ `resolutionResult must be an URL.`;

/* https://wicg.github.io/import-maps/#resolve-an-imports-match */
const resolveImportsMatch = (
  normalizedSpecifier: string,
  asURL: URL | null,
  specifierMap: ModuleSpecifierMap,
): string | null => {
  for (
    const [specifierKey, resolutionResult] of Object.entries(specifierMap)
  ) {
    if (specifierKey === normalizedSpecifier) {
      panic(resolutionResult, isNotNull, `resolutionResult must not be null.`);
      panic(resolutionResult, isURLString, MUST_BE_URL);
      return resolutionResult;
    }
    if (
      isEndsSlash(specifierKey) &&
      normalizedSpecifier.startsWith(specifierKey) &&
      (!isNotNull(asURL) || isSpecial(asURL))
    ) {
      panic(
        resolutionResult,
        isNotNull,
        `resolution of specifierKey was blocked by a null entry.`,
      );
      panic(resolutionResult, isURLString, MUST_BE_URL);
      panic(
        resolutionResult,
        isEndsSlash,
        `resolutionResult must end with "/".`,
      );

      try {
        const afterPrefix = normalizedSpecifier.slice(specifierKey.length);
        const url = new URL(afterPrefix, resolutionResult);
        if (!serializeURL(url).startsWith(resolutionResult)) {
          err(
            `resolution of normalizedSpecifier was blocked due to it backtracking above its prefix specifierKey.`,
          );
        }
        return serializeURL(url);
      } catch {
        err(
          `resolution of normalizedSpecifier was blocked since the afterPrefix portion could not be URL-parsed relative to the resolutionResult mapped to by the specifierKey prefix.`,
        );
      }
    }
  }
  return null;
};

/**
 * The warning that occurred during the resolution of the import map.
 */
export type Warning =
  | NotStringAddress
  | InvalidAddress
  | NotStartsWithBaseURL
  | InvalidScopePrefix
  | EmptySpecifierKey;
/**
 * The warning that occurred during the resolution of the import map.
 */
export interface NotStringAddress {
  /**
   * The value of the warning.
   */
  name: "addresses need to be strings.";
  /**
   * The key of the warning.
   */
  key: string;
}

/**
 * The warning that occurred during the resolution of the import map.
 */
export interface InvalidAddress {
  /**
   * The value of the warning.
   */
  name: "the address was invalid.";
  /**
   * The key of the warning.
   */
  key: string;
  /**
   * The value of the warning.
   */
  value: string;
}

/**
 * The warning that occurred during the resolution of the import map.
 */
export interface NotStartsWithBaseURL {
  /**
   * The value of the warning.
   */
  name:
    "the address was invalid since it was not a URL that started with the base URL.";
  /**
   * The key of the warning.
   */
  key: string;
  /**
   * The value of the warning.
   */
  value: string;
}
/**
 * The warning that occurred during the resolution of the import map.
 */
export interface InvalidScopePrefix {
  /**
   * The value of the warning.
   */
  name: "scope prefix URL was not parseable.";
  /**
   * The key of the warning.
   */
  key: string;
}
/**
 * The warning that occurred during the resolution of the import map.
 */
export interface EmptySpecifierKey {
  /**
   * The value of the warning.
   */
  name: "specifier key cannot be an empty string.";
}

/**
 * The error that occurred during the resolution of the import map.
 */
export interface KeyError {
  /**
   * The name of the error.
   */
  name: "KeyError";
  /**
   * The message of the error.
   */
  message: string;
}
/**
 * The error that occurred during the resolution of the import map.
 */
export interface Ok<T> {
  /**
   *  Whether the result is ok.
   */
  ok: true;
  /**
   * The value of the result.
   */
  value: T;
  /**
   * The warnings that occurred during the resolution of the import map.
   */
  warnings?: Warning[];
}
/**
 * The error that occurred during the resolution of the import map.
 */
export interface Err<E> {
  /**
   * Whether the result is ok.
   */
  ok: false;
  /**
   * The error of the result.
   */
  error: E;
  /**
   * The warnings that occurred during the resolution of the import map.
   */
  warnings?: Warning[];
}
/**
 * The result of the resolution of the import map.
 */
export type Result<T, E> = Ok<T> | Err<E>;

const createOk = <T>(value: T, warnings?: Warning[]): Ok<T> => ({
  ok: true,
  value,
  warnings,
});
const unwrapOk = <T>(result: Ok<T>): T => result.value;
const warns = <T, E>(result: Result<T, E>): Warning[] => result.warnings ?? [];

/**
 * Resolves the import map by sorting and normalizing the imports and scopes.
 *
 * https://wicg.github.io/import-maps/#parsing
 *
 * @param importMap - The import map to resolve.
 * @param baseURL - The base URL to resolve relative URLs.
 * @returns The resolved import map with sorted and normalized imports and scopes.
 * @throws {TypeError} If the top-level value is not a JSON object, or if the "imports" top-level key is not an object, or if the "scopes" top-level key is not an object.
 */
export const resolveImportMap = (
  importMap: ImportMap,
  baseURL: URL,
): ImportMap => {
  const imports = sortAndNormalizeSpecifierMap(
    importMap.imports ?? {},
    baseURL,
  );
  const scopes = sortAndNormalizeScopes(importMap.scopes ?? {}, baseURL);

  for (const warning of [...warns(imports), ...warns(scopes)]) {
    console.warn(warning);
  }

  return {
    imports: unwrapOk(imports),
    scopes: unwrapOk(scopes),
  };
};

/**
 * Resolves the module specifier based on the provided ImportMap, baseURL, and imports.
 *
 * https://wicg.github.io/import-maps/#new-resolve-algorithm
 *
 * @param specifier - The module specifier to resolve.
 * @param imports - The imports defined in the ImportMap.
 * @param scopes - The scopes defined in the ImportMap.
 * @param baseURL - The base URL to resolve the module specifier against.
 * @returns The resolved module specifier.
 * @throws {TypeError} If the specifier is a bare specifier and not remapped in the importMap.
 */
export const resolveModuleSpecifier = (
  specifier: string,
  { imports = {}, scopes = {} }: ImportMap,
  baseURL: URL,
): string => {
  const baseURLString = serializeURL(baseURL);
  const asURL = resolveUrlLikeModuleSpecifier(specifier, baseURL);
  const normalizedSpecifier = serializeURL(asURL) ?? specifier;

  for (const [scopePrefix, scopeImports] of Object.entries(scopes)) {
    if (
      scopePrefix === baseURLString ||
      (isEndsSlash(scopePrefix) && baseURLString.startsWith(scopePrefix))
    ) {
      const scopeImportsMatch = resolveImportsMatch(
        normalizedSpecifier,
        asURL,
        scopeImports,
      );
      if (isNotNull(scopeImportsMatch)) {
        return scopeImportsMatch;
      }
    }
  }

  const topLevelImportsMatch = resolveImportsMatch(
    normalizedSpecifier,
    asURL,
    imports,
  );

  if (isNotNull(topLevelImportsMatch)) {
    return topLevelImportsMatch;
  }

  if (isNotNull(asURL)) {
    return serializeURL(asURL);
  }
  err(
    `specifier was a bare specifier, but was not remapped to anything by importMap.`,
  );
};
