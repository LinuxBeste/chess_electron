import corePkg from '@zxcvbn-ts/core';
import commonPkg from '@zxcvbn-ts/language-common';

const { ZxcvbnFactory, Options } = corePkg;

let instance: ReturnType<typeof createChecker> | null = null;

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
  return getStrength(password).score < minScore;
}
