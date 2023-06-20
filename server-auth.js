'use strict'

const app = require('fastify')({ logger: true })
const fastifySession = require('@fastify/session')
const fastifyCookie = require('@fastify/cookie')
const fastifyFormbody = require('@fastify/formbody')

const { loginPage, defaultPage } = require('./src/html')

app.register(fastifyCookie, {})
app.register(fastifySession, {
  secret: '221844bd5dee865ff3c347b9415bf4339c7eaec79e111153f1ed12bf5c9ff0d2',
  cookie: { secure: false },
  expires: 600_000,
})
app.register(fastifyFormbody)

app.get('/login', (request, reply) => {
  reply.type('text/html')
  reply.send(loginPage())
})

// add a login route that handles the actual login
app.post('/login', (request, reply) => {
  const { email, password } = request.body
  console.log('%o', request.body)

  if (password === 'abcdef') {
    console.log('%s login successful, redirecting home', email)
    request.session.authenticated = true
    reply.redirect('/')
  } else {
    console.log('login for %s failed', email)
    reply.code(302).redirect('/login')
  }
})

// an authenticated route
app.post('/info', (request, reply) => {
  if (request.session.authenticated) {
    console.log('returning info for authenticated user')
    reply.send({ username: 'joe', isAdmin: false })
  } else {
    console.log('user is not authenticated, deny')
    reply.code(401).send({ error: 'Not found' })
  }
})

app.get('/', (request, reply) => {
  reply.type('text/html')
  reply.send(defaultPage(request.session.authenticated))
})

// add a logout route
app.get('/logout', (request, reply) => {
  if (request.session.authenticated) {
    console.log('removing authenticated session')
    request.session.destroy((err) => {
      if (err) {
        reply.status(500)
        reply.send('Internal Server Error')
      } else {
        reply.redirect('/')
      }
    })
  } else {
    console.log('not authenticated, returning home page')
    reply.redirect('/')
  }
})

// Run the server!
const start = async () => {
  try {
    await app.listen({ port: 7007 })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}
start()

async function closeServer(signal) {
  console.log(`closing the CORS server with the signal ${signal}`)
  await app.close()
  process.kill(process.pid, signal)
}
process.once('SIGINT', closeServer)
process.once('SIGTERM', closeServer)
