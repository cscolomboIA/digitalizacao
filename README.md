# Dashboard CAR — Ifes (GitHub Pages)

Este dashboard funciona 100% em **GitHub Pages** (sem backend).  
Ele lê o arquivo **data.xlsx** no navegador por meio da biblioteca **SheetJS**.

## Como publicar

1. Crie um repositório no GitHub (ex.: `car-dashboard`).
2. Faça upload dos **4 arquivos** da pasta `dashboard/`:
   - `index.html`
   - `style.css`
   - `script.js`
   - `data.xlsx`
3. No repositório, vá em **Settings → Pages → Build and deployment** e selecione **Deploy from a branch** usando a branch padrão (`main`), pasta **/ (root)**.
4. Abra a URL do GitHub Pages fornecida (algo como `https://seuusuario.github.io/car-dashboard/`).

## Atualizando os dados
- Substitua `data.xlsx` por uma versão nova com as **mesmas colunas**.  
- Se adicionar novas colunas relevantes (por exemplo, `Título CAR Emitido`, `Título CAR Validado`, `Nº Processo Autuado`), os painéis correspondentes serão habilitados automaticamente.

## Personalização
- Cores e layout no `style.css`.
- Lógica dos gráficos no `script.js`.
- Gráficos com Plotly e tabela com DataTables.

## Segurança / LGPD
- Não publique CPFs ou dados sensíveis publicamente sem anonimização/consentimento.
- Se necessário, remova a coluna de CPF antes de publicar.

---

Feito com ❤️ para o IntegraCAR/Ifes.
