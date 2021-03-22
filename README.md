# GCloud Dynamic DNS

originally based on [dynamic-cloud-dns](https://github.com/srueg/dynamic-cloud-dns)

Updated and verified to work with Ubiquiti UDMP gateway

This is a Google Cloud function that will update the records hosted in Cloud DNS.

If neither an IPv4 nor an IPv6 address is provided, the source address of the request is used.

## Configuration

Settings are loaded from environment variables

| Config     | Description
|------------|---------------
|`DNS_ZONE`     | The Google Cloud DNS Zone name in which the records reside.
|`USE_TOKEN` | Indicates whether to use the token on the query parameter.  If not set will use password from the Authorization headers
|`SECRET_TOKEN` | A secret token, used to authenticate users.
|`ALLOWED_HOSTS`| A list of hosts that callers are allowed to update. May include `"*"` to allow all hosts.
|`TTL`         | Time to live for records in seconds.


Under the dynamic dns section of the UDMP controller settings

Add an entry with the following settings

| Settings  | Value
|-----------|----------
|`Service`  | `dyndns`
|`Hostname`  | `The hostname you want to update`
|`Username`  | `Any value to satisfy the req`
|`Password`  | `The password that matches what is set in the function SECRET_TOKEN env variable`
|`Server`  | `{cloud-function-address}/updateHost?host=%h&ipv4=%i&extra=` <BR> Replace {cloud-function-address} with the cloud function address.  You can find that in the deploy output as part of the url setting. <BR> The "extra=" can be left blank because on some UniFi controllers the hostname gets appended


## Deploy to Google Cloud Functions

* Setup [Google Cloud Functions](https://cloud.google.com/functions/docs/quickstart)
* [Install](https://cloud.google.com/sdk/install) the `gcloud` CLI tool
* Authenticate: `gcloud auth login`
* `npm run deploy`

## License

See [LICENSE](LICENSE) for more details.
