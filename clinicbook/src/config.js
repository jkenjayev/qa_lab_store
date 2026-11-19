import { defectsFromEnv } from './defects.js';
import { createClock } from './clock.js';
import { ConfigError } from './domain/errors.js';

/** Reads the environment once. The shared training password is mandatory and never has a default. */
export function loadConfig(env) {
  const trainingPassword = env.TRAINING_PASSWORD;
  if (!trainingPassword) {
    throw new ConfigError(
      'TRAINING_PASSWORD oʻrnatilmagan. ClinicBook ishga tushirilishidan oldin tashkilotchi uni (barcha test akkauntlarining umumiy paroli) oʻrnatishi kerak.',
    );
  }
  const real = String(env.FIXED_NOW ?? '').toLowerCase() === 'off';
  return {
    port: Number(env.PORT) || 3202,
    trainingPassword,
    defects: defectsFromEnv(env),
    clock: createClock({ fixedNow: real || !env.FIXED_NOW ? undefined : env.FIXED_NOW, real }),
  };
}
