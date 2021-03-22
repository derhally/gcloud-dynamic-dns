/*jshint esversion: 6 */

const ipHelper = require('ip');
const { DNS } = require('@google-cloud/dns');

settings = {
    useToken: process.env.USE_TOKEN,
    dnsZone: process.env.DNS_ZONE,
    secretToken: process.env.SECRET_TOKEN,
    allowedHosts: process.env.ALLOWED_HOSTS.split(","),
    ttl: process.env.TTL
}

const dns = new DNS();
/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
exports.updateHost = function (req, res) {

    provided_secret = ""

    if (settings.useToken) {
        provided_secret = req.query.token || req.body.token;
    }
    else if (req.headers.authorization) {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        provided_secret = password
    }
    else {
        respondWithError(401, 'unauthorized', 'Login Required', res);
        return;
    }

    console.log(req.originalUrl)

    var ipv4 = req.query.ipv4 || req.body.ipv4;
    var ipv6 = req.query.ipv6 || req.body.ipv6;
    var host = req.query.host || req.body.host;
    var zone = req.query.zone || req.body.zone || settings.dnsZone;

    if (!provided_secret || !settings.secretToken || provided_secret != settings.secretToken) {
        respondWithError(401, 'unauthorized', 'Login Required', res);
        return;
    }

    if (!host) {
        respondWithError(400, 'missing host', 'Provide a valid host name', res);
        return;
    }

    if (!settings.allowedHosts.includes('*') && !settings.allowedHosts.includes(host)) {
        respondWithError(401, 'illegal host', 'Host "' + host + '" is not allowed', res);
        return;
    }

    if (!host.endsWith('.')) {
        host += '.';
    }

    if (!ipv4 && !ipv6) {
        var ipAddr = req.ip;
        if (ipHelper.isV4Format(ipAddr)) {
            ipv4 = ipAddr;
        } else if (ipHelper.isV6Format(ipAddr)) {
            ipv6 = ipAddr;
        } else {
            respondWithError(
                400,
                'missing ip',
                'Could not evaluate ip address. Please provide with request.',
                res
            );
            return;
        }
    }

    if (ipv4 && !ipHelper.isV4Format(ipv4)) {
        respondWithError(
            400,
            'illegal IPv4',
            'Could not parse IPv4 address: ' + ipv4,
            res
        );
        return;
    }

    if (ipv6 && !ipHelper.isV6Format(ipv6)) {
        respondWithError(
            400,
            'illegal IPv6',
            'Could not parse IPv6 address: ' + ipv6,
            res
        );
        return;
    }

    console.log('zone: %s, host: %s, ipv4: %s, ipv6: %s', zone, host, ipv4, ipv6);

    updateHosts(zone, host, ipv4, ipv6)
        .then(data => {
            res.status(200).send('good');
        })
        .catch(err =>
            respondWithError(
                err.code || 500,
                err.title || 'API error',
                err.message,
                res
            )
        );
};

function respondWithError(status, title, detail, res) {
    let err = { code: status, title: title, detail: detail };
    console.error(err);
    res.status(status).json(err);
}

function updateHosts(zone, host, ipv4, ipv6) {
    var dnsClient = dns;

    var dnsZone = dnsClient.zone(zone);

    return updateRecords(dnsZone, host, ipv4, ipv6)
        .then(() => {
            return {
                code: '200',
                values: {
                    host: host,
                    ipv4: ipv4,
                    ipv6: ipv6
                }
            };
        });
}

function getOldRecords(zone, host, ipv4, ipv6) {
    return zone
        .getRecords({ name: host, filterByTypes_: { A: ipv4, AAAA: ipv6 } })
        .then(data => {
            var oldRecord = data[0];
            if (oldRecord.length < 1) {
                throw {
                    code: 400,
                    title: 'illegal host',
                    message: 'Host "' + host + '" not found.'
                };
            }
            return oldRecord;
        });
}

function updateRecords(zone, host, ipv4, ipv6) {
    return getOldRecords(
        zone,
        host,
        typeof ipv4 != 'undefined',
        typeof ipv6 != 'undefined'
    ).then(oldRecords => {
        let newRecords = [];
        if (ipv4) {
            newRecords.push(
                zone.record('A', {
                    name: host,
                    ttl: settings.ttl,
                    data: ipv4
                })
            );
        }
        if (ipv6) {
            newRecords.push(
                zone.record('AAAA', {
                    name: host,
                    ttl: settings.ttl,
                    data: ipv6
                })
            );
        }
        return zone.createChange({
            add: newRecords,
            delete: oldRecords
        });
    });
}
