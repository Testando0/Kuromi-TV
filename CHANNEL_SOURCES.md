# Catálogo de canais ativos

O catálogo publicado em `channels.json` usa como fonte principal o endpoint [`channels.online.json`](https://dearbulut.github.io/iptv/api/v1/channels.online.json) do projeto Dearbulut/IPTV Nexus. Esse endpoint é gerado por CI e inclui o estado de saúde de cada stream.

O importador mantém somente streams que atendem simultaneamente a estes critérios:

- `health.status == online`;
- score de saúde mínimo de 70;
- uptime mínimo de 80%;
- URL HTTP(S) sem exigência de `Referer` ou `User-Agent` especial, pois o navegador não consegue aplicar esses cabeçalhos em um elemento de vídeo.

Streams alternativos saudáveis são preservados e o player tenta o próximo automaticamente quando o primeiro falha. O catálogo não importa mais indiscriminadamente todas as URLs de IPTV-org, Streamline, Doubo ou Broadcast Atlas.

## Atualizar

Execute:

```bash
python3 scripts/import_channels.py
```

Se `/.import/dear_online.json` não existir, o script baixa o endpoint online atual. Para uma atualização manual, baixe novamente esse arquivo e execute o comando acima.

O projeto Free-TV/IPTV é mantido como referência de curadoria de canais gratuitos, mas não é misturado ao catálogo sem passar por verificação de saúde.

> Mesmo com verificação recente, streams de terceiros podem cair, sofrer geobloqueio ou mudar de URL. O player agora tenta streams alternativos elegíveis e informa quando nenhum está disponível.
