const actions = Symbol('actions');
const getters = Symbol('getters');
const watchers = Symbol('watchers');
const state = Symbol('state');
const returnable = Symbol('returnable');

const propWatchers = new Map();

function getWriteable(obj, writeCallback) {
  return new Proxy(obj, {
    set(target, key, value) {
      const propWatcher = propWatchers.get(target);
      const watchers = (propWatcher && propWatcher[key] && [...propWatcher[key]]) || [];
      target[key] = value;
      writeCallback(watchers);
    },

    get(target, key) {
      if (key === state) return target;
      return (typeof target[key] === 'object')
        ? getWriteable(target[key], writeCallback)
        : target[key];
    },
  });
}

function getReturnable(obj) {
  return new Proxy({...obj}, {
    get(target, key) {
      const val = target[key];
      if (typeof val === 'object') return getReturnable(val);
      return val;
    },
  });
}

function getReadable(obj, getter) {
  return new Proxy(obj, {
    set() {
      return false;
    },

    get(target, key) {
      if (key === returnable) return () => getReturnable(target);

      if (!propWatchers.has(target)) propWatchers.set(target, {});
      const propWatcher = propWatchers.get(target);
      if (!(key in propWatcher)) propWatcher[key] = new Set();
      propWatcher[key].add(getter);

      if (typeof target[key] === 'object') {
        return getReadable(target[key], getter);
      }
      return target[key];
    },
  });
}

/**
 * Membrain represents the current application state and all actions that can
 * be called on it.
 */
export default class Membrain {
  constructor() {
    this[actions] = {};
    this[getters] = {};
    this[watchers] = {};
    this[state] = {};
  }

  triggerUpdate(path) {
    const readableState = getReadable(this[state], path)
    const value = this[getters][path](readableState);
    this[watchers][path].forEach(cb => cb(value));
  }

  /**
   * addAction adds an action that can be called. Actions mutate the state by
   * loading data and return a promise.
   *
   * @param {string} path A path that will be used to call the action.
   * @param {action} action A function that mutates the state when the action is called.
   */
  addAction(path, action) {
    this[actions][path] = action;
  }

  /**
   * removeAction removes the action registered at the specified path so it can
   * no longer be called.
   *
   * @param {string} path The path to the action to be removed.
   */
  removeAction(path) {
    delete this[actions][path];
  }

  /**
   * addGetter adds a getter at the specified path to retrieve values from the state.
   *
   * @param {string} path The path that the action will be called at.
   * @param {getter} getter A function that retrieves a value from the current state.
   */
  addGetter(path, getter) {
    this[getters][path] = getter;
  }

  /**
   * removeGetter removes the getter mounted at the specified path.
   *
   * @param {string} path The path to the getter that will be removed.
   */
  removeGetter(path) {
    delete this[getters][path];
  }

  get(path) {
    const readableState = getReadable(this[state], path)
    const val = this[getters][path](readableState);
    if (typeof val === 'object' && val[returnable]) return val[returnable]();
    return val;
  }

  /**
   * dispatch triggers actions on the current object and in any remote locations.
   *
   * @param {string} path The path that the action was registered at.
   * @param payload A payload to pass to the action.
   */
  dispatch(path, payload) {
    const action = this[actions][path];
    if (!action) {
      throw new Error('Action does not exist');
    }

    const writeable = getWriteable(this[state], (getters) => {
      getters.forEach(getter => {
        this.triggerUpdate(getter);
      });
    });
    action(writeable, payload);
  }

  /**
   * watch registers a function to be called whenever a property is changed.
   *
   * @param {string} path The path to the getter that retrieves the value.
   * @param {function} callback A function called whenever the property changes.
   *
   * @returns {watcherID} An identifier that can be used to unwatch a property.
   */
  watch(path, callback) {
    if (!(path in this[watchers])) this[watchers][path] = new Set();
    this[watchers][path].add(callback);
  }

  /**
   * unwatch removes the specified update watcher.
   *
   * @param {watcherID} id The watcherID to remove.
   */
  unwatch(id) {

  }
}
