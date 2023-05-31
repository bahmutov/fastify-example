const fastify = require('fastify')({ logger: true })
const cors = require('@fastify/cors')

fastify
  .register(cors, {
    origin: 'http://localhost:4200',
    methods: 'GET',
    allowedHeaders: 'Content-Type',
    strictPreflight: true,
    cacheControl: 0,
    maxAge: 0,
  })
  .then(() => {
    fastify.get('/', (req, reply) => {
      console.log(
        'CORS: request from %s content type %s',
        req.headers.origin,
        req.headers['content-type'],
      )
      reply.send({ hello: 'world' })
    })

    // Run the server!
    const start = async () => {
      try {
        await fastify.listen({ port: 6006 })
      } catch (err) {
        fastify.log.error(err)
        process.exit(1)
      }
    }
    start()

    async function closeServer(signal) {
      console.log(`closing the CORS server with the signal ${signal}`)
      await fastify.close()
      process.kill(process.pid, signal)
    }
    process.once('SIGINT', closeServer)
    process.once('SIGTERM', closeServer)
  })
