"""Prepare pinned backend revisions and apply reviewed Dev adaptations."""
import argparse
import base64
import json
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--local', action='store_true', help='Clone local sources instead of GitHub')
args = parser.parse_args()
workspace = root / '.ci/workspace'
workspace.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
token = env.pop('BACKEND_READ_TOKEN', '')
if not args.local:
    if not token:
        raise SystemExit('Configure BACKEND_READ_TOKEN with Contents:read on the five backend repositories.')
    env.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',
               GIT_CONFIG_VALUE_0='AUTHORIZATION: basic ' + base64.b64encode(('x-access-token:' + token).encode()).decode())
for item in json.loads((root / 'infra/ci/backends.json').read_text()):
    dest = workspace / item['destination']
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        raise SystemExit(f'Destination already exists: {dest}. Use a clean .ci/workspace.')
    subprocess.run(['git', 'init', str(dest)], check=True, stdout=subprocess.DEVNULL)
    source = str(root.parent / item['destination']) if args.local else 'https://github.com/' + item['repository'] + '.git'
    subprocess.run(['git', '-C', str(dest), 'fetch', '--depth=1', source, item['revision']], env=env, check=True)
    subprocess.run(['git', '-C', str(dest), 'checkout', '--detach', 'FETCH_HEAD'], check=True)
    if item.get('patch'):
        subprocess.run(['git', '-C', str(dest), 'apply', str(root / item['patch'])], check=True)
compose = json.loads((root / 'compose.dev.yml').read_text())
def translate(value):
    if value.startswith('../'):
        return (workspace / value[3:]).resolve().as_posix()
    if value.startswith('./'):
        return (root / value[2:]).resolve().as_posix()
    return value
for service in compose['services'].values():
    if 'build' in service:
        context = service['build']['context']
        service['build']['context'] = root.as_posix() if context == '.' else translate(context)
    service['volumes'] = [translate(v.split(':')[0]) + (':' + ':'.join(v.split(':')[1:]) if ':' in v else '')
                          if v.startswith(('../', './')) else v for v in service.get('volumes', [])]
(root / '.ci/compose.json').write_text(json.dumps(compose, indent=2))
