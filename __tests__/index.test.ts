import { createStyleContext, StyleRegister, stylesheet } from "../src/index";

const ButtonStyle = stylesheet(
  "Button",
  /* css */ `
    :scope {
        --button-color: red;
    }

    button {
        color: var(--button-color);
    }
`
);

const InputStyle = stylesheet(
  "Input",
  /* css */ `
    :scope {
        --border-color: blue;
    }

    input {
        border-color: var(--border-color);
    }
`
);

const register = new StyleRegister({
  Button: ButtonStyle,
  Input: InputStyle,
});

const ctx = createStyleContext(register);

const s = ctx.useStyleSheet("Button");

s.useDynamicSheet({
  "button-color": "green",
});
