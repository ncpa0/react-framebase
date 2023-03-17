export type DiffedProperties = Array<[string, string | undefined]>;

export const diff = (
  oldProps: Record<string, string | undefined>,
  newProps: Record<string, string | undefined>
) => {
  const diffedProperties: DiffedProperties = [];

  const oldPropsKeys = Object.keys(oldProps);
  const newPropsKeys = Object.keys(newProps);

  for (let i = 0; i < newPropsKeys.length; i++) {
    const key = newPropsKeys[i]!;
    if (newProps[key] !== oldProps[key]) {
      diffedProperties.push([key, newProps[key]]);
    }
  }

  for (let i = 0; i < oldPropsKeys.length; i++) {
    const key = oldPropsKeys[i]!;

    if (!newPropsKeys.includes(key)) {
      diffedProperties.push([key, undefined]);
    }
  }

  return diffedProperties;
};
