const weak = new WeakMap();

async function loadCallerName(sysId) {
  const rec = new GlideRecord("sys_user");
  const found = rec.get(sysId);
  return found ? rec.getDisplayValue("name") ?? "unknown" : "missing";
}

class Clock {
  static #offset = 0;
  static now() {
    return new GlideDateTime();
  }
}

const ready = Promise.resolve(Clock.now());
ready.then(function () {
  weak.set(Clock, true);
});

loadCallerName(gs.getUserID());
