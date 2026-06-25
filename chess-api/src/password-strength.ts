import corePkg from '@zxcvbn-ts/core';
import commonPkg from '@zxcvbn-ts/language-common';

const { ZxcvbnFactory, Options } = corePkg;

let instance: ReturnType<typeof createChecker> | null = null; // Lazy singleton avoids zxcvbn init cost

function createChecker() {
  const options = new Options({
    dictionary: commonPkg.dictionary,
    graphs: commonPkg.adjacencyGraphs,
  });
  const zxcvbn = new ZxcvbnFactory(options);
  return { check: (password: string) => zxcvbn.check(password) };
}

export function getStrength(password: string): { score: number } {
  if (!instance) instance = createChecker();
  return instance.check(password);
}

export function isWeakPassword(password: string, minScore = 2): boolean {
  // Default minScore=2: "feedback" level
  return getStrength(password).score < minScore;
}
