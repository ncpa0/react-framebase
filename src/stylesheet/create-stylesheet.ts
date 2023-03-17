import type {
  CssCommentAST,
  CssDeclarationAST,
  CssRuleAST,
  CssStylesheetAST,
} from "@adobe/css-tools";
import { CssTypes, parse, stringify } from "@adobe/css-tools";
import { cssMorphAst } from "../utils/css-morph";
import { generateIdFromString } from "../utils/generate-uid";
import type { VarDeclaration } from "./stylesheet";
import { StyleSheet } from "./stylesheet";
import type { StylesheetParams } from "./type-utils";

const createAst = <A extends CssStylesheetAST>(v: A) => v;

export function stylesheet<C extends string>(
  uniqueName: string,
  rules: C
): StyleSheet<StylesheetParams<C>> {
  const uid = "rfb_" + generateIdFromString(uniqueName);
  const knownVars: VarDeclaration[] = [];
  let parsedCss = "";

  const ast = parse(rules);

  const scopeIndex = ast.stylesheet.rules.findIndex(
    (r) =>
      r.type === "rule" &&
      r.selectors.length === 1 &&
      r.selectors.includes(":scope")
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
    const ownClassSelector = "." + uid;

    const selectorMapFn = replaceSelectors
      ? (selector: string) => {
          if (selector.startsWith(":scope")) {
            return selector.replaceAll(":scope", ownClassSelector);
          }

          let separator = " ";
          if (selector.startsWith(":")) {
            separator = "";
          }

          return (
            ownClassSelector +
            separator +
            selector.replaceAll(":scope", ownClassSelector)
          );
        }
      : (s: string) => s;

    cssMorphAst(localAst, {
      selector: selectorMapFn,
      variableDefinition: (name, value) => [
        variableReplaceMap.get(name.slice(2)) ?? name,
        value,
      ],
      variableAccess: (name) => variableReplaceMap.get(name.slice(2)) ?? name,
    });
  };

  replaceVariableNamesInAst(ast, true);

  if (newScopeAst.stylesheet.rules[0]!.declarations.length > 0) {
    replaceVariableNamesInAst(newScopeAst, false);
    parsedCss +=
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      stringify(newScopeAst, { compress: false, indent: "  " }) + "\n";
  }

  parsedCss += stringify(ast, { compress: false, indent: "  " });

  return new StyleSheet<StylesheetParams<C>>(
    uid,
    knownVars.map((kv) => ({
      ...kv,
      property: variableReplaceMap.get(kv.property)!,
    })),
    parsedCss
  );
}
