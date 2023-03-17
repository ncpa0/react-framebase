import { createStyles, StyleRegister, stylesheet } from "../src/index";

const ButtonStyle = stylesheet(
  "Button",
  /* css */ `
    :scope {
        --button-color: red;
    }

    :scope:is(button) {
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

const ctx = createStyles(register);

const s = ctx.useDynamicStyleSheet("Input", { "border-color": "red" });
