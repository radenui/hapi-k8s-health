import { Plugin, ResponseToolkit, ResponseObject, RequestRoute, RouteOptionsAccess } from '@hapi/hapi'
import { register, Registry, collectDefaultMetrics, Counter, Summary, Gauge, Histogram } from 'prom-client'
import { Boom } from '@hapi/boom'

type AuthType = false | string | RouteOptionsAccess

interface AuthObject {
  liveness: AuthType
  readiness: AuthType
  metrics: AuthType
}

export interface HealthPluginOptions {
  prometheusRegister: Registry,
  collectDefaultMetrics: boolean,
  defaultMetricsOptions: {
    prefix?: string,
    gcDurationBuckets?: number[]
  },
  readinessProbes: {
    [key: string]: () => Promise<string | void>
  },
  livenessProbes: {
    [key: string]: () => Promise<string | void>
  },
  livenessRoute: string,
  readinessRoute: string,
  metricsRoute: string,
  monitorProbes: boolean,
  monitorAllRoutesByDefault: boolean,
  exposeLiveness: boolean,
  exposeReadiness: boolean,
  exposeMetrics: boolean,
  probesSuccessCode: number,
  probesErrorCode: number,
  auth: AuthType | AuthObject,
  metricsName: {
    requestCounter?: string,
    requestSummary?: string,
    requestDurationHistogram?: string,
    currentRequests?: string
  }
}

const defaultOptions: HealthPluginOptions = {
  collectDefaultMetrics: true,
  prometheusRegister: register,
  monitorProbes: false,
  readinessProbes: {
    status: () => Promise.resolve('OK')
  },
  livenessProbes: {
    status: () => Promise.resolve('OK')
  },
  monitorAllRoutesByDefault: true,
  defaultMetricsOptions: {},
  exposeLiveness: true,
  exposeReadiness: true,
  exposeMetrics: true,
  livenessRoute: '/liveness',
  readinessRoute: '/readiness',
  metricsRoute: '/metrics',
  probesErrorCode: 500,
  probesSuccessCode: 200,
  auth: false,
  metricsName: {
    requestCounter: 'http_request_count',
    requestSummary: 'http_request_duration_ms',
    requestDurationHistogram: 'http_request_duration_seconds',
    currentRequests: 'http_current_request_count'
  }
}

const pkg = require('../package.json')
const pluginName = pkg.name

export const HealthPlugin: Plugin<Partial<HealthPluginOptions>> = {
  pkg,
  once: true,
  register: async function (server, options: Partial<HealthPluginOptions> = {}) {
    const config: HealthPluginOptions = {
      ...defaultOptions,
      ...options,
      defaultMetricsOptions: {
        ...defaultOptions.defaultMetricsOptions,
        ...(options.defaultMetricsOptions || {})
      },
      metricsName: {
        ...defaultOptions.metricsName,
        ...(options.metricsName || {})
      }
    }

    const currentRegister = config.prometheusRegister
    const monitorProbes = config.monitorProbes

    if (config.exposeMetrics) {
      if (config.collectDefaultMetrics) {
        collectDefaultMetrics({
          ...config.defaultMetricsOptions,
          register: currentRegister
        })
      }

      const requestCounter = new Counter<'method' | 'path' | 'status_code'>({
        // @ts-ignore => default value set even if not passed into options
        name: config.metricsName.requestCounter,
        help: 'Total number of http requests',
        labelNames: ['method', 'status_code', 'path'],
        registers: [currentRegister]
      })
      const requestSummary = new Summary<'method' | 'path' | 'status_code'>({
        // @ts-ignore => default value set even if not passed into options
        name: config.metricsName.requestSummary,
        help: 'Duration of http requests',
        labelNames: ['method', 'status_code', 'path'],
        aggregator: 'average',
        registers: [currentRegister]
      })
      const requestDurationHistogram = new Histogram<'method' | 'path' | 'status_code'>({
        // @ts-ignore => default value set even if not passed into options
        name: config.metricsName.requestDurationHistogram,
        help: 'Duration of http requests',
        labelNames: ['method', 'status_code', 'path'],
        aggregator: 'average',
        registers: [currentRegister]
      })
      const currentRequests = new Gauge<'method' | 'path'>({
        // @ts-ignore => default value set even if not passed into options
        name: config.metricsName.currentRequests,
        help: 'Number of requests currently running',
        labelNames: ['method'],
        registers: [currentRegister]
      })

      server.route({
        method: 'GET',
        path: config.metricsRoute,
        options: {
          plugins: {
            [pkg.name]: monitorProbes
          },
          auth: getAuth(config, 'metrics')
        },
        handler: function (_, h) {
          return h
            .response(currentRegister.metrics())
            .header('Content-Type', currentRegister.contentType)
        }
      })

      server.ext('onRequest', (request, h) => {
        currentRequests.inc({ method: request.method })
        if (discardRouteMonitoring(config, request.route)) { return h.continue }
        return h.continue
      })

      server.events.on('response', request => {
        currentRequests.dec({ method: request.method })
        if (discardRouteMonitoring(config, request.route)) { return }
        const path = request.route.path === '/{p*}' ? request.path : request.route.path
        const statusCode = request.response instanceof Boom
          ? request.response.output.statusCode
          : request.response.statusCode
        const duration = (request.info.completed || request.info.responded) - request.info.received
        requestCounter.labels(request.method, `${statusCode}`, path).inc()
        requestSummary.labels(request.method, `${statusCode}`, path).observe(duration)
        requestDurationHistogram.labels(request.method, `${statusCode}`, path).observe(duration / 1000)
      })
    }

    if (config.exposeLiveness) {
      server.route({
        method: 'GET',
        path: config.livenessRoute,
        options: {
          plugins: {
            [pkg.name]: monitorProbes
          },
          auth: getAuth(config, 'liveness')
        },
        handler: async (_, h) => {
          if (config.livenessProbes && Object.keys(config.livenessProbes).length) {
            return replyToProbe(h, config.livenessProbes, config.probesSuccessCode, config.probesErrorCode)
          } else {
            return h.response('OK')
          }
        }
      })
    }

    if (config.exposeReadiness) {
      server.route({
        method: 'GET',
        path: config.readinessRoute,
        options: {
          plugins: {
            [pkg.name]: monitorProbes
          },
          auth: getAuth(config, 'readiness')
        },
        handler: async (_, h) => {
          if (config.readinessProbes && Object.keys(config.readinessProbes).length) {
            return replyToProbe(h, config.readinessProbes, config.probesSuccessCode, config.probesErrorCode)
          } else {
            return h.response('OK')
          }
        }
      })
    }
  }
}

function discardRouteMonitoring (config: HealthPluginOptions, route: RequestRoute): boolean {
  if (config.monitorAllRoutesByDefault === false) {
    return !route?.settings?.plugins?.[pluginName] === true
  }
  return route?.settings?.plugins?.[pluginName] === false
}

async function replyToProbe (
  h: ResponseToolkit,
  probes: { [key: string]: () => Promise<string | void> },
  successCode: number,
  errorCode: number
): Promise<ResponseObject> {
  const probesResults = await executePromiseInObject(probes)
  const statusCode = Object.values(probesResults).find(entry => entry.startsWith('KO: ')) ? errorCode : successCode
  return h.response(probesResults).code(statusCode)
}

async function executePromiseInObject (promiseObject: { [key: string]: () => Promise<string | void> }): Promise<{ [key: string]: string }> {
  const response: { [key: string]: string } = {}
  const entries: [string, Function][] = Object.entries(promiseObject)
  const probesResults: string[] = await Promise.all(
    entries.map(entry => {
      return entry[1]()
        .then((result: string | void) => result || 'OK')
        .catch((e: Error) => 'KO: ' + e.message)
    })
  )
  entries.forEach((entry, index) => {
    response[entry[0]] = probesResults[index]
  })
  return response
}

function getAuth (config: HealthPluginOptions, endpointName: string): AuthType {
  return typeof config.auth === 'object' && typeof config.auth[endpointName] !== 'undefined'
    ? config.auth[endpointName]
    : config.auth
}
