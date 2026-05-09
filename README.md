# OnlyPaws

Vue-3-Webapp mit TypeScript und einem kleinen Node/Express-API-Layer. Die API nutzt aktuell Mockdaten in `server/src/data/mockData.ts`; MongoDB kann später über `MONGODB_URI` aus `.env` angebunden werden.
Spielsession-Queue und Creator-Spielzeuge sind bereits an MongoDB angebunden. Wenn unter `MONGODB_URI` keine lokale DB erreichbar ist, versucht die API beim Start `mongod` lokal mit `.data/mongodb` als Datenverzeichnis zu starten.

## Entwicklung

```bash
npm install
npm run dev:full
```

Frontend: `http://localhost:5173`

API: `http://localhost:3000/api/health`

MongoDB: `mongodb://localhost:27017/onlypaws`

Nur Frontend starten:

```bash
npm run dev
```
