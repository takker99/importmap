export const sortObject = <T>(
  normalized: Record<string, T>,
): Record<string, T> =>
  Object.fromEntries(
    Object.keys(normalized).sort((a, b) => b.length - a.length).map((
      key,
    ) => [key, normalized[key]]),
  );

export const mapObject = <T, U>(
  object: Record<string, T>,
  fn: (value: T, key: string) => readonly [string, U] | undefined,
): Record<string, U> =>
  Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) => {
      const pair = fn(value, key);
      return pair ? [pair] : [];
    }),
  );

// workaround for avoiding "Assertions require every name in the call target to be declared with an explicit type annotation."
export type Panic = <T>(
  x: unknown,
  pred: (x: unknown) => x is T,
  msg: string,
) => asserts x is T;

// workaround for avoiding "Assertions require every name in the call target to be declared with an explicit type annotation."
export type Err = (msg: string) => never;
export const err: Err = (msg) => {
  throw new TypeError(msg);
};

export const panic: Panic = (x, pred, msg) => {
  if (pred(x)) return;
  err(msg);
};
export const isNotNull = <T>(x: unknown): x is NonNullable<T> => x != null;
export const isEndsSlash = (x: unknown): x is `${string}/` =>
  (x as string | undefined)?.at?.(-1) == "/";

export const isURLString = (url: unknown): url is string | URL =>
  URL.canParse(url as string | URL);
