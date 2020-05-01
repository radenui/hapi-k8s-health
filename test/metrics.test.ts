import { StubbedHttpServerForTesting, expect } from './utils'
import * as supertest from 'supertest'
import { register, Registry } from 'prom-client'

describe('Testing metrics endpoint', () => {
  describe('with default settings', () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting()
    describe('when no requests yet', () => {
      let response: supertest.Response
      beforeEach(async () => {
        response = await httpServer.api().get('/metrics')
      })
      it('should return status code 200', () => {
        expect(response).to.have.property('statusCode', 200)
      })
      it('should return deefault node metrics', () => {
        expect(response.text).to.contain('process_cpu_user_seconds_total')
        expect(response.text).to.contain('process_cpu_system_seconds_total')
        expect(response.text).to.contain('process_start_time_seconds')
        expect(response.text).to.contain('nodejs_eventloop_lag_seconds')
        expect(response.text).to.contain('nodejs_eventloop_lag_min_seconds')
      })
      it('should return empty plugin http metrics', () => {
        expect(response.text).to.contain(`# HELP http_request_count Total number of http requests
# TYPE http_request_count counter

# HELP http_request_duration_ms Duration of http requests
# TYPE http_request_duration_ms summary

# HELP http_request_duration_seconds Duration of http requests
# TYPE http_request_duration_seconds histogram

# HELP http_current_request_count Number of requests currently running
# TYPE http_current_request_count gauge`)
      })
    })
    describe('when a request is done on each endpoint', () => {
      let response: supertest.Response
      const testCases = [
        {
          method: 'get',
          path: '/',
          status: '200'
        },
        {
          method: 'post',
          path: '/',
          status: '201'
        },
        {
          method: 'get',
          path: '/forbidden',
          status: '403'
        },
        {
          method: 'get',
          path: '/notFound',
          status: '404'
        },
        {
          method: 'post',
          path: '/badRequest',
          status: '400'
        }
      ]
      beforeEach(async () => {
        await httpServer.api().get('/')
        await httpServer.api().post('/').send('')
        await httpServer.api().post('/badRequest').send('')
        await httpServer.api().get('/forbidden')
        await httpServer.api().get('/notFound')
        await httpServer.api().get('/unmonitored')
        response = await httpServer.api().get('/metrics')
      })
      afterEach(() => {
        register.resetMetrics()
      })

      it('should increment counter', () => {
        expect(response.text).to.contain(`# HELP http_request_count Total number of http requests
# TYPE http_request_count counter
http_request_count{method="get",status_code="200",path="/"} 1
http_request_count{method="post",status_code="201",path="/"} 1
http_request_count{method="post",status_code="400",path="/badRequest"} 1
http_request_count{method="get",status_code="403",path="/forbidden"} 1
http_request_count{method="get",status_code="404",path="/notFound"} 1

`)
      })

      it('should have a gauge of 1 (/metrics route)', () => {
        expect(response.text).to.contain('http_current_request_count{method="get"} 1')
      })

      it('should not monitor unmonitored routes', () => {
        expect(response.text).not.to.contain('/unmonitored')
      })

      for (const testCase of testCases) {
        it(`should expose http request duration ms summary for ${testCase.method}: ${testCase.path} => ${testCase.status}`, () => {
          for (const quantile of ['0.01', '0.05', '0.5', '0.9', '0.95', '0.99', '0.999']) {
            expect(response.text).to
              .match(new RegExp(`http_request_duration_ms\\{quantile="${quantile}",method="${testCase.method}",status_code="${testCase.status}",path="\\${testCase.path}"\\} \\d+`))
          }
          expect(response.text).to.match(new RegExp(`http_request_duration_ms_sum\\{method="${testCase.method}",status_code="${testCase.status}",path="\\${testCase.path}"\\} \\d+`))
          expect(response.text).to.match(new RegExp(`http_request_duration_ms_count\\{method="${testCase.method}",status_code="${testCase.status}",path="\\${testCase.path}"\\} \\d+`))
        })
      }

      for (const testCase of testCases) {
        it(`should expose http request duration seconds histogram for ${testCase.method}: ${testCase.path} => ${testCase.status}`, () => {
          for (const le of ['0.01', '0.025', '0.05', '0.1', '0.5', '1', '5', '10', '\\+Inf']) {
            expect(response.text).to
              .match(new RegExp(`http_request_duration_seconds_bucket\\{le="${le}",method="${testCase.method}",status_code="${testCase.status}",path="\\${testCase.path}"\\} \\d+`))
          }
          expect(response.text).to.match(new RegExp(`http_request_duration_seconds_sum\\{method="${testCase.method}",status_code="${testCase.status}",path="\\${testCase.path}"\\} \\d+`))
          expect(response.text).to.match(new RegExp(`http_request_duration_seconds_count\\{method="${testCase.method}",status_code="${testCase.status}",path="\\${testCase.path}"\\} \\d+`))
        })
      }
    })
    describe('when two requests in parallel', () => {
      const wait = t => new Promise(resolve => setTimeout(resolve, t))
      it('should return a gauge of 2', async () => {
        const responses: [supertest.Response, supertest.Response] = await Promise.all([
          httpServer.api().get('/long'),
          wait(20).then(() => httpServer.api().get('/metrics'))
        ])
        const response = responses[1]
        expect(response.text).to.contain('http_current_request_count{method="get"} 2')
      })
    })
  })
  describe('with monitoring disabled by default', () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      monitorAllRoutesByDefault: false
    })
    let response: supertest.Response
    beforeEach(async () => {
      await httpServer.api().get('/')
      await httpServer.api().post('/').send('')
      await httpServer.api().post('/badRequest').send('')
      await httpServer.api().get('/forbidden')
      await httpServer.api().get('/notFound')
      await httpServer.api().get('/monitored')
      response = await httpServer.api().get('/metrics')
    })
    it('should monitor only /monitored route', () => {
      expect(response.text).to.contain(`# HELP http_request_count Total number of http requests
# TYPE http_request_count counter
http_request_count{method="get",status_code="200",path="/monitored"} 1

`)
      expect(response.text).not.to.contain('/forbidden')
    })
  })
  describe('with another endpoint for metrics', () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      metricsRoute: '/my-metrics'
    })
    let response: supertest.Response
    it('should return 404 when calling /metrics', async () => {
      response = await httpServer.api().get('/metrics')
      expect(response.status).to.equal(404)
    })
    it('should return 200 when calling /my-metrics', async () => {
      response = await httpServer.api().get('/my-metrics')
      expect(response.status).to.equal(200)
    })
    it('should return default nodejs metrics', async () => {
      response = await httpServer.api().get('/my-metrics')
      expect(response.text).to.contain('nodejs_eventloop_lag_seconds')
    })
  })
  describe('with disable collecting default metrics', () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      collectDefaultMetrics: false
    })
    let response: supertest.Response
    it('should return 200 when calling /metrics', async () => {
      response = await httpServer.api().get('/metrics')
      expect(response.status).to.equal(200)
    })
    it('should not return default nodejs metrics', async () => {
      response = await httpServer.api().get('/metrics')
      expect(response.text).not.to.contain('nodejs_eventloop_lag_seconds')
    })
  })
  describe('with enable collecting metrics on probes ', () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      monitorProbes: true
    })
    let response: supertest.Response
    beforeEach(async () => {
      await httpServer.api().get('/')
      await httpServer.api().get('/metrics')
      await httpServer.api().get('/liveness')
      response = await httpServer.api().get('/metrics')
    })
    it('should return 200 when calling /metrics', async () => {
      expect(response.status).to.equal(200)
    })
    it('should not return default nodejs metrics', async () => {
      expect(response.text).to.contain('http_request_count{method="get",status_code="200",path="/metrics"} ')
      expect(response.text).to.contain('http_request_count{method="get",status_code="200",path="/liveness"} ')
    })
  })
  describe('with custom register ', () => {
    const reg = new Registry()
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      prometheusRegister: reg
    })
    let response: supertest.Response
    beforeEach(async () => {
      await httpServer.api().get('/')
      await httpServer.api().get('/metrics')
      response = await httpServer.api().get('/metrics')
    })
    it('should return status code 200', () => {
      expect(response).to.have.property('statusCode', 200)
    })
    it('should return deefault node metrics', () => {
      expect(response.text).to.contain('process_cpu_user_seconds_total')
      expect(response.text).to.contain('process_cpu_system_seconds_total')
      expect(response.text).to.contain('process_start_time_seconds')
      expect(response.text).to.contain('nodejs_eventloop_lag_seconds')
      expect(response.text).to.contain('nodejs_eventloop_lag_min_seconds')
    })
    it('should return plugin http metrics', () => {
      expect(response.text).to.contain(`# HELP http_request_count Total number of http requests
# TYPE http_request_count counter`)
    })
    it('should let the default register empty', () => {
      expect(register.getSingleMetric('process_cpu_user_seconds_total')).to.be.undefined
      expect(register.getSingleMetric('http_request_count')).to.be.undefined
    })
  })
  describe('with disable metrics collection at all', () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      exposeMetrics: false
    })
    let response: supertest.Response
    beforeEach(async () => {
      response = await httpServer.api().get('/metrics')
    })
    it('should return 404 when calling /metrics', async () => {
      expect(response.status).to.equal(404)
    })
    it('should not return default nodejs metrics', async () => {
      expect(response.text).not.to.contain('nodejs_eventloop_lag_seconds')
    })
    it('should let the default register empty', () => {
      expect(register.getSingleMetric('process_cpu_user_seconds_total')).to.be.undefined
      expect(register.getSingleMetric('http_request_count')).to.be.undefined
    })
  })
})
