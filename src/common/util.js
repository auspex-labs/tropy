import { nanoid } from 'nanoid'

export function on(emitter, ...args) {
  (emitter.addEventListener || emitter.addListener).apply(emitter, args)
}

export function off(emitter, ...args) {
  (emitter.removeEventListener || emitter.removeListener).apply(emitter, args)
}

export function once(emitter, ...events) {
  return Promise.all(events.map(event =>
    new Promise((resolve, reject) => {
      function success(...args) {
        off(emitter, event, success)
        off(emitter, 'error', failure)
        resolve(...args)
      }

      function failure(reason) {
        off(emitter, event, success)
        off(emitter, 'error', failure)
        reject(reason instanceof Error ? reason : new Error(reason))
      }

      on(emitter, 'error', failure)
      on(emitter, event, success)
    })
  ))
}

export function when(emitter, event, timeout) {
  return Promise.race([once(emitter, event), delay(timeout)])
}

export function empty(obj) {
  return obj == null || Object.keys(obj).length === 0
}

export function times(n, fn = identity) {
  for (var i = 0, res = []; i < n; ++i)
    res.push(fn(i))

  return res
}

export function *iteratorWithIndex(input) {
  let index = 0
  for (let item of input[Symbol.iterator]())
    yield [item, index++]
}

export async function pMap(
  input,
  mapper,
  { concurrency = Infinity } = {},
  ...args
) {
  let result = []

  if (!input.length)
    return result

  let it = iteratorWithIndex(input)
  concurrency = Math.min(Math.max(0, concurrency), input.length)

  let errors = []
  let workers = []

  times(concurrency, () => {
    workers.push(pMap.worker(it, mapper, result, errors, ...args))
  })

  await Promise.allSettled(workers)

  if (errors.length >= 1)
    throw new AggregateError(errors)

  return result
}

pMap.worker = async function (it, mapper, result, errors, ...args) {
  for (let [item, index] of it) {
    try {
      item = await Promise.resolve(item)
      result[index] = await mapper(item, index, ...args)

    } catch (e) {
      errors.push(e)
    }
  }
}

function toArray(obj) {
  return obj == null ? [] : Array.isArray(obj) ? [...obj] : [obj]
}

export { toArray as array }

export function splice(array, at, count = 0, ...items) {
  if (at == null) at = array.length

  return [
    ...array.slice(0, at),
    ...items,
    ...array.slice(at + count)
  ]
}

export function insert(array, at, ...items) {
  return splice(array, at, 0, ...items)
}

export function remove(array, ...items) {
  return array.filter(it => items.indexOf(it) < 0)
}

export function sample(array) {
  return array[Math.floor(Math.random() * array.length)]
}

export function sort(array, ...args) {
  return [...array].sort(...args)
}

export function uniq(array, into = [], memo = new Set()) {
  for (let item of array) {
    if (!memo.has(item)) {
      memo.add(item)
      into.push(item)
    }
  }

  return into
}

export function homogenize(fn, memo = new Set()) {
  let test = x => memo.has(x) ? false : !!memo.add(x)
  return fn(test, memo)
}

export function compact(array) {
  return array.filter(exist)
}

export function exist(obj) {
  return obj != null
}

export function mixed(array) {
  for (let i = 1; i < array.length; ++i) {
    if (array[i] !== array[i - 1]) return true
  }

  return false
}

export function reverse(array) {
  const rev = []

  for (let i = array.length - 1; i >= 0; --i) {
    rev.push(array[i])
  }

  return rev
}

export function remap(array, fn) {
  const res = new Array(array.length)

  for (let i = array.length - 1; i >= 0; --i) {
    res[i] = fn(array[i], i)
  }

  return res
}

export function move(array, a, b, offset = 0) {
  if (a === b) return array

  const res = []

  for (let i = 0, adj = 0; i < array.length; ++i) {
    let cur = array[i]

    if (cur === a) {
      --adj
      continue
    }

    if (cur === b) {
      res[i + adj + offset] = a
      ++adj
      res[i + adj - offset] = b
      continue
    }

    res[i + adj] = cur
  }

  return res
}

export function warp(array, idx, at) {
  at = restrict(at, 0, array.length - 1)
  if (idx === at || idx == null) return array
  return insert(splice(array, idx, 1), at, array[idx])
}

export function swap(array, from, to) {
  to = restrict(to, 0, array.length - 1)

  if (from === to || from == null) return array
  if (from > to) return swap(array, to, from)

  let head = array.slice(0, from)
  let between = array.slice(from + 1, to)
  let tail = array.slice(to + 1)

  return [
    ...head, array[to], ...between, array[from], ...tail
  ]
}

export function adjacent(array, item) {
  const i = array.indexOf(item)
  const n = array.length - 1

  switch (i) {
    case -1: return []
    case 0: return n ? [undefined, array[1]] : []
    case n: return [array[n - 1]]
    default:
      return [array[i - 1], array[i + 1]]
  }
}

export function flatten(obj) {
  const res = {}

  function reduce(cur, prop = '') {
    if (Object(cur) !== cur) res[prop] = cur
    else for (let p in cur) reduce(cur[p], prop ? `${prop}.${p}` : p)

    return res
  }

  return reduce(obj)
}

export function get(src, path, value) {
  if (src == null) return value
  if (!path || !path.length) return src

  let parts = Array.isArray(path) ? path : path.split('.')
  let obj = src
  let i, ii

  for (i = 0, ii = parts.length; i < ii; ++i) {
    if (!Object.prototype.propertyIsEnumerable.call(obj, parts[i])) {
      return value
    }

    obj = obj[parts[i]]

    if (obj == null) {
      return (i !== ii - 1) ? value : obj
    }
  }

  return obj
}

export function set(src, path, value) {
  if (typeof path === 'string') {
    return set(src, path.split('.'), value)
  }

  if (path.length === 0) return src
  if (path.length === 1) {
    return Object.assign({}, src, { [path[0]]: value })
  }

  return Object.assign({}, src, {
    [path[0]]: set(src[path[0]] || {}, path.slice(1), value)
  })
}

export function has(src, path) {
  if (src == null) return false
  if (!path || !path.length) return true

  let parts = Array.isArray(path) ? path : path.split('.')
  let obj = src
  let i, ii

  for (i = 0, ii = parts.length; i < ii; ++i) {
    if (!(parts[i] in obj)) return false
    obj = obj[parts[i]]
  }

  return true
}

export function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function pluck(src, props = [], into = [], expand = false) {
  return props.reduce((res, key) => {
    const value = src[key]

    if (expand || typeof value !== 'undefined' || own(src, key)) {
      res.push(src[key])
    }

    return res

  }, into)
}

export function any(src, ...props) {
  for (let prop of props) {
    if (own(src, prop)) return src[prop]
    if (typeof src[prop] !== 'undefined') return src[prop]
  }
}

export function pick(src, props = [], into = {}, expand = false) {
  return (src == null) ?
    into :
    props.reduce((res, key) => {
      const value = src[key]

      if (expand || typeof value !== 'undefined' || own(src, key)) {
        res[key] = value
      }

      return res

    }, into)
}

export function omit(src, props = [], into = {}) {
  return pick(src,
    // eslint-disable-next-line eqeqeq
    Object.keys(src).filter(key => !props.find(prop => prop == key)), into)
}

export function merge(a, b, into = {}) {
  if (a !== into) Object.assign(into, a)

  for (let prop in b) {
    if (own(b, prop)) {
      let value = b[prop]
      let type = typeof value

      switch (true) {
        case type === 'boolean':
        case type === 'number':
        case type === 'string':
        case type === 'undefined':
        case value == null:
          into[prop] = value
          break
        case Array.isArray(value):
          into[prop] = [...value]
          break
        case value instanceof Date:
          into[prop] = new Date(value)
          break
        default:
          into[prop] = merge(into[prop], value)
          break
      }
    }
  }

  return into
}

export function copy(obj, into = {}) {
  return merge(into, obj, into)
}

export function map(src, fn, into = {}) {
  // if (typeof fn !== 'function') fn = () => fn

  for (let prop in src) {
    if (own(src, prop)) {
      into[prop] = fn(prop, src[prop], src)
    }
  }

  return into
}

export function morph(src, fn, into = {}) {
  for (let prop in src) {
    if (own(src, prop)) {
      into = fn(into, prop, src[prop], src) || into
    }
  }

  return into
}

export function noop() {}

export function identity(it) {
  return it
}

export function tautology() {
  return true
}

export function delay(ms, ...args) {
  return new Promise(resolve => setTimeout(resolve, ms, ...args))
}

export function *counter(k = 0) {
  while (true) {
    k = Number.isSafeInteger(k) ? ++k : -k
    yield k
  }
}

export function titlecase(string) {
  return string
    .replace(/\b\p{Ll}/ug, (m) => m.toUpperCase())
    .replace(/(\p{Ll})(\p{Lu})/ug, (m, p1, p2) => `${p1} ${p2}`)
}

export function capitalize(string) {
  return string.replace(/^\p{Ll}/u, (m) => m.toUpperCase())
}

export function downcase(string) {
  return string.toLowerCase().replace(/\s+/g, '-')
}

export function camelcase(str) {
  return str.replace(
    /(?:^\w|\p{Lu}|\b\w|\s+)/ug,
    (match, index) => {
      if (+match === 0) return ''
      return index === 0 ? match.toLowerCase() : match.toUpperCase()
    })
}

export function lispcase(str) {
  return str.split(/(\p{Lu}\p{Lu}+)|(\p{Lu}\p{Ll}+)|[\s-]+/u)
    .filter(s => !!s)
    .map(s => s.toLowerCase())
    .join('-')
}

export function quote(string) {
  return `"${string.replace(/\\"/, 'g')}"`
}

export function list(params, fn = Number, comma = ',') {
  return params.map(fn).join(comma)
}

export function diff(a, b) {
  const delta = []

  for (let prop in b) {
    if (a[prop] !== b[prop]) delta.push(prop)
  }

  for (let prop in a) {
    if (!(prop in b)) delta.push(prop)
  }

  return delta
}

export function strftime(format, date = new Date()) {
  return format.replace(/%([YymdHMS])/g, (match, code) => {
    switch (code) {
      case 'Y':
        return String(date.getFullYear()).padStart(4, '0')
      case 'y':
        return String(date.getFullYear() % 100).padStart(2, '0')
      case 'm':
        return String(date.getMonth() + 1).padStart(2, '0')
      case 'd':
        return String(date.getDate()).padStart(2, '0')
      case 'H':
        return String(date.getHours()).padStart(2, '0')
      case 'M':
        return String(date.getMinutes()).padStart(2, '0')
      case 'S':
        return String(date.getSeconds()).padStart(2, '0')
      default:
        return match
    }
  })
}

export function refine(context, method, refinement) {
  const original = context[method]

  context[method] = (...args) =>
    refinement.call(context, args, original.apply(context, args))
}

export function restrict(value, lower, upper) {
  value = Math.max(value, (lower != null) ? lower : value)
  value = Math.min(value, (upper != null) ? upper : value)
  return value
}

export function stringify(obj) {
  return obj == null ? null : JSON.stringify(obj)
}

export function json(string) {
  return (string == null || string === '') ? null : JSON.parse(string)
}

export function toId(obj) {
  return obj.id
}

export function blank(string) {
  return string == null || string.length === 0
}

export function identify(length = 8) {
  return nanoid(length)
}

export function shallow(a, b, props) {
  if (a === b) return true

  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b)
    return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length)
      return false

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false
    }

  } else {
    if (Array.isArray(b)) return false
    if (blank(props)) props = Object.keys(a)

    for (let prop of props) {
      if (a[prop] !== b[prop]) return false
    }
  }

  return true
}

export const BIDI_RTL = /[\p{sc=Hebrew}\p{sc=Arabic}]/u

export function containsRTL(string) {
  return BIDI_RTL.test(string)
}

export const URI = {
  namespace(uri) {
    return URI.split(uri)[0]
  },

  getLabel(uri) {
    return titlecase(URI.split(uri)[1]) || uri
  },

  split(uri) {
    let ns = uri.split(/(#|\/)/)
    let nm = ns.pop()
    return [ns.join(''), nm]
  },

  encode(url) {
    return url.replace(/[#?&]/g, (m) => {
      switch (m) {
        case '#': return '%23'
        case '?': return '%3F'
        case '&': return '%26'
      }
    })
  }
}


export const flipMap = (a, b) =>
  a.entries().reduce((m, [k, v]) =>
    v ? m.set(k, !m.get(k)) : m, new Map(b))

export const mergeMap = (a, b) =>
  a.entries().reduce((m, [k, v]) =>
    v ? m.set(k, true) : m, new Map(b))

export const BLANK = Object.freeze(Object.create(null))
