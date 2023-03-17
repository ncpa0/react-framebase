import React from "react";
import type { StyleRegister, Styles } from "./style-register";
import type { StyleSheet } from "./stylesheet/stylesheet";
import type { ExtractStyleSheetParams } from "./stylesheet/type-utils";

export const createStyles = <S extends Styles>(register: StyleRegister<S>) => {
  const ctx = React.createContext({
    register,
    getComponentStyle<K extends keyof S>(key: K): S[K] {
      return register.get(key);
    },
  });

  return {
    register,
    context: ctx,
    StyleConsumer: ctx.Consumer,
    StyleProvider(
      props: React.PropsWithChildren<{
        styleOverrides: Partial<Record<keyof S, StyleSheet<any>>>;
      }>
    ) {
      const currentContext = React.useContext(ctx);
      const subRegister = React.useMemo(
        () => currentContext.register.extend(props.styleOverrides),
        [props.styleOverrides]
      );

      return (
        <ctx.Provider
          value={{
            register: subRegister,
            getComponentStyle<K extends keyof S>(key: K): S[K] {
              return subRegister.get(key);
            },
          }}
        >
          {props.children}
        </ctx.Provider>
      );
    },
    /**
     * Returns a class name that can be used to apply the
     * stylesheet to a specific element.
     */
    useStyleSheet<K extends keyof S>(key: K): string {
      const ctxValue = React.useContext(ctx);
      const style = React.useMemo(
        () => ctxValue.getComponentStyle(key),
        [key, ctxValue.register]
      );
      style.mount();
      return style.className;
    },
    /**
     * Allows to change the CSS variables of the specified
     * stylesheet for a specific instance of a HTML Element on
     * the go.
     *
     * As a second parameter provide a dictionary of key-value
     * pairs, where each key is the name of a CSS variable and
     * each value is the CSS property it should be assigned.
     *
     * The returned value is a class name that can be used to
     * apply the dynamically generate CSS Rules to a specific
     * element.
     *
     * @example
     *   const className = styles.useDynamicSheet("Button", {
     *     "my-border-color": "red",
     *   });
     *
     *   return <div className={className}>Hello World</div>;
     */
    useDynamicStyleSheet<K extends keyof S>(
      key: K,
      params: Partial<ExtractStyleSheetParams<S[K]>>
    ): string {
      const ctxValue = React.useContext(ctx);
      const style = React.useMemo(
        () => ctxValue.getComponentStyle(key),
        [key, ctxValue.register]
      );
      style.mount();
      return style.useDynamicSheet(params);
    },
  };
};

export type OverridesForStyle<SC extends { register: StyleRegister<any> }> =
  SC extends { register: StyleRegister<infer S> }
    ? Partial<Record<keyof S, StyleSheet<any>>>
    : never;
