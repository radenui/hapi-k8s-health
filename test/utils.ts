import { Server, ServerRoute } from '@hapi/hapi'
import * as Boom from '@hapi/boom'
import { SuperTest, Test } from 'supertest'
import { register } from 'prom-client'
import { expect } from 'chai'
import { HealthPluginOptions, HealthPlugin } from '../src/plugin'

const pkg = require('../package.json')

import supertest = require('supertest')

// eslint-disable-next-line no-process-env
export const port = process.env.TEST_PORT || 9876

export { expect }

export async function initServer (pluginOptions: Partial<HealthPluginOptions>): Promise<Server> {
  const routes: ServerRoute[] = [
    {
      path: '/unmonitored',
      method: 'get',
      options: {
        plugins: {
          [pkg.name]: false
        }
      },
      handler: (_, h) => {
        return h.response('OK').code(200)
      }
    },
    {
      path: '/monitored',
      method: 'get',
      options: {
        plugins: {
          [pkg.name]: true
        }
      },
      handler: (_, h) => {
        return h.response('OK').code(200)
      }
    },
    {
      path: '/',
      method: 'get',
      handler: (_, h) => {
        return h.response('OK').code(200)
      }
    },
    {
      path: '/',
      method: 'post',
      handler: (_, h) => {
        return h.response('OK').code(201)
      }
    },
    {
      path: '/badRequest',
      method: 'post',
      handler: () => {
        return Boom.badRequest('this is bad')
      }
    },
    {
      path: '/forbidden',
      method: 'get',
      handler: () => {
        return Boom.forbidden('try again')
      }
    },
    {
      path: '/long',
      method: 'get',
      handler: async (_, h) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return h.response('OK').code(200)
      }
    }
  ]
  const server = new Server({
    port
  })
  await server.register(require('@hapi/basic'))
  await addStrategy(server, 'alice')
  await addStrategy(server, 'bob')
  server.register({
    plugin: HealthPlugin,
    options: pluginOptions
  })

  server.route(routes)

  return server
}

interface HttpServerForTesting {
  api (): SuperTest<Test>
}

export class StubbedHttpServerForTesting implements HttpServerForTesting {
  public server: Server | undefined
  constructor (pluginOptions: Partial<HealthPluginOptions> = {}) {
    before(async () => {
      register.clear()
      this.server = await initServer(pluginOptions)
      await this.server.start()
    })

    after(async () => {
      if (!this.server) {
        throw new Error('server not initialized')
      }
      await this.server.stop()
      register.clear()
    })
  }

  api () {
    if (this.server) {
      return supertest(this.server.listener)
    }
    throw new Error('server not initialized')
  }
}

async function addStrategy (server: Server, name: string): Promise<void> {
  const validate = async (_, username) => {
    const credentials = { id: username }
    return username === name ? { isValid: true, credentials } : { isValid: false }
  }
  server.auth.strategy(name, 'basic', { validate })
}
