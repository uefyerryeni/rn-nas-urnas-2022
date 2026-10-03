# Achados 2026 · UEFY

Ferramenta de comparação eleitoral do Rio Grande do Norte construída a partir do antigo **RN nas Urnas — 2022**.

## Estrutura
- **Achados 2026** (página principal): cruza a memória consolidada de 2022 com os resultados oficiais de 2026.
- **Arquivo 2022** (`arquivo-2022.html`): preserva integralmente a exploração histórica, mapas, extremos e geração de conteúdo.
- **Votos por partido**: compara 2022 e 2026 para Governador, Senado, Deputado Federal e Deputado Estadual.
- **Composição 22 × 26**: candidaturas com votos, vagas e eleitos oficialmente identificados.
- **Detector de achados**: mudanças de liderança municipal, exceções, disputas apertadas, maiores vantagens e extremos percentuais.
- **Parnamirim**: acompanhamento especial da comparação presidencial.

## Fontes e método
Resultados eleitorais: Tribunal Superior Eleitoral. O consumo de 2026 usa o arquivo EA20 oficial. Para cargos proporcionais, votos por partido somam votos nominais válidos e votos válidos de legenda. Achados em andamento são marcados como provisórios; a condição de eleito só é exibida quando informada oficialmente pelo TSE.

A base de 2022 é consolidada e preserva retotalizações posteriores ao pleito.

## Arquitetura
O projeto continua **independente de `uefy-eleicoes-2026`**. A Central 2026 não é modificada nem utilizada como dependência: Achados consulta a fonte oficial do TSE por sua própria rotina e mantém o último snapshot válido em caso de falha.

Durante a noite de apuração, o workflow `Atualizar Achados 2026` atualiza o snapshot em intervalos de cinco minutos. A interface consulta esse snapshot sem sobrecarregar a CDN do TSE.
