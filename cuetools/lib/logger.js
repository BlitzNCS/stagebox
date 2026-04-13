const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const level = LOG_LEVELS[process.env.CUETOOLS_LOG_LEVEL] ?? LOG_LEVELS.info;

function fmt(lvl, mod, msg) {
  return `${new Date().toISOString()} [${lvl.toUpperCase()}] [${mod}] ${msg}`;
}

function createLogger(mod) {
  return {
    error: (...args) => { if (level >= LOG_LEVELS.error) console.error(fmt('error', mod, args.join(' '))); },
    warn:  (...args) => { if (level >= LOG_LEVELS.warn)  console.warn(fmt('warn', mod, args.join(' '))); },
    info:  (...args) => { if (level >= LOG_LEVELS.info)  console.log(fmt('info', mod, args.join(' '))); },
    debug: (...args) => { if (level >= LOG_LEVELS.debug) console.log(fmt('debug', mod, args.join(' '))); }
  };
}

module.exports = createLogger;
