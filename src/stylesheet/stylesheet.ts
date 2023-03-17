import React from "react";
import { cssMorph } from "../utils/css-morph";
import { diff } from "../utils/diff";
import { generateIdFromString, generateUID } from "../utils/generate-uid";
import { microThrottle } from "../utils/microthrottle";
import { CachedVar } from "./cached-var";

export type StyleSheetParams = Record<string, string>;

export type VarDeclaration = {
  type: "declaration";
  property: string;
  value: string;
};

export class StyleSheet<P extends StyleSheetParams> {
  static getScopedNameFor(originalName: string, parentID: string) {
    return "--" + parentID + "-" + originalName;
  }

  static getBaseName(scopedName: string) {
    const t = scopedName.slice(2);
    return t.slice(t.indexOf("-") + 1);
  }

  static copyWithNewDefaults<P extends StyleSheetParams>(
    uniqueName: string,
    stylesheet: StyleSheet<P>,
    newVarDefaults: Partial<P>
  ): StyleSheet<P> {
    const newUid = stylesheet._uid + "_" + generateIdFromString(uniqueName);

    const knownVars = stylesheet._knownVars.map((kv) => ({ ...kv }));

    for (const k of knownVars) {
      k.property = k.property.replaceAll(stylesheet._uid, newUid);
      const baseName = StyleSheet.getBaseName(k.property);

      if (newVarDefaults[baseName as keyof P]!) {
        k.value = newVarDefaults[baseName as keyof P]!;
      }
    }

    const newCss = cssMorph(stylesheet._css, {
      selector: (selector) => selector.replaceAll(stylesheet._uid, newUid),
      variableAccess: (name) => name.replaceAll(stylesheet._uid, newUid),
      variableDefinition: (name, value) => [
        name.replaceAll(stylesheet._uid, newUid),
        value,
      ],
    });

    return new StyleSheet(newUid, knownVars, newCss);
  }

  private mainStyleElement: HTMLStyleElement | null = null;

  constructor(
    private readonly _uid: string,
    private readonly _knownVars: ReadonlyArray<VarDeclaration>,
    private readonly _css: string
  ) {
    Object.freeze(_knownVars);
  }

  private getDefaultVars() {
    const lines = this._knownVars.map((kv) => `  ${kv.property}: ${kv.value};`);
    return `:root {\n${lines.join("\n")}\n}`;
  }

  private generateCachedVars = () => {
    return new Map(
      this._knownVars.map((kv) => [
        kv.property,
        new CachedVar(kv.property, kv.value),
      ])
    );
  };

  private updateDynamicStyleElement = (
    uid: string,
    styleElem: HTMLStyleElement | null,
    vars: Map<string, CachedVar>
  ) => {
    if (styleElem) {
      const declarations = [...vars.values()].map((v) => v.getVarDeclaration());
      styleElem.innerHTML = `.${uid} {\n${declarations.join("\n")}\n}`;
    }
  };

  /** @internal */
  mount = () => {
    if (document) {
      const head = document.head;
      this.mainStyleElement = document.createElement("style");
      this.mainStyleElement.innerHTML =
        this.getDefaultVars() + "\n\n" + this._css;
      head.appendChild(this.mainStyleElement);
      this.mount = () => {};
    }
  };

  /**
   * A class name that can be used to apply the CSS Rules of this
   * stylesheet to a specific element.
   */
  get className() {
    return this._uid;
  }

  /**
   * Allows to change the CSS variables of this stylesheet for a
   * specific instance of a HTML Element on the go.
   *
   * As a parameter provide a dictionary of key-value pairs,
   * where each key is the name of a CSS variable and each value
   * is the CSS property it should be assigned.
   *
   * The returned value is a class name that can be used to apply
   * the dynamically generate CSS Rules to a specific element.
   *
   * @example
   *   const className = boxStyles.useDynamicSheet({
   *     "my-border-color": "red",
   *   });
   *
   *   return <div className={className}>Hello World</div>;
   */
  useDynamicSheet(params: Partial<P>) {
    const [uid] = React.useState(() => generateUID(8));
    const vars = React.useMemo(this.generateCachedVars, [this]);
    const [updateElem] = React.useState(() =>
      microThrottle(this.updateDynamicStyleElement)
    );
    const previousParams = React.useRef<Partial<P>>({});
    const styleElemRef = React.useRef<HTMLStyleElement | null>(null);

    React.useEffect(() => {
      this.mount();
      if (document) {
        previousParams.current = {};
        const styleElem = (styleElemRef.current =
          document.createElement("style"));

        document.head.appendChild(styleElem);

        return () => {
          document.head.removeChild(styleElem);
        };
      }
    }, [this]);

    React.useEffect(() => {
      const changedProps = diff(previousParams.current, params);
      previousParams.current = params;

      if (changedProps.length > 0) {
        for (let i = 0; i < changedProps.length; i++) {
          const [key, value] = changedProps[i]!;

          const scopedName = StyleSheet.getScopedNameFor(key, this._uid);

          const cachedVar = vars.get(scopedName);
          if (cachedVar) {
            cachedVar.setValue(value ?? cachedVar.defaultValue);
          }
        }

        updateElem(uid, styleElemRef.current, vars);
      }
    }, [params, this]);

    const className = React.useMemo(() => this._uid + " " + uid, [this]);

    return className;
  }

  copyWithNewDefaults(uniqueName: string, newVarDefaults: Partial<P>) {
    return StyleSheet.copyWithNewDefaults(uniqueName, this, newVarDefaults);
  }
}
