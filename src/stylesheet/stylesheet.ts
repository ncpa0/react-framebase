import type {
  CssCommentAST,
  CssDeclarationAST,
  CssRuleAST,
  CssStylesheetAST,
} from "@adobe/css-tools";
import { CssTypes, parse, stringify } from "@adobe/css-tools";
import React from "react";
import { generateIdFromString, generateUID } from "../utils/generate-uid";
import { microThrottle } from "../utils/microthrottle";
import { CachedVar } from "./cached-var";
import type { StylesheetParams } from "./type-utils";

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
    const knownVars = stylesheet._knownVars.map((kv) => ({ ...kv }));

    for (const [k, v] of Object.entries(newVarDefaults)) {
      const actualK = StyleSheet.getScopedNameFor(k, stylesheet._uid);
      const existing = knownVars.find((kv) => kv.property === actualK);
      if (existing) {
        existing.value = v;
      }
    }

    const newUid = stylesheet._uid + "-" + generateIdFromString(uniqueName);

    return new StyleSheet(
      newUid,
      knownVars,
      stylesheet._css.replaceAll(`.${stylesheet._uid} `, `.${newUid} `) // TODO: properly replace the class name selector
    );
  }

  private isMounted = false;
  private mainStyleElement: HTMLStyleElement | null = null;

  private constructor(
    private readonly _uid: string,
    private readonly _knownVars: VarDeclaration[],
    private readonly _css: string
  ) {
    Object.freeze(_knownVars);
  }

  private getDefaultVars() {
    const lines = this._knownVars.map((kv) => `  ${kv.property}: ${kv.value};`);
    return `.${this._uid} {\n${lines.join("\n")}\n}`;
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
  mount() {
    if (!this.isMounted && document) {
      const head = document.head;
      this.mainStyleElement = document.createElement("style");
      this.mainStyleElement.innerHTML =
        this.getDefaultVars() + "\n\n" + this._css;
      head.appendChild(this.mainStyleElement);
      this.isMounted = true;
    }
  }

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
    const [vars] = React.useState(this.generateCachedVars);
    const [updateElem] = React.useState(() =>
      microThrottle(this.updateDynamicStyleElement)
    );
    const styleElemRef = React.useRef<HTMLStyleElement | null>(null);

    React.useEffect(() => {
      this.mount();
      if (document) {
        const styleElem = (styleElemRef.current =
          document.createElement("style"));

        document.head.appendChild(styleElem);

        return () => {
          document.head.removeChild(styleElem);
        };
      }
    }, []);

    // `_knownVars` is a immutable array so this loop
    // will always run the same number of times.
    // This way it is safe to use `useEffect` in here
    for (const kv of this._knownVars) {
      const k = kv.property;
      const baseName = StyleSheet.getBaseName(k);
      React.useEffect(() => {
        const cachedVar = vars.get(k);
        if (cachedVar) {
          cachedVar.setValue(params[baseName] ?? kv.value);
          updateElem(uid, styleElemRef.current, vars);
        }
      }, [params[baseName]]);
    }

    return this._uid + " " + uid;
  }
}

const createAst = <A extends CssStylesheetAST>(v: A) => v;

export function stylesheet<C extends string>(
  uniqueName: string,
  rules: C
): StyleSheet<StylesheetParams<C>> {
  const uid = generateIdFromString(uniqueName);
  const knownVars: VarDeclaration[] = [];
  let parsedCss = "";

  const ast = parse(rules);

  const scopeIndex = ast.stylesheet.rules.findIndex(
    (r) => r.type === "rule" && r.selectors.includes(":scope")
  );

  const newScopeAst = createAst({
    type: CssTypes.stylesheet,
    stylesheet: {
      rules: [
        {
          type: CssTypes.rule,
          selectors: ["." + uid],
          declarations: [] as (CssDeclarationAST | CssCommentAST)[],
        },
      ],
    },
  });

  if (scopeIndex !== -1) {
    const org = ast.stylesheet.rules[scopeIndex] as CssRuleAST;

    for (const declaration of org.declarations) {
      if (declaration.type === CssTypes.declaration) {
        if (declaration.property.startsWith("--")) {
          knownVars.push({
            type: "declaration",
            property: declaration.property.slice(2),
            value: declaration.value,
          });
        } else {
          newScopeAst.stylesheet.rules[0]!.declarations.push(declaration);
        }
      } else {
        newScopeAst.stylesheet.rules[0]!.declarations.push(declaration);
      }
    }

    ast.stylesheet.rules.splice(scopeIndex, 1);
  }

  const variableReplaceMap = new Map<string, string>();

  for (const variable of knownVars) {
    variableReplaceMap.set(
      variable.property,
      StyleSheet.getScopedNameFor(variable.property, uid)
    );
  }

  // replace all variable names with scoped names
  const replaceVariableNamesInAst = (
    localAst: CssStylesheetAST,
    replaceSelectors: boolean
  ) => {
    const selectorMapFn = replaceSelectors
      ? (s: string) => "." + uid + " " + s
      : (s: string) => s;

    for (const rule of localAst.stylesheet.rules) {
      if (rule.type === CssTypes.rule) {
        rule.selectors = rule.selectors.map(selectorMapFn);

        for (const declaration of rule.declarations) {
          if (declaration.type === CssTypes.declaration) {
            if (declaration.property.slice(0, 2) == "--") {
              const scopedName = variableReplaceMap.get(
                declaration.property.slice(2)
              );
              if (scopedName) {
                declaration.property = scopedName;
              }
            } else if (declaration.value.includes("var(")) {
              type FoundVar = {
                name: string;
                start: number;
                end: number;
              };

              const foundVars: Array<FoundVar> = [];
              let nextIndex = 0;

              while (
                (nextIndex = declaration.value.indexOf("var(--", nextIndex)) !==
                -1
              ) {
                const variable: FoundVar = {
                  name: "--",
                  start: nextIndex + 4,
                  end: nextIndex + 4,
                };

                let j = nextIndex + 6;

                for (
                  ;
                  declaration.value[j] !== " " &&
                  declaration.value[j] !== "," &&
                  declaration.value[j] !== ")";
                  j++
                ) {
                  variable.name += declaration.value[j];
                }

                variable.end = variable.start + variable.name.length;
                foundVars.push(variable);

                nextIndex += 6;
              }

              const resultChars: string[] = [];
              let prevEnd = 0;
              for (const variable of foundVars) {
                const scopedName = variableReplaceMap.get(
                  variable.name.slice(2)
                );
                if (scopedName) {
                  resultChars.push(
                    declaration.value.slice(prevEnd, variable.start),
                    scopedName
                  );
                } else {
                  resultChars.push(
                    declaration.value.slice(prevEnd, variable.start),
                    variable.name
                  );
                }
                prevEnd = variable.end;
              }
              resultChars.push(declaration.value.slice(prevEnd));

              let value = "";
              let first = true;

              for (let i = 0; i < resultChars.length; i++) {
                if (first) {
                  first = false;
                  value = resultChars[i]!;
                } else {
                  value += resultChars[i]!;
                }
              }

              declaration.value = value;
            }
          }
        }
      }
    }
  };

  replaceVariableNamesInAst(ast, true);

  if (newScopeAst.stylesheet.rules[0]!.declarations.length > 0) {
    replaceVariableNamesInAst(newScopeAst, false);
    parsedCss +=
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      stringify(newScopeAst, { compress: false, indent: "  " }) + "\n";
  }

  parsedCss += stringify(ast, { compress: false, indent: "  " });

  // @ts-expect-error
  return new StyleSheet<StylesheetParams<C>>(
    uid,
    knownVars.map((kv) => ({
      ...kv,
      property: variableReplaceMap.get(kv.property),
    })),
    parsedCss
  );
}
