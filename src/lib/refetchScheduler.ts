// Regroupe (debounce) les rechargements de données : les événements temps réel
// arrivent souvent en rafale (une écriture = plusieurs notifications), ce qui
// provoquait autant de requêtes complètes et rendait l'interface saccadée.
export function makeScheduler(fn: () => Promise<void> | void, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pending = false;

  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await fn();
    } finally {
      running = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  }

  return schedule;
}
