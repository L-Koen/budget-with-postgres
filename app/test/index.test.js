const { assert, expect } = require('chai');
const request = require('supertest');
const { Pool } = require('pg');
const client = require('../dbClient.js');
const { idleTimeoutMillis } = require('pg/lib/defaults');

// get environemental variables
const {
    DB_HOST: host,
    POSTGRESDB_USER: user,
    DB_PASSWORD: password,
    POSTGRESDB_DATABASE: database,
    DB_PORT: port
} = process.env;

describe('Budget envelope app', function() {
    let app;

    before('Mock the database and then load app', async function() {
        // create new pool with limit 1:
        const pool = new Pool({
            host: host,
            database: database,
            user: user,
            password: password,
            port: port,
            max: 1,
            idleTimeoutMillis: 0 // disable auto-disconnection during tests
        });
        
        // overwrite query function to connect to this pool
        client.query = (text, values) => {
            return pool.query(text, values);
        };

        // import app after overwrite
        app = require('../index.js');
    });

    beforeEach('Create temporary tables and seed data', async function() {
        await client.query(`CREATE TEMPORARY TABLE ${database} (LIKE ${database} INCLUDING ALL)`);
        await client.query(`INSERT INTO ${database} (id, name, amount) VALUES (0, 'home', 0)`);
        await client.query(`INSERT INTO ${database} (id, name, amount) VALUES (1, 'food', 200)`);
        await client.query(`INSERT INTO ${database} (id, name, amount) VALUES (2, 'fun', 0)`);
    });

    afterEach('Drop temporary tables', async function() {
        await client.query(`DROP TABLE IF EXISTS pg_temp.${database}`);
    });

    describe('Database test', function() {
        it('should be seeded', async function() {
            const { rows } = await client.query(`SELECT * FROM ${database}`);
            assert.strictEqual(rows.length, 3);
        });

        it('rejects negative amounts', async function() {
            // some work to make it understand async function errors.
            let error = null
            try {
                await client.query(`INSERT INTO ${database} (name, amount) VALUES ('test', -10)`);
            }  catch (err) {
                error = err;
            };
            expect(error).to.be.an('Error');
        });

        it('rejects duplicate names', async function() {
            // some work to make it understand async function errors.
            let error = null
            try {
                await client.query(`INSERT INTO ${database} (name, amount) VALUES ('home', 10)`);
            }  catch (err) {
                error = err;
            };
            expect(error).to.be.an('Error');
        });
    });

    describe('API tests', function() {
        describe('GET /envelopes', function() {
            it('returns the existing envelopes', async function() {
                // setup
                const expectedLength = 3; // db is seeded with 3 rows
                const expectedStatus = 200;

                // exercise
                const response = await request(app).get('/envelopes').send();

                // verify
                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.body.length, expectedLength);
            });
        });

        describe('GET /envelopes{envID}', function() {
            it('returns the right envelope when asked', async function() {
                //setup.
                const expected = {id: 1, name: 'food', amount: 200};
                const path = '/envelopes/1';
                const expectedStatus = 200;

                const response = await request(app).get(path).send()

                assert.strictEqual(response.status, expectedStatus);
                assert.deepEqual(response.body, expected);
            });

            it('returns an "Error:Invalid input" with the wrong id', async function() {
                let error = null
                const path = '/envelopes/100';
                const expectedStatus = 405;
                const expectedMessage = 'Invalid input';
                
                const response = await request(app).get(path).send();

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });
        });

        describe('POST "/envelopes" new envelope', function() {
            it('works with the right data', async function() {
                const newEnvelope = {id: 3, name: 'toys', amount: 77.77};
                const expectedStatus = 201;
                const path = '/envelopes'

                const response = await request(app).post(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.deepEqual(response.body, newEnvelope);
            });

            it('rejects duplicate envelope ID with 405', async function() {
                const newEnvelope = {id: 0, name: 'greed', amount: 77.77};
                const expectedStatus = 405;
                const path = '/envelopes'
                const expectedMessage = 'Envelope ID already exists';

                const response = await request(app).post(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('rejects negative amount with 405', async function() {
                const newEnvelope = {id: 5, name: 'hunger', amount: -77.77};
                const expectedStatus = 405;
                const path = '/envelopes'
                const expectedMessage = 'Negative amount';

                const response = await request(app).post(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('rejects duplicate envelope name with 405', async function() {
                const newEnvelope = {id: 5, name: 'home', amount: 77.77};
                const expectedStatus = 405;
                const path = '/envelopes'
                const expectedMessage = 'Envelope name already exists';

                const response = await request(app).post(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('rejects general bad data 405', async function() {
                const newEnvelope = {id: 'talk', help: 'given'};
                const expectedStatus = 405;
                const path = '/envelopes'
                const expectedMessage = 'Invalid input';

                const response = await request(app).post(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('Tells you to switch endpoint for updating', async function() {
                const newEnvelope = {id: 0, name: 'home', amount: 77.77};
                const expectedStatus = 400;
                const path = '/envelopes'
                const expectedMessage = 'Use PUT "/envelopes/{envelopeID}" for updating';


                const response = await request(app).post(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });
        });

        describe('PUT "/envelopes/{envID}" update envelope', function() {
            it('works with the right data', async function() {
                const expected = {id: 0, name: 'home', amount: 77.77};
                const expectedStatus = 200;
                const path = `/envelopes/${expected.id}`;


                const response = await request(app).put(path).send(expected);

                assert.strictEqual(response.status, expectedStatus);
                assert.deepEqual(response.body, expected);
            });

            it('Fails with negative amount', async function() {
                const newEnvelope = {id: 0, name: 'home', amount: -77.77};
                const expectedStatus = 405;
                const path = `/envelopes/${newEnvelope.id}`
                const expectedMessage = 'Negative amount';

                const response = await request(app).put(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('Fails with duplicate name', async function() {
                const newEnvelope = {id: 0, name: 'food', amount: 77};
                const expectedStatus = 405;
                const path = `/envelopes/${newEnvelope.id}`
                const expectedMessage = 'Envelope ID already exists';

                const response = await request(app).put(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('rejects general bad data 405', async function() {
                const newEnvelope = {id: 'talk', help: 'given'};
                const expectedStatus = 405;
                const path = `/envelopes/${newEnvelope.id}`
                const expectedMessage = 'Invalid input';

                const response = await request(app).put(path).send(newEnvelope);

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });
        });

        describe('DELETE "/envelopes/{envID}" delete envelope', function() {
            it('works on an empty envelope', async function() {
                const expectedStatus = 204;
                const path = `/envelopes/0`;


                const response = await request(app).delete(path).send();

                assert.strictEqual(response.status, expectedStatus);
            });

            it('Rejects on a full envelope', async function() {
                const expectedStatus = 405;
                const path = `/envelopes/1`;
                const expectedMessage = 'Envelope not empty';


                const response = await request(app).delete(path).send();

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });

            it('Fails on a non-existing ID', async function() {
                const expectedStatus = 405;
                const path = `/envelopes/blaf`;
                const expectedMessage = 'Invalid input';


                const response = await request(app).delete(path).send();

                assert.strictEqual(response.status, expectedStatus);
                assert.strictEqual(response.text, expectedMessage);
            });
        });

        describe('POST "/transfer/{fromID}/{toID}"', function() {
            it('works with existing envelopes and sufficient funds', async function () {
                const amount = {amount: 50};
                const path = `/envelopes/transfer/1/0`;
                const expectedStatus = 200;

                const response = await request(app).post(path).send(amount);

                assert.strictEqual(response.status, expectedStatus);
            });

            it('Fails with existing envelopes and insufficient funds', async function () {
                const amount = {amount: 50};
                const path = `/envelopes/transfer/0/1`;
                const expectedStatus = 405;

                const response = await request(app).post(path).send(amount);

                assert.strictEqual(response.status, expectedStatus);
            });
        });

    });
});