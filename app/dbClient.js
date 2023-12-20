/* Module to connect to Postgress database */
// import things
const { Pool, types } = require('pg');
//make sure that floats are floats, by default they come back from Postgres as strings
types.setTypeParser(1700, x => parseFloat(x));
// get environemental variables
const {
    DB_HOST: host,
    POSTGRESDB_USER: user,
    DB_PASSWORD: password,
    POSTGRESDB_DATABASE: database,
    DB_PORT: port
} = process.env;


// create connection pool
const pool = new Pool({
    database: database,
    host: host,
    user: user,
    password: password,
    port: port,
    max: 1,
    idleTimeoutMillis: 1000
});

// export query
module.exports.query = (text, values) => {
    return pool.query(text, values);
};