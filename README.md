# GCloud Dynamic DNS

originally based on [dynamic-cloud-dns](https://github.com/srueg/dynamic-cloud-dns)

Updated and verified to work with Ubiquiti UDMP gateway

This is a Google Cloud function that will update the records hosted in Cloud DNS.

If neither an IPv4 nor an IPv6 address is provided, the source address of the request is used.

## Configuration

### Service Account

It is advisable to run the gcloud function under a service account with specific permissions.   Create a custom role

with the following permissions

```
dns.changes.create
dns.changes.get
dns.managedZones.list
dns.resourceRecordSets.create
dns.resourceRecordSets.delete
dns.resourceRecordSets.list
dns.resourceRecordSets.update
```


Settings are loaded from environment variables

| Config     | Description
|------------|---------------
|`DNS_ZONE`     | The Google Cloud DNS Zone name/id in which the records reside.
|`USE_TOKEN` | Set to the literal string `"true"` to read the secret from the `token` query/body parameter. Any other value (including unset) falls back to the password in the HTTP Basic `Authorization` header.
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
|`Server`  | `{cloud-function-address}/updateHost?host=%h&ipv4=%i&extra=` <BR> Replace {cloud-function-address} with the cloud function address.  You can find that in the deploy output as part of the url setting. It usually follows the pattern `<REGION>-<PROJECT ID>.cloudfunctions.net` <BR> The "extra=" can be left blank because on some UniFi controllers the hostname gets appended


## Deploy to Google Cloud Functions

* Setup [Google Cloud Functions](https://cloud.google.com/functions/docs/quickstart)
* [Install](https://cloud.google.com/sdk/install) the `gcloud` CLI tool
* Authenticate: `gcloud auth login`
* Create a `.env.yaml` file with the runtime environment variables:
```yaml
DNS_ZONE: "zone id"
ALLOWED_HOSTS: "*"
TTL: "60"
```
* Store the secret token in [Secret Manager](https://cloud.google.com/secret-manager):
```bash
echo -n "your-secret" | gcloud secrets create dynamic-dns-token \
    --replication-policy="automatic" --data-file=-
```
* Grant the service account access to the secret:
```bash
gcloud secrets add-iam-policy-binding dynamic-dns-token \
    --role="roles/secretmanager.secretAccessor" \
    --member="serviceAccount:<service-account>"
```
* Create a `.env` file with the deployment variables (not checked in):
```
GCP_PROJECT=<your-project-id>
DEPLOY_SERVICE_ACCOUNT=<service-account-email>
```
* Run `npm run deploy` to deploy the function

## Testing with UDMP

You can test it with the UDMP by ssh in and running the command

```bash
/usr/sbin/inadyn -n -s -C -f /run/inadyn.conf -1 -l debug --foreground
```

This will show the HTTP requests and responses.

## License

See [LICENSE](LICENSE) for more details.
