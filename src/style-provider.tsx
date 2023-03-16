import React from "react";
import type { Styles } from "./style-register";
import { StyleRegister } from "./style-register";

export const createStyleContext = <S extends Styles>(
  register: StyleRegister<S>
) => {
  const ctx = React.createContext({
    getComponentStyle<K extends keyof S>(key: K): S[K] {
      return register.get(key);
    },
  });

  return {
    StyleConsumer: ctx.Consumer,
    StyleProvider(
      props: React.PropsWithChildren<{ styleOverrides: Partial<S> }>
    ) {
      const currentContext = React.useContext(ctx);
      const subRegister = new StyleRegister(props.styleOverrides as S);

      return (
        <ctx.Provider
          value={{
            getComponentStyle<K extends keyof S>(key: K): S[K] {
              if (subRegister.has(key)) {
                return subRegister.get(key);
              }
              return currentContext.getComponentStyle(key);
            },
          }}
        >
          {props.children}
        </ctx.Provider>
      );
    },
    useStyleSheet<K extends keyof S>(key: K): S[K] {
      const ctxValue = React.useContext(ctx);
      const style = ctxValue.getComponentStyle(key);
      style.mount();
      return style;
    },
  };
};
