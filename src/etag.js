// copied from https://github.com/fastify/fastify-etag
// and added prefix support
'use strict'

const { createHash } = require('crypto')
const fnv1a = require('./fnv1a')

function validateAlgorithm(algorithm) {
  if (algorithm === 'fnv1a') {
    return true
  }

  // validate that the algorithm is supported by the node runtime
  try {
    createHash(algorithm)
  } catch (e) {
    throw new TypeError(`Algorithm ${algorithm} not supported.`)
  }
}

function buildHashFn(algorithm = 'fnv1a', weak = false) {
  validateAlgorithm(algorithm)

  const prefix = weak ? 'W/"' : '"'
  if (algorithm === 'fnv1a') {
    return (payload) => prefix + fnv1a(payload).toString(36) + '"'
  }

  return (payload) =>
    prefix +
    createHash(algorithm).update(payload).digest().toString('base64') +
    '"'
}

async function fastifyEtag(app, opts = {}) {
  // console.log('etags options', opts)
  const prefix = opts.prefix || ''
  const hash = buildHashFn(opts.algorithm, opts.weak)

  app.addHook('onSend', function (req, reply, payload, done) {
    // only apply etags to the prefixed routes
    // console.log('checking %s against %s', req.url, prefix)
    if (!req.url.startsWith(prefix)) {
      done(null)
      return
    }

    // console.log('req.url %s starts with %s', req.url, prefix)
    let etag = reply.getHeader('etag')
    let newPayload

    // we do not generate with an already existing etag
    if (!etag) {
      // we do not generate etags for anything but strings and buffers
      if (!(typeof payload === 'string' || payload instanceof Buffer)) {
        done(null, newPayload)
        return
      }

      etag = hash(payload)
      reply.header('etag', etag)
      console.log('set etag for %s because of prefix %s', etag, req.url, prefix)
    }

    if (req.headers['if-none-match'] === etag) {
      console.log(
        'returning 304 for because etag %s is the same',
        req.url,
        etag,
      )
      reply.code(304)
      newPayload = ''
    }
    done(null, newPayload)
  })
}

function buildEtag(opts = {}) {
  // console.log('etags options', opts)
  // const prefix = opts.prefix || ''
  const hash = buildHashFn(opts.algorithm, opts.weak)

  return function (req, reply, payload, done) {
    // console.log('req.url %s starts with %s', req.url, prefix)
    let etag = reply.getHeader('etag')
    let newPayload

    // we do not generate with an already existing etag
    if (!etag) {
      // we do not generate etags for anything but strings and buffers
      if (!(typeof payload === 'string' || payload instanceof Buffer)) {
        done(null, newPayload)
        return
      }

      etag = hash(payload)
      reply.header('etag', etag)
      console.log('set etag for %s', etag, req.url)
    }

    if (req.headers['if-none-match'] === etag) {
      console.log(
        'returning 304 for because etag %s is the same',
        req.url,
        etag,
      )
      reply.code(304)
      newPayload = ''
    }
    done(null, newPayload)
  }
}

module.exports = { fastifyEtag, buildEtag }
