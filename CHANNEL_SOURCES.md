# Catálogo de canais

`channels.json` é um snapshot deduplicado das fontes públicas abaixo. Cada canal mantém os metadados disponíveis e uma lista de streams encontrados.

- IPTV-org: https://iptv-org.github.io/api/channels.json, https://iptv-org.github.io/api/streams.json, https://iptv-org.github.io/iptv/index.m3u
- Dearbulut: https://dearbulut.github.io/iptv/api/v1/channels.online.json, https://dearbulut.github.io/iptv/api/v1/channels.json, https://dearbulut.github.io/iptv/api/v1/streams.json, https://dearbulut.github.io/iptv/playlists/best.m3u
- Streamline IPTV: https://cdn.jsdelivr.net/gh/streamline-iptv/iptv-playlists@dist/index.m3u
- A página de playlists do Doubo aponta para playlists do Streamline IPTV, já cobertas pelo importador.
- Broadcast Atlas é uma página de diretório; não expõe um feed M3U direto no HTML no momento da importação.

## Atualizar

Baixe novamente os arquivos listados em `scripts/import_channels.py` para `.import/` e execute:

```bash
python3 scripts/import_channels.py
```

O aplicativo lê o catálogo local, permite pesquisar por nome, país ou categoria e tenta reproduzir o primeiro stream disponível de cada canal.

As URLs de transmissão são de terceiros e podem ficar offline, exigir geobloqueio, cabeçalhos específicos ou ser removidas pelos respectivos provedores. Use somente conteúdo que você esteja autorizado a acessar.
