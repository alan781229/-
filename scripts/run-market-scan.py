"""Drive the owner-private Site scanner. Supply its service token only via env."""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = 'https://tide-research-alan781229.amg781229.chatgpt.site'
RULES = dict(preset='strict', direction='both', ma=True, ema=True, slope=True, volumeRatio=1.2)

class SameSiteRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        destination=urllib.parse.urlsplit(newurl)
        if (destination.scheme,destination.netloc) != ('https',urllib.parse.urlsplit(SITE).netloc):
            raise RuntimeError('Private service redirect refused; check Site access token.')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def request_api(action, token, body=None):
    request = urllib.request.Request(SITE + '/api/scan/' + action,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'OAI-Sites-Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    opener = urllib.request.build_opener(SameSiteRedirect())
    try:
        with opener.open(request, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never print request headers or token. A competing driver is recoverable.
        if error.code == 409:
            current = json.load(error)
            if current.get('progress'):
                return current['progress']
        raise RuntimeError(f'Site scanner HTTP {error.code}') from None

def drive(call, deadline_seconds=840, now=time.time, sleep=time.sleep):
    status = call('status')
    current = status.get('progress')
    if current and current.get('status') == 'running':
        updated = __import__('datetime').datetime.fromisoformat(current['updatedAt'].replace('Z', '+00:00')).timestamp()
        if now() - updated < 120:
            return {'skipped': 'Another fresh scan is running.'}
        run = current  # Resume a stopped driver, retaining its cutoff and progress.
    else:
        run = call('begin', {'provider': 'okx', 'rules': RULES})
    deadline = now() + deadline_seconds
    for _ in range(200):
        if run.get('status') in ('completed', 'failed'):
            saved = call('status')
            snapshot = saved.get('snapshot') or {}
            if run['status'] == 'completed' and snapshot.get('runId') != run['runId']:
                raise RuntimeError('Persisted scan snapshot does not match run.')
            return {k: run.get(k) for k in ('runId', 'status', 'total', 'completed', 'failed', 'updatedAt', 'exchangeTime')} | {'candidates': len(run.get('results', []))}
        if now() >= deadline:
            raise RuntimeError('Scan deadline reached; progress is retained for the next driver.')
        sleep(0.2)
        run = call('step', {'runId': run['runId'], 'offset': run['offset']})
    raise RuntimeError('Step limit reached; inspect persisted progress.')

if __name__ == '__main__':
    token = os.environ.get('TIDE_SITE_SERVICE_TOKEN')
    if not token:
        raise SystemExit('Configure TIDE_SITE_SERVICE_TOKEN in GitHub Actions secrets first.')
    result = drive(lambda action, body=None: request_api(action, token, body))
    print(json.dumps(result, ensure_ascii=False))
    if result.get('status') == 'failed':
        raise SystemExit(1)
