export class CachedVar {
  public readonly defaultValue: string;

  constructor(private readonly name: string, private value: string) {
    this.defaultValue = value;
    this.setValue(value);
  }

  /**
   * Return a CSS variable declaration.
   *
   * @example
   *   const cv = new CachedVar("--my-var", "red");
   *
   *   const declaration = cv.getVarDeclaration(); // -> "  --my-var: red;"
   */
  getVarDeclaration = (): string => "";

  setValue(v: string) {
    this.value = v;
    this.getVarDeclaration = (): string => {
      const cached = `  ${this.name}: ${this.value};`;
      this.getVarDeclaration = () => cached;
      return this.getVarDeclaration();
    };
  }
}
