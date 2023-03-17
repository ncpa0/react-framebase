import type { CssStylesheetAST } from "@adobe/css-tools";
import { CssTypes, parse, stringify } from "@adobe/css-tools";

export interface CssMorphers {
  variableDefinition?: (
    name: string,
    value: string
  ) => [name: string, value: string];
  variableAccess?: (name: string) => string;
  selector?: (selector: string) => string;
}

const defaultVarDefinitionMorph: CssMorphers["variableDefinition"] = (
  name: string,
  value: string
) => [name, value];
const defaultVarAccessMorph: CssMorphers["variableAccess"] = (name: string) =>
  name;
const defaultSelectorMorph: CssMorphers["selector"] = (selector: string) =>
  selector;

export const cssMorphAst = (ast: CssStylesheetAST, morphers: CssMorphers) => {
  const {
    variableDefinition = defaultVarDefinitionMorph,
    variableAccess = defaultVarAccessMorph,
    selector = defaultSelectorMorph,
  } = morphers;

  for (let i = 0; i < ast.stylesheet.rules.length; i++) {
    const rule = ast.stylesheet.rules[i]!;
    if (rule.type === CssTypes.rule) {
      rule.selectors = rule.selectors.map(selector);

      for (let j = 0; j < rule.declarations.length; j++) {
        const declaration = rule.declarations[j]!;

        if (declaration.type === CssTypes.declaration) {
          if (declaration.property.startsWith("--")) {
            const [newName, newValue] = variableDefinition(
              declaration.property,
              declaration.value
            );

            declaration.property = newName;
            declaration.value = newValue;
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
              const newName = variableAccess(variable.name);
              resultChars.push(
                declaration.value.slice(prevEnd, variable.start),
                newName
              );

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

  return ast;
};

export const cssMorph = (css: string, morphers: CssMorphers) => {
  const ast = parse(css);

  return stringify(cssMorphAst(ast, morphers));
};
