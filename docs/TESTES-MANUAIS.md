---
title: Testes manuais pendentes
updated: 2026-10-14
source: conversa de 14/10/2026
---

# Testes manuais pendentes

Lista do que só pode ser conferido em aparelho externo (Windows, Linux, celular) ou à mão. Marque `[x]` ao
validar e anote o resultado; o que falhar vira tarefa.

## Windows (release v0.0.5 ou mais nova)

- [ ] Instalar pelo `.exe` ou `.msi` (SmartScreen: "Mais informações → Executar assim mesmo") e abrir como usuário
      comum, não como Administrador.
- [ ] Nenhuma janela de terminal aparece ao abrir o app nem enquanto ele roda (correção da 0.0.5).
- [ ] Tela de configuração: digitar o código de `setup-code.txt` (pasta de dados do app, em
      `%APPDATA%\app.deixa.desktop`) e escolher **Instalar um Postgres só para o Deixa**.
- [ ] O download (cerca de 23 MB) conclui, o banco é criado e a tela vai para a criação da primeira conta em menos
      de um minuto. Se falhar na extração, anotar a mensagem: o `tar` do Windows precisa abrir `.txz`.
- [ ] Fechar o app pela bandeja e conferir no Gerenciador de Tarefas que não sobrou `postgres.exe` nem `node.exe`.
- [ ] Abrir de novo: entra direto como o dono, sem pedir configuração.
- [ ] Aviso nativo do Windows ao chegar uma notificação (cards prontos).
- [ ] Menu Arquivo → Importar… e Exportar… abrem a tela certa.
- [ ] Com a conta em inglês (perfil → English), o aviso da bandeja ao chegar uma notificação sai em inglês;
      os menus nativos continuam em português (pendência conhecida).

## Linux

- [ ] AppImage e `.deb` abrem (WebKitGTK).
- [ ] Postgres embutido: a extração exige `xz` instalado; conferir numa distribuição limpa.

## macOS

- [ ] Aviso nativo aparece com o pacote assinado localmente (pendência antiga do HANDOFF).
- [ ] Instalador Intel abre em um Mac Intel.

## Celular (na rede da casa)

- [ ] Abrir pelo QR code da bandeja e instalar como PWA.
- [ ] Ditado do teclado funciona no Conversar (microfone direto só com HTTPS).
