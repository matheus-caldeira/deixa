---
paths: ["src/ui/**", "src/app/**/*.tsx"]
---

# Front-end: fiel ao protótipo

A interface segue o `deixa.html`. Tokens e classes vivem em `src/ui/styles/`; componentes em `src/ui/`. Pages buscam dados no servidor e entregam por props. Componente React nunca importa repositório, cliente Gemini, TMDB ou Kokoro.

Checklist:

- [ ] Mobile-first: 390×844 primeiro; no desktop, coluna centralizada de no máximo 480px.
- [ ] Cores, fontes, raios e sombras só pelos tokens do protótipo; nenhuma cor nova.
- [ ] Ícones do objeto `I` do protótipo, em `src/ui/icons.tsx`, com os mesmos traços.
- [ ] `src/ui/**` não importa `src/infrastructure/**` nem `modules/**/infrastructure/**` (ESLint barra).
- [ ] Componente cliente fala com o servidor por server action ou route handler; nunca com serviço externo.
- [ ] Pôster real em 2:3 com o raio e as etiquetas de nível do protótipo; sem pôster, o tipográfico.
- [ ] Tema claro e escuro pelos tokens; `prefers-reduced-motion` respeitado.
- [ ] Nome do produto só pela constante `APP_NAME`.
- [ ] Tela pronta = screenshot em 390×844 (claro e escuro) comparado ao protótipo.

Profundidade: @.contexts/engineering/rules/frontend.md
