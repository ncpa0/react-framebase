import type { StyleSheet } from "./stylesheet/stylesheet";

export interface Styles {
  [key: string]: StyleSheet<any>;
}

export class StyleRegister<S extends Styles> {
  private readonly _styles: S;

  constructor(styles: S) {
    this._styles = styles;
  }

  get<K extends keyof S>(key: K): S[K] {
    return this._styles[key];
  }

  has<K extends keyof S>(key: K): boolean {
    return key in this._styles;
  }
}
