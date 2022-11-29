const keys = require('./keys');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { Pool } = require('pg');

const redis = require("redis");
const { promisifyAll } = require('bluebird');

promisifyAll(redis)

const runApplication = async () => {
    try {
        // Express App Setup
        const app = express();
        app.use(cors());
        app.use(bodyParser.json());

        // Postgres Client Setup
        const pgClient = new Pool({
            user: keys.pgUser,
            host: keys.pgHost,
            database: keys.pgDatabase,
            password: keys.pgPassword,
            port: keys.pgPort,
        });

        pgClient.on('connect', () => {
            pgClient
                .query('CREATE TABLE IF NOT EXISTS values (number INT)')
                .catch((err) => console.log(err));
        });

        // Redis Client Setup
        const client = redis.createClient({
            socket: {
                host: keys.redisHost,
                port: keys.redisPort,
                reconnectStrategy: () => 1000
            },
            legacyMode: true

        });

        client.on('error', (err) => console.log('Redis Client Error', err));

        await client.connect();
        const publisher = client.duplicate();

        await publisher.connect();

        // Express route handlers
        app.get('/', (req, res) => {
            res.send('Hi');
        });

        app.get('/values/all', async (req, res) => {
            try {
                const values = await pgClient.query('SELECT * from values');
                res.send(values);
                // res.send("hi");
            } catch (error) {
                console.log(error);
            }
        });

        app.get('/values/current', async (req, res) => {
            try {
                client.HGETALL('values', (err, result) => {
                    if (err) console.log(err);
                    else {
                        console.dir(result);
                        res.json(result);
                    }
                });
                // console.log(values);
                // res.send(values);
            } catch (error) {
                console.log(error);
            }
        });

        app.post('/values', async (req, res) => {
            try {
                const index = req.body.index;
                console.log(index);
                if (parseInt(index) > 40) {
                    return res.status(422).send('Index too high');
                }

                await client.hSet('values', index.toString(), 'Nothing yet!');
                await publisher.publish('insert', index.toString());

                await pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
                res.send({ working: true });
            } catch (error) {
                console.log(error);
            }
        });

        app.listen(5000, () => {
            console.log('Listening');
        });
    } catch (error) {
        console.log(error);
    }


}

runApplication();

