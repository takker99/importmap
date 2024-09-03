import {
  asOptional,
  isNull,
  isObjectOf,
  isRecordObjectOf,
  isString,
  isUnionOf,
} from "@core/unknownutil";

/**
 * Represents a map of import specifiers to URLs.
 *
 * https://html.spec.whatwg.org/multipage/webappapis.html#module-specifier-map
 */
export interface ModuleSpecifierMap {
  /**
   * A map of import specifiers to URLs.
   */
  [url: string]: string | null;
}

/**
 * Checks if a value is a module specifier map.
 */
export const isModuleSpecifierMap: (x: unknown) => x is ModuleSpecifierMap =
  /*#__PURE__*/ isRecordObjectOf(isUnionOf([isString, isNull]), isString);

/**
 * Represents a map of URL prefixes to maps of import specifiers to URLs.
 */
export interface Scopes {
  /**
   * A map of URL prefixes to maps of import specifiers to URLs.
   */
  [url: string]: ModuleSpecifierMap;
}

/**
 * Checks if a value is a scopes map.
 */
export const isScopes: (x: unknown) => x is Scopes =
  /*#__PURE__*/ isRecordObjectOf(
    isModuleSpecifierMap,
    isString,
  );

/**
 * Represents a map of integrity hashes to URLs.
 *
 * https://html.spec.whatwg.org/multipage/webappapis.html#module-integrity-map
 */
export interface ModuleIntegrityMap {
  /**
   * A map of integrity hashes to URLs.
   */
  [url: string]: string;
}

/**
 * Checks if a value is a module integrity map.
 */
export const isModuleIntegrityMap: (x: unknown) => x is ModuleIntegrityMap =
  /*#__PURE__*/ isRecordObjectOf(isString, isString);

/**
 * Represents an import map.
 */
export interface ImportMap {
  /**
   * A map of import specifiers to URLs.
   */
  imports?: ModuleSpecifierMap;

  /**
   * A map of URL prefixes to maps of import specifiers to URLs.
   */
  scopes?: Scopes;

  /**
   * A map of integrity hashes to URLs.
   */
  integrity?: ModuleIntegrityMap;
}

/**
 * Checks if a value is an import map.
 */
export const isImportMap: (x: unknown) => x is ImportMap =
  /*#__PURE__*/ isObjectOf({
    imports: asOptional(isModuleSpecifierMap),
    scopes: asOptional(isScopes),
    integrity: asOptional(isModuleIntegrityMap),
  });
