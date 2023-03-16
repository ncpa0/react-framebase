function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const getRandomDigit = () => {
  return String.fromCharCode(getRandomInt(48, 57));
};

const getRandomAlphaCharacter = () => {
  const isUpperCase = Math.random() > 0.5;
  const char = String.fromCharCode(getRandomInt(65, 90));
  return isUpperCase ? char : char.toLowerCase();
};

const getRandomCharacter = () => {
  const isNumChar = Math.random() > 0.5;

  if (isNumChar) {
    return getRandomDigit();
  } else {
    return getRandomAlphaCharacter();
  }
};

/**
 * Generates a random string of of given length, each character
 * is either a digit or an alpha character.
 *
 * @param length The length of the string to generate (minimum 2)
 * @returns A random string of given length
 */
export const generateUID = (length: number) => {
  length -= 1;
  return (
    getRandomAlphaCharacter() +
    Array.from({ length }, () => getRandomCharacter()).join("")
  );
};

export const generateIdFromString = (str: string) => {
  const t = btoa(str);
  return t.replace(/[^a-zA-Z0-9]/g, "");
};
