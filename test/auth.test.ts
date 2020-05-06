import { StubbedHttpServerForTesting, expect } from './utils'
import * as supertest from 'supertest'

describe('Testing endpoints authentication', () => {
  describe('with no auth strategy', async () => {
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
  describe('with bob auth strategy for all', async () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({ auth: 'bob' })
    let response: supertest.Response
    describe('with no authentication', () => {
      beforeEach(async () => {
        response = await httpServer.api().get('/liveness')
      })
      it('should return 401', () => {
        expect(response.status).to.equal(401)
      })
    })
    describe('with wrong authentication', () => {
      beforeEach(async () => {
        response = await httpServer.api().get('/liveness').set('Authorization', 'basic YWxpY2U6cGFzc3dvcmQ=')
      })
      it('should return 401', () => {
        expect(response.status).to.equal(401)
      })
    })
    describe('with right authentication', () => {
      beforeEach(async () => {
        response = await httpServer.api().get('/liveness').set('Authorization', 'basic Ym9iOnBhc3M=')
      })
      it('should return 200', () => {
        expect(response.status).to.equal(200)
      })
    })
  })
  describe('with distinct strategy for each endpoint', async () => {
    const httpServer: StubbedHttpServerForTesting = new StubbedHttpServerForTesting({
      auth: {
        liveness: 'bob',
        readiness: false,
        metrics: 'alice'
      }
    })
    let response: supertest.Response
    describe('with no authentication', () => {
      it('should return 401 for liveness', async () => {
        response = await httpServer.api().get('/liveness')
        expect(response.status).to.equal(401)
      })
      it('should return 200 for readiness (no auth required)', async () => {
        response = await httpServer.api().get('/readiness')
        expect(response.status).to.equal(200)
      })
      it('should return 401 for metrics', async () => {
        response = await httpServer.api().get('/metrics')
        expect(response.status).to.equal(401)
      })
    })
    describe('with alice authentication', () => {
      it('should return 401 for liveness', async () => {
        response = await httpServer.api().get('/liveness').set('Authorization', 'basic YWxpY2U6cGFzc3dvcmQ=')
        expect(response.status).to.equal(401)
      })
      it('should return 200 for readiness (no auth required)', async () => {
        response = await httpServer.api().get('/readiness').set('Authorization', 'basic YWxpY2U6cGFzc3dvcmQ=')
        expect(response.status).to.equal(200)
      })
      it('should return 200 for metrics', async () => {
        response = await httpServer.api().get('/metrics').set('Authorization', 'basic YWxpY2U6cGFzc3dvcmQ=')
        expect(response.status).to.equal(200)
      })
    })
    describe('with bob authentication', () => {
      it('should return 200 for liveness', async () => {
        response = await httpServer.api().get('/liveness').set('Authorization', 'basic Ym9iOnBhc3M=')
        expect(response.status).to.equal(200)
      })
      it('should return 200 for readiness (no auth required)', async () => {
        response = await httpServer.api().get('/readiness').set('Authorization', 'basic Ym9iOnBhc3M=')
        expect(response.status).to.equal(200)
      })
      it('should return 401 for metrics', async () => {
        response = await httpServer.api().get('/metrics').set('Authorization', 'basic Ym9iOnBhc3M=')
        expect(response.status).to.equal(401)
      })
    })
  })
})
