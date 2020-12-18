
describe('Ceramic <-> CAS integration tests', () => {
    jest.setTimeout(1000 * 60 * 5) // 5 minutes


    beforeAll(async () => {
        console.log("FIXTURE SETUP")
    })

    afterAll(async () => {
        console.log("FIXTURE TEARDOWN")
    })

    beforeEach(async () => {
        console.log("TEST SETUP")
    })

    afterEach(async () => {
        console.log("TEST TEARDOWN")
    })

    it('basic test', async () => {
        console.log("RUNNING TEST")
        expect(5).toEqual(5)
    })

})