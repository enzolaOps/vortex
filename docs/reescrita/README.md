# Reescrita da interface do Vortex

Planejamento da v1 da interface nova: a interface é refeita do zero num pacote
novo, e a camada de lógica atual vira um pacote compartilhado. Cada documento
foi aprovado antes do seguinte. Leia nesta ordem:

| Documento | O que decide |
| --- | --- |
| [00-decisoes.md](00-decisoes.md) | Por que reescrever, a tese do produto, escopo, design, engenharia e processo — o registro das decisões aprovadas |
| [01-inventario-da-logica.md](01-inventario-da-logica.md) | O que a camada de lógica já entrega por jornada, e o que falta |
| [02-prd.md](02-prd.md) | Problema, princípios, as sete jornadas da v1 com estados e critério de "completa", métricas e riscos |
| [03-brief-de-design.md](03-brief-de-design.md) | Tese visual, estrutura do shell, restrições, papéis de token e vocabulário de voz e tela |
| [04-arquitetura-trd.md](04-arquitetura-trd.md) | Pacotes `nucleo` e `app`, a extração (M0), voz e PiP, rota de saída de sala, design system em código, requisitos técnicos, testes e o plano M0–M9 |
| [05-seguranca.md](05-seguranca.md) | Modelo de ameaça, controles por área e os requisitos de segurança da v1 |
| [06-entrega.md](06-entrega.md) | O resultado: marcos e PRs, releases, mudanças de rumo, o que ficou fora, ondas seguintes e dívidas abertas |

Design (artefatos privados no claude.ai, compartilháveis pelo menu Share):

- Design system "Vortex": https://claude.ai/artifact/AonTvFPYv3ekcQo6tZpfrq
- Telas das jornadas da v1: https://claude.ai/artifact/Cqgf56xbbD867sqjTbv5Sh
- Rodadas de exploração (estrutura e estilo): https://claude.ai/artifact/YShrjG98F9sRGBWNBTtvbq
