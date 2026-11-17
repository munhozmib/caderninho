"""Gera os PNGs do app a partir da mesma forma do icone.svg, sem dependencias."""
import math
import os
import struct
import zlib

FUNDO = (0x3F, 0x6B, 0x57)
ANEL = (0xD9, 0xED, 0xE3)
MIOLO = (0x6F, 0xA9, 0x8A)
RAIO_CANTO = 14 / 64


def cobertura(px, py, teste, amostras=4):
    """Antialiasing simples: amostra o pixel numa grade NxN."""
    dentro = 0
    for i in range(amostras):
        for j in range(amostras):
            x = px + (i + 0.5) / amostras
            y = py + (j + 0.5) / amostras
            if teste(x, y):
                dentro += 1
    return dentro / (amostras * amostras)


def misturar(base, cor, alfa):
    return tuple(round(b + (c - b) * alfa) for b, c in zip(base, cor))


def gerar(tamanho, caminho):
    s = tamanho
    r_canto = RAIO_CANTO * s
    centro = s / 2
    r_anel_ext = 0.3125 * s   # 20/64
    r_anel_int = 0.2344 * s   # 15/64
    r_miolo = 0.0859 * s      # 5.5/64

    def no_quadrado(x, y):
        dx = max(r_canto - x, 0, x - (s - r_canto))
        dy = max(r_canto - y, 0, y - (s - r_canto))
        return math.hypot(dx, dy) <= r_canto

    def dist(x, y):
        return math.hypot(x - centro, y - centro)

    linhas = bytearray()
    for py in range(s):
        linhas.append(0)  # filtro "none"
        for px in range(s):
            a_quad = cobertura(px, py, no_quadrado)
            if a_quad == 0:
                linhas.extend((0, 0, 0, 0))
                continue
            cor = FUNDO
            a_anel = cobertura(px, py, lambda x, y: r_anel_int <= dist(x, y) <= r_anel_ext)
            if a_anel:
                cor = misturar(cor, ANEL, a_anel)
            a_miolo = cobertura(px, py, lambda x, y: dist(x, y) <= r_miolo)
            if a_miolo:
                cor = misturar(cor, MIOLO, a_miolo)
            linhas.extend((*cor, round(255 * a_quad)))

    def bloco(tipo, dados):
        c = tipo + dados
        return struct.pack('>I', len(dados)) + c + struct.pack('>I', zlib.crc32(c))

    png = b'\x89PNG\r\n\x1a\n'
    png += bloco(b'IHDR', struct.pack('>IIBBBBB', s, s, 8, 6, 0, 0, 0))
    png += bloco(b'IDAT', zlib.compress(bytes(linhas), 9))
    png += bloco(b'IEND', b'')

    with open(caminho, 'wb') as f:
        f.write(png)
    return len(png)


if __name__ == '__main__':
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for tamanho, nome in ((192, 'icone-192.png'), (512, 'icone-512.png'), (180, 'icone-180.png')):
        destino = os.path.join(raiz, nome)
        print(nome, gerar(tamanho, destino), 'bytes')
