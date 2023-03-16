export type GetVarName<V> = V extends `${infer N}:${string}` ? N : never;

export type ScopeOf<R extends string> =
  R extends `${string}:scope {${infer S}}${string}`
    ? S
    : R extends `:scope{${infer S}}`
    ? S
    : "";

export type CssVars<R extends string> =
  R extends `${string} --${infer V};${infer Rest}`
    ? GetVarName<V> | CssVars<Rest>
    : never;

export type StylesheetParams<C extends string> = Record<
  CssVars<ScopeOf<C>>,
  string
>;
