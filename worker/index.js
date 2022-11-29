const keys = require("./keys");
const redis = require("redis");
const { promisifyAll } = require('bluebird');

promisifyAll(redis)

const runApplication = async () => {
    try {
        const client = redis.createClient({
            socket: {
                host: keys.redisHost,
                port: keys.redisPort,
                reconnectStrategy: () => 1000
            }

        });

        client.on('error', (err) => console.log('Redis Client Error', err));

        await client.connect();
        const subscriber = client.duplicate();

        await subscriber.connect();

        client.on('connect', () => console.log('::> Redis Client Connected'));

        const fib = (index) => {
            if (index < 2) return 1;
            return fib(index - 1) + fib(index - 2);
        }

        subscriber.on('message', async (channel, message) => {
            console.log("Event emitter", message, channel);
            if (isNaN(message))
                await client.hSet('values', message, fib(parseInt(message)));
        })

        subscriber.subscribe("insert", async (message) => {
            console.log(message);
            // if (!isNaN(message))

            await client.hSet('values', message.toString(), fib(parseInt(message)));
        });

    } catch (error) {
        console.log(error);
    }

}

runApplication();

