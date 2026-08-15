# ⚠️ DEPRECATED — Google Apps Script mirror

> **This directory is deprecated and no longer maintained.**
>
> The live dashboard is the **Node/SQLite deployment** (`src/server/` + the
> Cloudflare worker in `src/worker/`), served from **Render**. The files here
> are the legacy Google Apps Script (GAS) port that predates the Node
> migration and is kept only for historical reference / Google Sheet
> compatibility notes.
>
> - It has **not** been kept in sync with newer features (AI Meeting Notes
>   library with search & grouping, Groq transcription/summarization, full
>   backup download, worker security hardening, retention policy, etc.).
> - Do **not** use it as the source of truth, and do not push changes here
>   expecting them to affect the live site. The GAS deployment was retired
>   when the Node backend took over routing (`GAS_URL` / `GAS_SCRIPT_URL`
>   are kept in the worker only for backward compatibility).
> - Relevant, still-current documentation lives in `../docs/`.

If a GAS-based deployment is ever needed again, the port must be revived
from `src/server/` behavior, not from these files.
