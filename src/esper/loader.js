import { EventEmitter } from 'node:events'
import { Worker as WorkerResource } from '../res.js'
import { warn } from '../common/log.js'
import { Texture, ImageSource } from 'pixi.js'


export class Loader extends EventEmitter {
  #pending = new Map()
  #worker

  constructor() {
    super()
    this.#worker = new Worker(WorkerResource.expand('loader'))
    this.#worker.onmessage = this.handleWorkerMessage
  }

  handleWorkerMessage = ({ data }) => {
    switch (data?.type) {
      case 'error':
        this.#pending.get(data.meta.url).reject(data.payload)
        break
      case 'load':
        this.#pending.get(data.meta.url).resolve(data.payload)
        break
      default:
        warn(`unknown worker message: ${data}`)
    }
  }

  destroy() {
    this.#worker.terminate()
    this.#worker = null

    for (let [, deferred] of this.#pending) {
      deferred.reject(new Error('worker terminated'))
    }
  }

  load(url) {
    if (this.#pending.has(url)) {
      return this.#pending.get(url).promise
    }

    let deferred = {}
    this.#pending.set(url, deferred)

    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve
      deferred.reject = reject

      this.#worker.postMessage({
        type: 'load',
        payload: url
      })
    }).finally(() => {
      this.#pending.delete(url)
    })

    return deferred.promise
  }

  async loadTexture(url) {
    let bitmap = await this.load(url)
    let source = new ImageSource({
      label: url,
      resource: bitmap
    })

    return new Texture({ source })
  }
}
