"""Confere se o RLS esta de pe.

Usa SO a chave publica (publishable key, a mesma que vai no site) e tenta ler tudo
sem estar logado. Se qualquer tabela ou view devolver dados, o teste falha:
e exatamente assim que um vazamento aconteceria na vida real.

    python -I ferramentas/testar_rls.py
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

ALVOS = [
    'pessoa', 'fato', 'interacao', 'interacao_pessoa', 'tag', 'pessoa_tag',
    'config', 'audit_log', 'v_pessoa', 'v_agenda',
]


def ler_config():
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    caminho = os.path.join(raiz, 'config.js')
    with open(caminho, encoding='utf-8') as f:
        texto = f.read()
    url = re.search(r"url:\s*'([^']*)'", texto)
    chave = re.search(r"chave:\s*'([^']*)'", texto)
    return (url.group(1) if url else ''), (chave.group(1) if chave else '')


def consultar(url, chave, alvo):
    req = urllib.request.Request(
        f'{url}/rest/v1/{alvo}?select=*&limit=5',
        headers={'apikey': chave, 'Authorization': f'Bearer {chave}'},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode() or '[]')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:160]


def main():
    url, chave = ler_config()
    if not url or not chave:
        print('config.js ainda esta em branco. Preencha url e chave primeiro.')
        return 2

    print(f'Testando {url} com a anon key, SEM login.\n')
    falhas = []
    for alvo in ALVOS:
        status, corpo = consultar(url, chave, alvo)
        vazou = status == 200 and isinstance(corpo, list) and len(corpo) > 0
        marca = 'VAZOU' if vazou else 'ok   '
        detalhe = f'{len(corpo)} linhas' if isinstance(corpo, list) else str(status)
        print(f'  {marca}  {alvo:18s} HTTP {status}  {detalhe}')
        if vazou:
            falhas.append(alvo)

    print()
    if falhas:
        print('FALHOU. Estas tabelas respondem sem login: ' + ', '.join(falhas))
        print('Rode schema.sql de novo e confira o Security Advisor do Supabase.')
        return 1

    print('Passou: nada e legivel sem estar logado.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
