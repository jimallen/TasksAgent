/**
 * Patch console methods to prevent output in TUI mode
 */
export function patchConsole(): { restore: () => void } | void {
  if (!process.env['TUI_MODE']) {
    return;
  }

  const noop = () => {};
  
  // Save original methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  // Replace with noop
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
  
  // Block stderr but leave stdout alone for blessed
  const originalStderrWrite = process.stderr.write;
  
  process.stderr.write = function(_chunk: any, _encoding?: any, callback?: any) {
    // Block all stderr in TUI mode
    if (callback) callback();
    return true;
  };
  
  return {
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;
      process.stderr.write = originalStderrWrite;
    }
  };
}