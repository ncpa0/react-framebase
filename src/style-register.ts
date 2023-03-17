import type { StyleSheet } from "./stylesheet/stylesheet";

export interface Styles {
  [key: string]: StyleSheet<any>;
}

export class StyleRegister<S extends Styles> {
  private static newExtended<S extends Styles>(
    parent: StyleRegister<S>,
    overrides: Partial<Record<keyof S, StyleSheet<any>>>
  ) {
    const register = new StyleRegister(overrides as S);
    // @ts-expect-error
    register.parent = parent;
    return register;
  }

  private readonly parent?: StyleRegister<S>;
  private readonly _styles: Map<keyof S, S[keyof S]>;

  constructor(styles: S) {
    this._styles = new Map(Object.entries(styles) as [keyof S, S[keyof S]][]);
  }

  get<K extends keyof S>(key: K): S[K] {
    return (this._styles.get(key) ?? this.parent?.get(key)) as any;
  }

  has<K extends keyof S>(key: K): boolean {
    return this._styles.has(key) || !!this.parent?.has(key);
  }

  extend(
    overrides: Partial<Record<keyof S, StyleSheet<any>>>
  ): StyleRegister<S> {
    return StyleRegister.newExtended(this, overrides);
  }
}
