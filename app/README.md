# Lay IA — app das pacientes (protótipo)

Web app instalável (PWA) com assistente para as pacientes da Layane Moura.

## O que já funciona (etapa 1 — protótipo)
- Tela inicial com 4 atalhos: **Chef Lay**, **Lay no Restaurante**, **Lay no Mercado**, **Tirar dúvidas**
- Chat com envio de texto e de **foto** (câmera ou galeria; a foto é reduzida antes do envio)
- Menu lateral com link para o Rastreamento Metabólico
- Instalável na tela inicial do celular (manifest + service worker)
- **Respostas de exemplo** (`MODO_DEMO = true` em `index.html`) — ainda sem IA real

## Próximas etapas
1. Servidor (`/api/chat`) que guarda a chave da IA com segurança e as orientações da Layane
2. Acesso só para pacientes (código ou login) e, se desejado, dados do plano de cada paciente
3. Testes com a Layane e algumas pacientes antes de liberar

## Testar localmente
```
python3 -m http.server 8000
```
Abra http://localhost:8000/app/
