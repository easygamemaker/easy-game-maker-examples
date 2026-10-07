# Relatório de áudio

Gerado por `node tools/process-audio.mjs` a partir das saídas brutas da ElevenLabs. Todos os arquivos são mp3 (MPEG Audio Layer 3, um formato de áudio comprimido aceito por todos os navegadores) (efeitos e vozes em mono a 80 kbps, músicas em estéreo a 96 kbps). Total: 3.88 MB em 62 arquivos.

Metas: efeitos e voz do locutor em torno de -16 LUFS (LUFS, Loudness Units relative to Full Scale, volume integrado), músicas em torno de -20 LUFS para ficarem abaixo dos efeitos, e pico real abaixo de -1 dBTP (dBTP, decibéis de pico real). O limitador fixa o pico de amostra em -1,5 dBFS. Em arquivos muito curtos o volume integrado é medido com o trecho preenchido de silêncio até 3 s (o silêncio não entra na medida).

### Efeitos sonoros

| Arquivo | Duração (s) | Pico (dBFS) | Pico real (dBTP) | Volume (LUFS) | Tamanho (KB) |
|---|---|---|---|---|---|
| punch | 0.32 | -1.5 | -1.5 | -16.5 | 4 |
| punch_2 | 0.60 | -1.0 | -1.0 | -17.9 | 6 |
| kick | 0.80 | -1.7 | -1.5 | -17.1 | 8 |
| kick_2 | 0.80 | -4.2 | -4.2 | -16.3 | 8 |
| hit | 0.34 | -1.4 | -1.1 | -17.8 | 4 |
| hit_2 | 0.40 | -1.9 | -1.8 | -18.8 | 5 |
| block | 0.48 | -1.2 | -1.2 | -19.2 | 5 |
| sp_tiao | 1.20 | -5.8 | -5.7 | -16.4 | 12 |
| sp_dalva | 0.69 | -4.0 | -4.0 | -16.1 | 7 |
| sp_saci | 1.20 | -10.6 | -10.6 | -16.5 | 12 |
| sp_curupira | 1.20 | -1.9 | -1.9 | -20.7 | 12 |
| sp_craque | 1.00 | -1.5 | -1.5 | -17.2 | 11 |
| sp_rosa | 1.20 | -5.3 | -4.2 | -16.1 | 12 |
| jump | 0.48 | -3.1 | -3.0 | -16.4 | 5 |
| land | 0.35 | -1.6 | -1.6 | -22.5 | 4 |
| knockdown | 0.47 | -2.1 | -1.9 | -17.4 | 5 |
| ko | 1.48 | -1.9 | -1.9 | -17.2 | 15 |
| round_start | 1.48 | -1.7 | -1.7 | -16.4 | 15 |
| ui_move | 0.48 | -8.5 | -8.5 | -16.4 | 5 |
| ui_select | 0.48 | -1.9 | -1.2 | -17.4 | 5 |
| pause | 0.48 | -1.7 | -1.7 | -16.7 | 5 |
| tiao_attack | 0.60 | -5.7 | -5.7 | -16.4 | 6 |
| tiao_hurt | 0.48 | -1.7 | -1.6 | -16.4 | 5 |
| tiao_ko | 1.20 | -8.0 | -8.0 | -16.4 | 12 |
| dalva_attack | 0.47 | -7.7 | -7.7 | -16.3 | 5 |
| dalva_hurt | 0.48 | -5.6 | -5.6 | -16.3 | 5 |
| dalva_ko | 1.20 | -7.2 | -7.2 | -16.4 | 12 |
| saci_attack | 0.60 | -5.8 | -5.7 | -16.4 | 6 |
| saci_hurt | 0.33 | -6.2 | -6.2 | -16.3 | 4 |
| saci_ko | 1.20 | -3.5 | -3.5 | -16.4 | 12 |
| curupira_attack | 0.60 | -3.6 | -3.6 | -16.3 | 6 |
| curupira_hurt | 0.48 | -1.5 | -1.5 | -16.3 | 5 |
| curupira_ko | 1.12 | -8.8 | -8.8 | -16.4 | 12 |
| craque_attack | 0.60 | -4.3 | -4.3 | -16.4 | 6 |
| craque_hurt | 0.48 | -3.2 | -3.1 | -16.4 | 5 |
| craque_ko | 1.20 | -8.8 | -8.8 | -16.4 | 12 |
| rosa_attack | 0.60 | -7.5 | -7.4 | -16.4 | 6 |
| rosa_hurt | 0.48 | -4.6 | -4.6 | -16.4 | 5 |
| rosa_ko | 1.20 | -3.6 | -3.6 | -16.4 | 12 |

### Locutor

| Arquivo | Duração (s) | Pico (dBFS) | Pico real (dBTP) | Volume (LUFS) | Tamanho (KB) |
|---|---|---|---|---|---|
| ann_round_1 | 1.14 | -6.4 | -6.3 | -16.4 | 12 |
| ann_round_2 | 0.64 | -3.0 | -3.0 | -16.4 | 7 |
| ann_round_final | 1.24 | -4.9 | -4.9 | -16.4 | 13 |
| ann_fight | 0.64 | -4.0 | -4.0 | -16.4 | 7 |
| ann_ko | 0.63 | -4.0 | -4.0 | -16.3 | 7 |
| ann_time | 0.44 | -6.1 | -6.1 | -16.3 | 5 |
| ann_perfect | 0.70 | -1.9 | -1.9 | -16.5 | 7 |
| ann_p1_wins | 1.04 | -5.6 | -5.6 | -16.4 | 11 |
| ann_p2_wins | 1.05 | -2.7 | -2.7 | -16.8 | 11 |
| ann_you_win | 0.80 | -5.2 | -5.2 | -16.4 | 8 |
| ann_you_lose | 0.69 | -2.7 | -2.7 | -16.3 | 7 |
| name_tiao | 1.06 | -4.3 | -4.3 | -16.4 | 11 |
| name_dalva | 1.29 | -4.5 | -4.5 | -16.4 | 13 |
| name_saci | 0.52 | -1.6 | -1.5 | -17.7 | 6 |
| name_curupira | 0.59 | -2.3 | -2.3 | -16.4 | 6 |
| name_craque | 0.95 | -4.9 | -4.8 | -16.4 | 10 |
| name_rosa | 0.98 | -3.2 | -3.2 | -16.4 | 10 |

### Músicas

| Arquivo | Duração (s) | Pico (dBFS) | Pico real (dBTP) | Volume (LUFS) | Tamanho (KB) |
|---|---|---|---|---|---|
| music_title | 69.55 | -4.6 | -6.3 | -20.4 | 816 |
| music_select | 56.22 | -6.0 | -8.7 | -20.4 | 660 |
| music_fight_a | 77.54 | -6.2 | -7.3 | -20.4 | 910 |
| music_fight_b | 75.06 | -7.3 | -9.4 | -20.4 | 880 |
| music_victory | 12.04 | -2.3 | -5.1 | -20.4 | 142 |
| music_ko | 9.04 | -7.3 | -7.3 | -20.4 | 107 |

### Emendas dos loops

A faixa em loop é montada com o meio da música mais o final misturado com o começo (fusão de 2.5 s com curva de potência constante), de modo que o último trecho desemboca no ponto logo após o começo. A tabela compara os primeiros e os últimos 50 ms do arquivo final decodificado. `Salto` é o degrau entre a última e a primeira amostra relativo ao pico (um clique audível costuma passar de 0,1).

| Faixa | RMS (Root Mean Square, valor médio quadrático) dos 50 ms iniciais (dBFS) | RMS dos 50 ms finais (dBFS) | Diferença (dB) | Salto |
|---|---|---|---|---|
| music_title | -19.0 | -14.8 | 4.3 | 23.415 |
| music_select | -29.5 | -29.4 | 0.1 | 1.274 |
| music_fight_a | -19.7 | -23.4 | 3.7 | 3.169 |
| music_fight_b | -33.6 | -28.4 | 5.2 | 7.920 |

O codificador mp3 deixa cerca de 5 ms de nível baixo no começo de cada arquivo decodificado (atraso do codificador que sobra mesmo com a etiqueta de reprodução sem lacunas). Por isso o `Salto` das faixas de graves pesados sai alto: é um vão de 5 ms a cada volta do loop, não um degrau de clique. Esta medida mostra continuidade de nível e ausência de clique, mas não prova que o ritmo fica alinhado: isso só se confirma ouvindo.
