const formatTimestamp = (): string => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')}.${now.getSeconds().toString().padStart(2, '0')}`;
};

const LOG_PREFIX = '\x1b[92m[mivubi]\x1b[0m';

export const logger = {
  log: (...args: any[]) => console.log(`\x1b[30m${formatTimestamp()}\x1b[0m ${LOG_PREFIX}`, ...args),
  error: (...args: any[]) => console.error(`\x1b[30m${formatTimestamp()}\x1b[0m ${LOG_PREFIX}`, ...args)
};