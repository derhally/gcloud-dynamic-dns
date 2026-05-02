const crypto = require('crypto');
const net = require('net');
const { DNS } = require('@google-cloud/dns');

const settings = {
    useToken: process.env.USE_TOKEN === 'true',
    dnsZone: process.env.DNS_ZONE,
    secretToken: process.env.SECRET_TOKEN,
    allowedHosts: (process.env.ALLOWED_HOSTS || '').split(','),
    ttl: parseInt(process.env.TTL, 10)
};

const dns = new DNS();

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
exports.updateHost = async function (req, res) {
    try {
        const providedSecret = extractSecret(req);

        if (!providedSecret || !settings.secretToken || !secretsMatch(providedSecret, settings.secretToken)) {
            return respondWithError(401, 'unauthorized', 'Login Required', res);
        }

        let ipv4 = req.query.ipv4 || (req.body && req.body.ipv4);
        let ipv6 = req.query.ipv6 || (req.body && req.body.ipv6);
        let host = req.query.host || (req.body && req.body.host);
        const zone = req.query.zone || (req.body && req.body.zone) || settings.dnsZone;

        if (!host) {
            return respondWithError(400, 'missing host', 'Provide a valid host name', res);
        }

        if (!settings.allowedHosts.includes('*') && !settings.allowedHosts.includes(host)) {
            return respondWithError(401, 'illegal host', `Host "${host}" is not allowed`, res);
        }

        if (!host.endsWith('.')) {
            host += '.';
        }

        if (!ipv4 && !ipv6) {
            const ipAddr = clientIp(req);
            const v = net.isIP(ipAddr);
            if (v === 4) {
                ipv4 = ipAddr;
            } else if (v === 6) {
                ipv6 = ipAddr;
            } else {
                return respondWithError(
                    400,
                    'missing ip',
                    'Could not evaluate ip address. Please provide with request.',
                    res
                );
            }
        }

        if (ipv4 && net.isIP(ipv4) !== 4) {
            return respondWithError(400, 'illegal IPv4', `Could not parse IPv4 address: ${ipv4}`, res);
        }

        if (ipv6 && net.isIP(ipv6) !== 6) {
            return respondWithError(400, 'illegal IPv6', `Could not parse IPv6 address: ${ipv6}`, res);
        }

        console.log('zone: %s, host: %s, ipv4: %s, ipv6: %s', zone, host, ipv4, ipv6);

        await updateHosts(zone, host, ipv4, ipv6);
        res.status(200).send('good');
    } catch (err) {
        respondWithError(err.code || 500, err.title || 'API error', err.message, res);
    }
};

function extractSecret(req) {
    if (settings.useToken) {
        return req.query.token || (req.body && req.body.token) || '';
    }
    if (req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length !== 2) {
            return '';
        }
        const credentials = Buffer.from(parts[1], 'base64').toString('utf8');
        const idx = credentials.indexOf(':');
        if (idx < 0) {
            return '';
        }
        return credentials.slice(idx + 1);
    }
    return '';
}

function secretsMatch(provided, expected) {
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        return xff.split(',')[0].trim();
    }
    return req.ip;
}

function respondWithError(status, title, detail, res) {
    const err = { code: status, title, detail };
    console.error(err);
    res.status(status).json(err);
}

async function updateHosts(zone, host, ipv4, ipv6) {
    const dnsZone = dns.zone(zone);
    await updateRecords(dnsZone, host, ipv4, ipv6);
}

async function updateRecords(zone, host, ipv4, ipv6) {
    const [allRecords] = await zone.getRecords({ name: host });

    const typesToReplace = [];
    if (ipv4) {
        typesToReplace.push('A');
    }
    if (ipv6) {
        typesToReplace.push('AAAA');
    }

    const oldRecords = allRecords.filter(r => typesToReplace.includes(r.type));

    const newRecords = [];
    if (ipv4) {
        newRecords.push(zone.record('A', { name: host, ttl: settings.ttl, data: ipv4 }));
    }
    if (ipv6) {
        newRecords.push(zone.record('AAAA', { name: host, ttl: settings.ttl, data: ipv6 }));
    }

    return zone.createChange({ add: newRecords, delete: oldRecords });
}
