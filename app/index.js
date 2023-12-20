const express = require('express');
const dbClient = require('./dbClient.js');

const PORT = process.env.NODE_LOCAL_PORT;
const database = process.env.POSTGRESDB_DATABASE;
const app = express();

// parse request body
app.use(express.json());


// helper functions

function isInt(value) {
    // to help determine if am ID is valid
    return !isNaN(value) && 
           parseInt(Number(value)) == value && 
           !isNaN(parseInt(value, 10));
};

function checkAmount(amount) {
    const newAmount = Number(amount);
    if (newAmount && newAmount >= 0 && !Number.isNaN(newAmount)) {
        return newAmount;
    } else {
        return false;
    }
};

async function checkID (id) {
    if (isInt(id)) {
        const query = `SELECT * FROM ${database} WHERE id = $1`;
        const queryParams = [id,];
        const { rows } = await dbClient.query(query, queryParams);
        if (rows.length === 1) {
            const envelope = rows[0];
            const envID = Number(id);
            return {envID: envID, envelope: envelope};
        } else {
            return false
        };
    } else {
        return false
    };  
};

const validateEnvelope = async (req, res, next) => {
    req.newEnvelope = {};

    const id = req.body.id
    if (isInt(id)) {
        const query = `SELECT * FROM ${database} WHERE id = $1`;
        const queryParams = [id,];
        const { rows } = await dbClient.query(query, queryParams);
        if (rows.length === 1 && rows[0].name != req.body.name) {
            err = new Error('Envelope ID already exists');
            err.status = 405;
            next(err);
        } else {
            req.newEnvelope.id = id;
        }

    }

    // Validate name
    const newName = req.body.name;
    // We need a name
    if (!newName) {
        err = new Error('Invalid input');
        err.status = 405;
        next(err);
    }
    // check if it exists
    const query = `SELECT * FROM ${database} WHERE name = $1`;
    const queryParams = [newName,];
    const { rows } = await dbClient.query(query, queryParams);
    if (rows.length === 1) {
        req.envelope = rows[0];
        // if updating an existing envelope, the old name is valid.
        if (req.newEnvelope.id === req.envelope.id && req.envelope.name === newName) {
            req.newEnvelope.name = newName;
        }
    } else if (rows.length === 0) {
        req.newEnvelope.name = newName;
    };

    
    // otherwise, reject duplicates
    if (!req.newEnvelope.name) {
        err = new Error('Envelope name already exists');
        err.status = 405;
        next(err);
    };
    
    // Validate Amount
    const newAmount = Number(req.body.amount);
    if (!newAmount) {
        err = new Error('Invalid input');
        err.status = 405;
        next(err);
    }
    if (newAmount >= 0 && !Number.isNaN(newAmount)) {
        req.newEnvelope.amount = newAmount;
        next();
    } else {
        err = new Error('Negative amount');
            err.status = 405;
            next(err);
    } 
};

app.param('id', async (req, res, next, id) => {
    const idData = await checkID(id);
    console.log(idData);
    if (idData) {
        req.envelope = idData.envelope;
        req.envID = idData.envID;
        next();
        
    } else {
        const e = new Error('Invalid input')
        e.status = 405;
        next(e);
    }  
});

app.get('/', (req, res, next) => {
    res.send('Hello World');
});

app.get('/envelopes', async function(req, res, next) {
    const query = `SELECT * FROM ${database}`;
    const { rows } = await dbClient.query(query);
    res.json(rows);
});

app.post('/envelopes', validateEnvelope, async function(req, res, next) {
    if (req.envelope) {
        const e = new Error('Use PUT "/envelopes/{envelopeID}" for updating');
        e.status = 400;
        next(e);
    } else {
        if (req.newEnvelope.id) {
            const query = `INSERT INTO ${database} (id, name, amount) VALUES ($1, $2, $3)`
            const {id, name, amount} = req.newEnvelope;
            const queryParams = [id, name, amount];
            const response = await dbClient.query(query, queryParams);
            res.status(201).json({id: id, name: name, amount: amount});
        } else {
            const query = `INSERT INTO ${database} (name, amount) VALUES ($1, $2)`
            const queryParams = [req.newEnvelope.name, req.newEnvelope.amount];
            const create = await dbClient.query(query, queryParams);
            const queryID = `SELECT * FROM ${database} WHERE name = $1`;
            const queryIDParams = [req.newEnvelope.name,];
            const { rows } = await dbClient.query(queryID, queryIDParams);
            res.status(201).json(rows[0]);
        };
    };
});

app.get('/envelopes/:id', function (req, res, next) {
    res.json(req.envelope);
});

app.put('/envelopes/:id', validateEnvelope, async function (req, res, next) {
    const query = `UPDATE ${database} SET amount = $1, name = $2 WHERE id = $3`;
    const queryParams = [req.newEnvelope.amount, req.newEnvelope.name, req.envID];
    const update = await dbClient.query(query, queryParams);
    if (update.rowCount == 1) {
        res.json({id: req.envID, name: req.newEnvelope.name, amount: req.newEnvelope.amount});
    } else {
        e = new Error('Something unexpected went wrong')
        next(e);
    };
});

app.delete('/envelopes/:id', async function (req, res, next) {
    if (req.envelope.amount === 0) {    
        const query = `DELETE FROM ${database} WHERE id = $1`;
        const queryParams = [req.envID,];
        const update = await dbClient.query(query, queryParams);
        if (update.rowCount == 1) {
            res.status(204).send('Delete succesfull');
        } else {
            e = new Error('Something unexpected went wrong')
            next(e);
        };
    } else {
        e = new Error('Envelope not empty');
        e.status = 405;
        next(e);
    };
})


app.post('/envelopes/transfer/:fromID/:toID', async function(req, res, next) {
    const fromData = await checkID(req.params.fromID);
    const toData = await checkID(req.params.toID);
    const amount = checkAmount(req.body.amount);
    if (amount && fromData && toData && fromData.envelope.amount >= amount) {
        console.log("so far so good");
        const fromQuery = `UPDATE ${database} SET amount = amount - $1 WHERE id = $2`;
        const fromQueryParams = [amount, fromData.envID];
        const subtract = await dbClient.query(fromQuery, fromQueryParams);
        const toQuery  = `UPDATE ${database} SET amount = amount + $1 WHERE id = $2`;
        const toQueryParams = [amount, toData.envID];
        const recieving = await dbClient.query(toQuery, toQueryParams);
        if (subtract.rowCount == 1 && recieving.rowCount === 1) {
            res.status(200).send('Transfer succesfull!');
        } else {
            e = new Error('Something unexpected went wrong')
            next(e);
        };
    } else {
        e = new Error('Incufficient funds');
        e.status = 405;
        next(e);
    };
});

app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).send(err.message);
});

app.listen(PORT, function() {
    console.log(`Server listening on port ${PORT}`);
})

module.exports = app;