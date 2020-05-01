# hapi-k8s-health

Hapi plugin to expose health and metrics endpoint for kubernetes or other orchestration platform

## Requirements

Works with Hapi v17 or higher

## Features

### Metrics endpoint

Exposes [Prometheus](https://prometheus.io/) formatted metrics for http requests and, by default, the default [prom-client](https://github.com/siimon/prom-client) metrics for node.js.

#### http metrics

- **http_request_count**: [Counter](https://github.com/siimon/prom-client#counter) total http requests by:
    - path
    - method
    - returned http code

- **http_current_request_count**: [Gauge](https://github.com/siimon/prom-client#gauge) number of http requests currently running by:
    - method

- **http_request_duration_seconds**: [Histogram](https://github.com/siimon/prom-client#histogram) histogram of http requests duration in seconds by:
    - path
    - method
    - returned http code

- **http_request_duration_ms**: [Summary](https://github.com/siimon/prom-client#summary) summary of http requests duration in milliseconds by:
    - path
    - method
    - returned http code

### Liveness endpoint

Endpoint `/liveness` used by kubernetes to status whether or not the server is alive. Default probe shoule be enough for most cases.

### Readiness endpoint

Endpoint `/readiness` used by kubernetes to status whether or not the server is ready to accept connections. You should probably check your database connection here, for example.

## Options

- _prometheusRegister_: custom Prometheus register from [prom-client](https://github.com/siimon/prom-client) library. Defaults to **default register**
- _collectDefaultMetrics_: whether or not the plugin should exposee [prom-client](https://github.com/siimon/prom-client) default node.js metrics. Default to `true`
- _defaultMetricsOptions_: [prom-client](https://github.com/siimon/prom-client) options for default metrics. Defaults to `{}`
- _readinessProbes_: object containing the probes you want your *readiness* endpoint to execute. A probe is a function returning a `Promise` object of a `string` or `void`. Example:
```typescript
{
    database: () => Promise.resolve('It works'),
    queuer: () => Promise.resolve()
}
```

Default: 

```typescript
{
    status: Promise.resolve('OK')
}
```
- _livenessProbes_: object containing the probes you want your *liveness* endpoint to execute. A probe is a function returning a `Promise` object of a `string` or `void`. Example:
```typescript
{
    database: () => Promise.resolve('It works'),
    queuer: () => Promise.resolve()
}
```

Default: 

```typescript
{
    status: Promise.resolve('OK')
}
```
- _livenessRoute_: the route you want for your liveness probes. Default: `/liveness`
- _readinessRoute_: the route you want for your readiness probes. Default: `/readiness`
- _metricsRoute_: the route you want for your metrics. Default: `/metrics`
- _monitorProbes_: whether or not you want your probes to be monitored by metrics. Default to `false`
- _monitorAllRoutesByDefault_: whether or not you want all routes to be monitored by default. Default to `true`
- _exposeLiveness_: should the liveness probe be active. Default to `true` 
- _exposeReadiness_: should the readiness probe be active. Default to `true` 
- _exposeMetrics_: should the metrics endpoint be active. Default to `true` 
- _probesSuccessCode_: http status code when successfully executes all probes of *liveness* or *readiness* endpoints.Defaults to `200`
- _probesErrorCode_: http status code when one of the probes of *liveness* or *readiness* endpoints throws an error. Defaults to `500`