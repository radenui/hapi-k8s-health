import { StubbedHttpServerForTesting, expect } from './utils'
import * as supertest from 'supertest'

describe('Testing readiness and liveness probes', () => {
  describe('Testing common behaviour', () => {
    describe('using default settings', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting()
      let response: supertest.Response
      beforeEach(async () => {
        response = await httpServer.api().get('/liveness')
      })
      it('should return 200', () => {
        expect(response.status).to.equal(200)
      })
      it('should return status OK', () => {
        expect(response.body).to.deep.equal({ status: 'OK' })
      })
    })
    describe('using custom probes', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        livenessProbes: {
          check0: () => Promise.resolve(),
          check1: () => Promise.resolve('youpi'),
          check2: () => Promise.reject(new Error('too bad'))
        }
      })
      let response: supertest.Response
      beforeEach(async () => {
        response = await httpServer.api().get('/liveness')
      })
      it('should return 500', () => {
        expect(response.status).to.equal(500)
      })
      it('should return status OK', () => {
        expect(response.body).to.deep.equal({ check0: 'OK', check1: 'youpi', check2: 'KO: too bad' })
      })
    })
    describe('using custom return codes', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        livenessProbes: {
          check0: () => Promise.resolve(),
          check1: () => Promise.resolve('youpi'),
          check2: () => Promise.reject(new Error('too bad'))
        },
        probesSuccessCode: 202,
        probesErrorCode: 503
      })
      let responseLiveness: supertest.Response
      let responseReadiness: supertest.Response
      beforeEach(async () => {
        responseLiveness = await httpServer.api().get('/liveness')
        responseReadiness = await httpServer.api().get('/readiness')
      })
      it('should return 503', () => {
        expect(responseLiveness.status).to.equal(503)
      })
      it('should return 202', () => {
        expect(responseReadiness.status).to.equal(202)
      })
    })
  })
  describe('liveness specifics', () => {
    describe('with liveness disabled', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        exposeLiveness: false
      })
      let response: supertest.Response
      beforeEach(async () => {
        response = await httpServer.api().get('/liveness')
      })
      it('should return 404', () => {
        expect(response.status).to.equal(404)
      })
    })
    describe('with liveness specific endpoint', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        livenessRoute: '/alive'
      })
      let response: supertest.Response
      it('should return 404 fro /liveness', async () => {
        response = await httpServer.api().get('/liveness')
        expect(response.status).to.equal(404)
      })
      it('should return 200 fof custm', async () => {
        response = await httpServer.api().get('/alive')
        expect(response.status).to.equal(200)
      })
    })
    describe('with no liveness probes', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        livenessProbes: {}
      })
      let response: supertest.Response
      it('should return 200 fof custm', async () => {
        response = await httpServer.api().get('/liveness')
        expect(response.status).to.equal(200)
        expect(response.text).to.equal('OK')
      })
    })
  })
  describe('readiness specifics', () => {
    describe('with readiness disabled', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        exposeReadiness: false
      })
      let response: supertest.Response
      beforeEach(async () => {
        response = await httpServer.api().get('/readiness')
      })
      it('should return 404', () => {
        expect(response.status).to.equal(404)
      })
    })
    describe('with readiness specific endpoint', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        readinessRoute: '/ready'
      })
      let response: supertest.Response
      it('should return 404 fro /readiness', async () => {
        response = await httpServer.api().get('/readiness')
        expect(response.status).to.equal(404)
      })
      it('should return 200 fof custm', async () => {
        response = await httpServer.api().get('/ready')
        expect(response.status).to.equal(200)
      })
    })
    describe('with no readiness probes', () => {
      const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
        readinessProbes: {}
      })
      let response: supertest.Response
      it('should return 200 fof custm', async () => {
        response = await httpServer.api().get('/readiness')
        expect(response.status).to.equal(200)
        expect(response.text).to.equal('OK')
      })
    })
  })
})
